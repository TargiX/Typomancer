/**
 * NARRATIVE FLOW - PROCEDURAL AUDIO ENGINE (NEURAL-LINK CORE)
 * Version: 3.0.0 (Layered Progression)
 * Engineering: Neural-Link Audio Synthesis Subsystem
 *
 * Precise scheduling for rhythmic stability, on a 4-bar harmonic cycle so the
 * soundtrack evolves instead of looping one frozen bar.
 */

// The old `typomancerAudioEnabled` key keeps meaning "make sound at all" and is
// now the SFX switch; music got its own key so one can die while the other lives.
export const SFX_ENABLED_STORAGE_KEY = 'typomancerAudioEnabled';
export const SFX_VOLUME_STORAGE_KEY = 'typomancerSfxVolume';
export const MUSIC_ENABLED_STORAGE_KEY = 'typomancerMusicEnabled';
export const MUSIC_VOLUME_STORAGE_KEY = 'typomancerMusicVolume';
export const SWITCH_PROFILE_STORAGE_KEY = 'typomancerSwitchProfile';

// Volumes persist as 0..100; the engine works in linear gain 0..1.
const clampVolume = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) / 100 : 1;
};

// Keystroke voice. `melodic` plays the streak as a pentatonic line;
// `thock` is a lubed linear switch; `clicky` is a click-jacket switch.
export type SwitchProfile = 'melodic' | 'thock' | 'clicky';
export const SWITCH_PROFILES: SwitchProfile[] = ['melodic', 'thock', 'clicky'];

// A minor pentatonic, in semitones from A. The keystroke voice walks this scale so
// typing arpeggiates in the same key as the sequencer instead of clicking atonally.
const PENTATONIC_SEMITONES = [0, 3, 5, 7, 10];
const noteFreq = (semitone: number, octave: number) => 440 * Math.pow(2, (semitone + (octave * 12)) / 12);

export type ComboTier = 0 | 1 | 2 | 3;

class NeuralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  /**
   * Music-bus tone shaper between masterGain and the destination. The
   * soundtrack starts muffled under the drone and opens up as the security
   * trace climbs — most of what changes over a run.
   */
  private musicFilter: BiquadFilterNode | null = null;
  /**
   * SFX live on their own bus wired straight to the destination. The music bus
   * is faded to zero whenever the sequencer is off, so routing keystrokes
   * through it would silence every hit for anyone who plays without the
   * soundtrack.
   */
  private sfxGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private soundVolume: number = 1;
  private musicVolume: number = 1;
  private ducked: boolean = false;
  private keyStep = 0;
  private switchProfile: SwitchProfile = 'melodic';

  // Sequencer State
  private tempo = 110;
  private lookahead = 25.0; // ms
  private scheduleAheadTime = 0.1; // s
  private nextNoteTime = 0.0;
  private current16thNote = 0;
  private timerID: number | null = null;
  private intensity = 0; // 0 to 100

  /**
   * Harmony walks a 4-bar cycle: bass, arp and drone all retune to the bar
   * root, so the loop resolves every ~8.7s instead of repeating one bar of A.
   * Roots stay low; iv and VI/VII color against A minor.
   */
  private bar = 0;
  private static readonly PROGRESSION = [55.0, 43.65, 65.41, 49.0]; // A1 F1 C2 G1
  private arpStep = 0;

  // Persistent Nodes
  private droneNodes: AudioNode[] = [];
  private droneVoices: { osc: OscillatorNode; offset: number }[] = [];

  constructor() {
    try {
      this.soundEnabled = window.localStorage.getItem(SFX_ENABLED_STORAGE_KEY) !== '0';
      this.musicEnabled = window.localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== '0';
      const stored = window.localStorage.getItem(SWITCH_PROFILE_STORAGE_KEY) as SwitchProfile | null;
      if (stored && SWITCH_PROFILES.includes(stored)) this.switchProfile = stored;
      this.soundVolume = clampVolume(window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY));
      this.musicVolume = clampVolume(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
      this.soundEnabled = true;
      this.musicEnabled = true;
    }
  }

  /** Returns false when the browser refuses us an audio context at all. */
  private initContext(): boolean {
    if (this.ctx) return true;
    try {
      // Safari exposes only the prefixed constructor; `in` narrows it without
      // asserting a shape the DOM types don't declare.
      const AudioCtor = window.AudioContext ?? ('webkitAudioContext' in window
        ? window.webkitAudioContext as typeof AudioContext
        : undefined);
      if (!AudioCtor) throw new Error('no audio context');
      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.Q.value = 0.7;
      this.musicFilter.frequency.setValueAtTime(400 + this.intensity * 40, this.ctx.currentTime);
      this.masterGain.connect(this.musicFilter);
      this.musicFilter.connect(this.ctx.destination);
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.sfxGain.gain.setValueAtTime(this.soundVolume, this.ctx.currentTime);
    } catch {
      // No audio output available. Everything below degrades to a silent no-op
      // rather than taking the typing loop down with it.
      this.ctx = null;
      return false;
    }
    return true;
  }

  /**
   * Returns the SFX bus only when keystrokes are allowed to make noise right
   * now: sound enabled, context built, and the browser has actually granted
   * playback. Music state is irrelevant — muting the soundtrack never mutes
   * the keys.
   */
  private sfxBus(): { ctx: AudioContext; bus: GainNode; now: number } | null {
    if (!this.soundEnabled) return null;
    if (!this.ctx || !this.sfxGain) return null;
    if (this.ctx.state !== 'running') return null;
    return { ctx: this.ctx, bus: this.sfxGain, now: this.ctx.currentTime };
  }

  /** Short filtered noise transient — the physical "contact" under a key sound. */
  private noiseBurst(
    ctx: AudioContext,
    bus: GainNode,
    time: number,
    { duration, gain, type, frequency, Q = 1 }: {
      duration: number;
      gain: number;
      type: BiquadFilterType;
      frequency: number;
      Q?: number;
    }
  ) {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(filter);
    filter.connect(env);
    env.connect(bus);
    source.start(time);
    source.stop(time + duration);
  }

  /** Pitched blip with a lowpass envelope. The melodic half of every SFX. */
  private blip(
    ctx: AudioContext,
    bus: GainNode,
    time: number,
    { freq, endFreq, duration, gain, type = 'triangle', cutoff = 6000 }: {
      freq: number;
      endFreq?: number;
      duration: number;
      gain: number;
      type?: OscillatorType;
      cutoff?: number;
    }
  ) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (endFreq && endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    filter.type = 'lowpass';
    filter.frequency.value = cutoff;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(bus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  // --- SYNTHESIS INSTRUMENTS ---

  private playKick(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Punchy kick, fast frequency sweep. Moderate gain — four of these a bar
    // for a whole run is where the old loop got fatiguing.
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.45);
  }

  private playSnare(time: number) {
    if (!this.ctx || !this.masterGain) return;
     // Synthesized Snare: Noise burst + High Pass
     const bufferSize = this.ctx.sampleRate * 0.2; 
     const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
     const data = buffer.getChannelData(0);
     for (let i = 0; i < bufferSize; i++) {
       data[i] = Math.random() * 2 - 1;
     }
     
     const noise = this.ctx.createBufferSource();
     noise.buffer = buffer;
     
     const noiseFilter = this.ctx.createBiquadFilter();
     noiseFilter.type = 'highpass';
     noiseFilter.frequency.value = 1000;
     
     const noiseGain = this.ctx.createGain();
     noiseGain.gain.setValueAtTime(0.2, time);
     noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
     
     noise.connect(noiseFilter);
     noiseFilter.connect(noiseGain);
     noiseGain.connect(this.masterGain);
     noise.start(time);
  }

  private playHiHat(time: number) {
     if (!this.ctx || !this.masterGain) return;
     // Short high freq noise
     const bufferSize = this.ctx.sampleRate * 0.05; 
     const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
     const data = buffer.getChannelData(0);
     for (let i = 0; i < bufferSize; i++) {
       data[i] = (Math.random() * 2 - 1) * 0.5;
     }

     const noise = this.ctx.createBufferSource();
     noise.buffer = buffer;

     const filter = this.ctx.createBiquadFilter();
     filter.type = 'highpass';
     filter.frequency.value = 7000;

     const gain = this.ctx.createGain();
     // Velocity varies per hit; the pattern plays them on offbeats only, so
     // the hat layer is punctuation instead of a constant wash.
     const velocity = 0.06 + (Math.random() * 0.05);
     gain.gain.setValueAtTime(velocity, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

     noise.connect(filter);
     filter.connect(gain);
     gain.connect(this.masterGain);
     noise.start(time);
  }

  private playBass(time: number, freq: number) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator(); // Sub oscillator
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq / 2, time); // Octave down
      osc2.detune.value = 10; // Slight detune fatness

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, time);
      filter.frequency.exponentialRampToValueAtTime(110, time + 0.22); // Pluck envelope
      filter.Q.value = 2;

      gain.gain.setValueAtTime(0.28, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc2.start(time);
      osc.stop(time + 0.35);
      osc2.stop(time + 0.35);
  }

  private playArp(time: number, freq: number) {
      if (!this.ctx || !this.masterGain) return;
      // Soft pad pluck with a slow attack — pings were the most grating layer.
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.value = 2400;

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.04, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      // Simple stereo width (random pan)
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.random() * 1.4 - 0.7;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.45);
  }

  // --- ATMOSPHERICS ---

  private startDrone() {
     if (!this.ctx || !this.masterGain || this.droneNodes.length > 0) return;

     // Function to create a single drone voice. `offset` multiplies whatever
     // root the current bar lands on, so the cluster retunes with the phrase.
     const createDroneVoice = (offset: number, type: OscillatorType, pan: number) => {
         const osc = this.ctx!.createOscillator();
         const gain = this.ctx!.createGain();
         const panner = this.ctx!.createStereoPanner();
         const filter = this.ctx!.createBiquadFilter();

         osc.type = type;
         osc.frequency.value = NeuralAudioEngine.PROGRESSION[0] * offset;

         filter.type = 'lowpass';
         filter.frequency.value = 200;

         // Slow LFO for filter movement
         const lfo = this.ctx!.createOscillator();
         lfo.frequency.value = 0.05 + Math.random() * 0.05;
         const lfoGain = this.ctx!.createGain();
         lfoGain.gain.value = 100;

         lfo.connect(lfoGain);
         lfoGain.connect(filter.frequency);

         panner.pan.value = pan;

         osc.connect(filter);
         filter.connect(gain);
         gain.connect(panner);
         panner.connect(this.masterGain!);

         gain.gain.value = 0.03; // Background level

         osc.start();
         lfo.start();

         this.droneNodes.push(osc, gain, panner, filter, lfo, lfoGain);
         this.droneVoices.push({ osc, offset });
     };

     // Root drone cluster.
     createDroneVoice(1.0, 'sawtooth', -0.5);
     createDroneVoice(1.009, 'sawtooth', 0.5); // Detuned stereo
     createDroneVoice(2.0, 'sine', 0); // Octave up sine for warmth
  }

  /** Glides the drone cluster onto the new bar's root. */
  private retuneDrone(root: number) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const { osc, offset } of this.droneVoices) {
          osc.frequency.setTargetAtTime(root * offset, now, 0.6);
      }
  }

  private stopDrone() {
      this.droneNodes.forEach(node => {
          if (node instanceof OscillatorNode) {
            try { node.stop(); } catch(e){}
          }
          node.disconnect();
      });
      this.droneNodes = [];
      this.droneVoices = [];
  }

  // --- SEQUENCER SCHEDULER ---
  
  private nextNote() {
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += 0.25 * secondsPerBeat; // Advance by 1/16th note
      this.current16thNote++;
      if (this.current16thNote === 16) {
          this.current16thNote = 0;
          this.bar++;
      }
  }

  private scheduleNote(beatNumber: number, time: number) {
      // beatNumber is 0..15 (16th notes in the bar)
      const step = beatNumber;
      const phraseBar = this.bar % 4;
      const root = NeuralAudioEngine.PROGRESSION[phraseBar];
      if (step === 0) this.retuneDrone(root);

      // Layers come in with the security trace: calm is drone + sparse pulse,
      // full heat is a wall of sound. The mix breathes instead of hammering
      // one static loop.
      const drumsFull = this.intensity >= 60;

      // 1. KICK — one beat per bar when calm, halves when warm, relentless
      // four-on-the-floor only when the trace is hot.
      const kickSteps = drumsFull
          ? [0, 4, 8, 12]
          : this.intensity >= 25
              ? [0, 8]
              : [0];
      if (kickSteps.includes(step)) this.playKick(time);
      // A pickup kick ends the phrase every cycle so bars never run together.
      if (step === 14 && phraseBar === 3 && this.intensity >= 25) this.playKick(time);

      // 2. SNARE — 2 and 4 when hot, only the 4 when warm, silent when calm.
      if (drumsFull ? step === 4 || step === 12 : this.intensity >= 25 && step === 12) {
          this.playSnare(time);
      }

      // 3. HIHATS — offbeat 8ths when hot, sparse ticks when warm. No hat wash
      // at low intensity; it was the layer that made the loop feel busy.
      const hatSteps = drumsFull ? [2, 6, 10, 14] : [4, 12];
      if (this.intensity >= 25 && hatSteps.includes(step)) this.playHiHat(time);

      // 4. BASSLINE — drives 8ths on the bar root. Upper-neighbor pickups on
      // bars 1/3 and an octave poke late in the phrase keep it from flatlining.
      if (step % 2 === 0) {
          const onKick = kickSteps.includes(step);
          if (!onKick || drumsFull) {
              let note = root;
              if (step === 14 && (phraseBar === 1 || phraseBar === 3)) note *= 4 / 3; // P4 pickup
              else if (step === 10 && phraseBar >= 2) note *= 2;
              this.playBass(time, note);
          }
      }

      // 5. GENERATIVE ARP — walks the pentatonic around the bar root instead of
      // darting randomly. Stepwise motion reads as melody; jumps stay rare.
      const scaleDegrees = [0, 3, 5, 7, 10, 12, 15, 17]; // minor pentatonic, two octaves
      const chance = drumsFull ? 0.65 : this.intensity >= 25 ? 0.4 : 0.15;
      if (Math.random() < chance) {
          if (Math.random() < 0.6) this.arpStep += Math.random() < 0.5 ? 1 : -1;
          else this.arpStep += Math.random() < 0.5 ? 2 : -2;
          this.arpStep = ((this.arpStep % scaleDegrees.length) + scaleDegrees.length) % scaleDegrees.length;
          const freq = root * 4 * Math.pow(2, scaleDegrees[this.arpStep] / 12);
          this.playArp(time, freq);
      }
  }

  private scheduler() {
      // while there are notes that will need to play before the next interval, 
      // schedule them and advance the pointer.
      while (this.nextNoteTime < this.ctx!.currentTime + this.scheduleAheadTime) {
          this.scheduleNote(this.current16thNote, this.nextNoteTime);
          this.nextNote();
      }
      if (this.isPlaying) {
          this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
      }
  }

  // --- PUBLIC API ---

  /** Keystroke and event sounds — independent of the soundtrack. */
  public isSoundEnabled() {
      return this.soundEnabled;
  }

  public isMusicEnabled() {
      return this.musicEnabled;
  }

  /**
   * Opens the audio context from a real user gesture and starts the soundtrack
   * if the player has not muted it. Safe to call on every gesture.
   */
  public unlock() {
      if (!this.soundEnabled && !this.musicEnabled) return;
      if (!this.initContext()) return;
      if (this.ctx!.state === 'suspended') this.ctx!.resume();
      if (this.musicEnabled && !this.isPlaying) this.startMusic();
  }

  /**
   * Turns keystroke/event sounds on or off and remembers the choice. The music
   * bus is untouched — muting keys never silences the soundtrack.
   */
  public setSoundEnabled(on: boolean) {
      this.soundEnabled = on;
      try {
          window.localStorage.setItem(SFX_ENABLED_STORAGE_KEY, on ? '1' : '0');
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      if (on) {
          if (!this.initContext()) return this.soundEnabled;
          if (this.ctx!.state === 'suspended') this.ctx!.resume();
      }
      return this.soundEnabled;
  }

  public toggleSound() {
      return this.setSoundEnabled(!this.soundEnabled);
  }

  /** Keystroke loudness, 0..1. Persists as a percentage; applies live. */
  public getSoundVolume() {
      return this.soundVolume;
  }

  public setSoundVolume(v: number) {
      this.soundVolume = clampVolume(v * 100);
      try {
          window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(Math.round(this.soundVolume * 100)));
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      if (this.ctx && this.sfxGain) {
          this.sfxGain.gain.setTargetAtTime(this.soundVolume, this.ctx.currentTime, 0.05);
      }
      return this.soundVolume;
  }

  /** Soundtrack loudness, 0..1 — multiplies the music bus level, duck included. */
  public getMusicVolume() {
      return this.musicVolume;
  }

  public setMusicVolume(v: number) {
      this.musicVolume = clampVolume(v * 100);
      try {
          window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(Math.round(this.musicVolume * 100)));
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      if (this.ctx && this.masterGain && this.isPlaying) {
          this.masterGain.gain.setTargetAtTime((this.ducked ? 0.08 : 0.4) * this.musicVolume, this.ctx.currentTime, 0.05);
      }
      return this.musicVolume;
  }

  /**
   * Turns the soundtrack on or off and remembers the choice. Muting is a
   * deliberate player decision, so starting a run must never undo it.
   */
  public setMusicEnabled(on: boolean) {
      this.musicEnabled = on;
      try {
          window.localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, on ? '1' : '0');
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      if (on) {
          if (!this.initContext()) return this.musicEnabled;
          if (this.ctx!.state === 'suspended') this.ctx!.resume();
          if (!this.isPlaying) this.startMusic();
      } else if (this.isPlaying) {
          this.stopMusic();
      }
      return this.musicEnabled;
  }

  public toggleMusic() {
      return this.setMusicEnabled(!this.musicEnabled);
  }

  public getSwitchProfile(): SwitchProfile {
      return this.switchProfile;
  }

  /** Remembers the switch sound and plays one key of it as a preview. */
  public setSwitchProfile(profile: SwitchProfile) {
      this.switchProfile = profile;
      try {
          window.localStorage.setItem(SWITCH_PROFILE_STORAGE_KEY, profile);
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      this.lastKeyAt = 0;
      this.keyHit(0);
      return profile;
  }

  // --- SFX ---

  // Mechanical switch: noise contact, a low case body, and for clicky a
  // double click. Each key is detuned so a streak never repeats one sample.
  private switchHit(ctx: AudioContext, bus: GainNode, now: number, tier: ComboTier, vel: number) {
      const vary = 1 + (Math.random() - 0.5) * 0.14;
      if (this.switchProfile === 'thock') {
          this.noiseBurst(ctx, bus, now, { duration: 0.05, gain: 0.16 * (0.75 + vel * 0.35), type: 'lowpass', frequency: (900 + tier * 120) * vary, Q: 1.4 });
          this.blip(ctx, bus, now, { freq: 150 * vary, endFreq: 95, duration: 0.06, gain: 0.1, type: 'sine', cutoff: 900 });
          this.noiseBurst(ctx, bus, now + 0.004, { duration: 0.012, gain: 0.025, type: 'bandpass', frequency: 2600 * vary, Q: 2 });
          return;
      }
      // clicky
      this.noiseBurst(ctx, bus, now, { duration: 0.01, gain: 0.14, type: 'bandpass', frequency: 4200 * vary, Q: 3.5 });
      this.noiseBurst(ctx, bus, now + 0.011, { duration: 0.012, gain: 0.09, type: 'bandpass', frequency: 3400 * vary, Q: 3 });
      this.noiseBurst(ctx, bus, now + 0.014, { duration: 0.035, gain: 0.07 * (0.8 + vel * 0.3), type: 'lowpass', frequency: 1800 * vary, Q: 1 });
      this.blip(ctx, bus, now + 0.012, { freq: 260 * vary, endFreq: 180, duration: 0.035, gain: 0.04, type: 'triangle', cutoff: 1600 });
  }

  /**
   * One correct keystroke. The ladder is a two-octave pentatonic: fast streaks
   * climb it, pauses let it settle back down — the run's own rhythm writes the
   * melody. `tier` (from the combo ladder) raises the octave and opens the
   * filter so a big combo is audibly brighter than a cold start.
   */
  private lastKeyAt = 0;

  public keyHit(tier: ComboTier = 0) {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;

      const LADDER = PENTATONIC_SEMITONES.length * 2;
      const dt = this.lastKeyAt === 0 ? Infinity : (now - this.lastKeyAt) * 1000;
      this.lastKeyAt = now;
      if (dt < 140) this.keyStep = Math.min(this.keyStep + 1, LADDER - 1);
      else if (dt > 450) this.keyStep = Math.max(this.keyStep - 2, 0);

      const degree = this.keyStep % PENTATONIC_SEMITONES.length;
      const loopOctave = Math.floor(this.keyStep / PENTATONIC_SEMITONES.length);
      const baseOctave = tier >= 3 ? 1 : tier >= 2 ? 0 : -1;
      // A few cents of drift keeps a long streak from sounding like a sequencer.
      const freq = noteFreq(PENTATONIC_SEMITONES[degree], baseOctave + loopOctave)
          * (1 + (Math.random() - 0.5) * 0.008);

      // Velocity: keystrokes that land hot hit brighter and a touch louder.
      const vel = dt < 100 ? 1 : dt < 200 ? 0.7 : dt < 400 ? 0.45 : 0.3;
      if (this.switchProfile !== 'melodic') {
          this.switchHit(ctx, bus, now, tier, vel);
          return;
      }
      this.blip(ctx, bus, now, {
          freq,
          duration: 0.075,
          gain: (0.05 + tier * 0.012) * (0.7 + vel * 0.6),
          type: 'triangle',
          cutoff: 2600 + tier * 1400 + vel * 800
      });
      this.noiseBurst(ctx, bus, now, {
          duration: 0.018,
          gain: 0.03 + tier * 0.006,
          type: 'highpass',
          frequency: 4200
      });

      // Phrase accent: every eighth step gets a soft sub-octave shadow, so a
      // streak reads as musical phrases instead of a scale exercise.
      if (this.keyStep % 8 === 7) {
          this.blip(ctx, bus, now, { freq: freq / 2, duration: 0.22, gain: 0.05, type: 'sine' });
      }
  }

  /** A counted mistake: detuned low thud, deliberately sour against the key. */
  public keyError() {
      // Reset before the audibility guard: a muted run still breaks the combo.
      this.keyStep = 0;
      this.lastKeyAt = 0;
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: 104, endFreq: 62, duration: 0.2, gain: 0.24, type: 'square', cutoff: 900 });
      this.blip(ctx, bus, now, { freq: 98, endFreq: 60, duration: 0.2, gain: 0.16, type: 'sawtooth', cutoff: 700 });
      this.noiseBurst(ctx, bus, now, { duration: 0.09, gain: 0.11, type: 'lowpass', frequency: 1400 });
  }

  /** A mistake absorbed by Firewall or grace — soft, clearly not a failure. */
  public shield() {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: 880, endFreq: 1320, duration: 0.16, gain: 0.13, type: 'sine', cutoff: 5200 });
      this.noiseBurst(ctx, bus, now, { duration: 0.12, gain: 0.05, type: 'bandpass', frequency: 2400, Q: 6 });
  }

  /** An active protocol just became affordable. */
  public skillReady() {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: noteFreq(0, 0), duration: 0.1, gain: 0.1, type: 'triangle' });
      this.blip(ctx, bus, now + 0.08, { freq: noteFreq(7, 0), duration: 0.16, gain: 0.11, type: 'triangle' });
  }

  /** Focus Mode engaged: rising fifth plus a noise sweep. */
  public focusStart() {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: noteFreq(0, -1), endFreq: noteFreq(0, 1), duration: 0.5, gain: 0.2, type: 'sawtooth', cutoff: 3400 });
      this.blip(ctx, bus, now + 0.06, { freq: noteFreq(7, 0), duration: 0.45, gain: 0.12, type: 'sine' });
      this.noiseBurst(ctx, bus, now, { duration: 0.42, gain: 0.09, type: 'bandpass', frequency: 1800, Q: 2 });
  }

  /** Focus Mode expired: the same gesture, falling. */
  public focusEnd() {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: noteFreq(0, 1), endFreq: noteFreq(0, -1), duration: 0.35, gain: 0.13, type: 'sawtooth', cutoff: 2200 });
  }

  /** Security Trace purged: a downward wash, the pressure visibly dropping. */
  public purge() {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: noteFreq(10, 0), endFreq: noteFreq(0, -1), duration: 0.4, gain: 0.16, type: 'triangle', cutoff: 2800 });
      this.noiseBurst(ctx, bus, now, { duration: 0.34, gain: 0.08, type: 'lowpass', frequency: 2600 });
  }

  /**
   * The tracer reached your caret. Deliberately the ugliest sound in the game:
   * a falling detuned pair under a noise sweep.
   */
  public tracerCatch() {
      // Reset before the audibility guard: a muted run still breaks the combo.
      this.keyStep = 0;
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      this.blip(ctx, bus, now, { freq: 220, endFreq: 55, duration: 0.55, gain: 0.26, type: 'sawtooth', cutoff: 1200 });
      this.blip(ctx, bus, now, { freq: 233, endFreq: 58, duration: 0.55, gain: 0.2, type: 'square', cutoff: 900 });
      this.noiseBurst(ctx, bus, now, { duration: 0.4, gain: 0.16, type: 'bandpass', frequency: 900, Q: 1.5 });
  }

  /** End-of-segment stinger, pitched by how the line went. */
  public segmentClear(performance: 'good' | 'average' | 'bad') {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      if (performance === 'good') {
          [0, 3, 7].forEach((semitone, index) => {
              this.blip(ctx, bus, now + (index * 0.055), { freq: noteFreq(semitone, 0), duration: 0.2, gain: 0.12, type: 'triangle' });
          });
      } else if (performance === 'average') {
          this.blip(ctx, bus, now, { freq: noteFreq(0, 0), duration: 0.18, gain: 0.1, type: 'triangle' });
      } else {
          this.blip(ctx, bus, now, { freq: noteFreq(1, -1), endFreq: noteFreq(0, -2), duration: 0.34, gain: 0.15, type: 'sawtooth', cutoff: 900 });
      }
  }

  // --- MUSIC ---

  private startMusic() {
      if (!this.initContext()) return;
      if (this.ctx!.state === 'suspended') this.ctx!.resume();
      this.isPlaying = true;
      this.bar = 0;
      // Fade In — scaled by the player's music volume
      this.masterGain?.gain.setTargetAtTime((this.ducked ? 0.08 : 0.4) * this.musicVolume, this.ctx!.currentTime, 0.5);

      this.startDrone();

      // Reset Sequencer
      this.current16thNote = 0;
      this.nextNoteTime = this.ctx!.currentTime + 0.1;
      this.scheduler();
  }

  private stopMusic() {
      this.isPlaying = false;
      if (!this.ctx) return;
      // Fade Out
      this.masterGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      if (this.timerID) clearTimeout(this.timerID);
      setTimeout(() => this.stopDrone(), 200);
  }

  public setIntensity(val: number) {
      // Smoothly update intensity — the music bus filter opens with it, so a
      // rising trace literally brightens the soundtrack.
      this.intensity = val;
      if (this.ctx && this.musicFilter) {
          this.musicFilter.frequency.setTargetAtTime(400 + val * 40, this.ctx.currentTime, 0.4);
      }
  }

  /**
   * Decisions sink the soundtrack to a whisper so the pause reads physically.
   * The SFX bus is untouched — the choice itself still lands with an accent.
   */
  public duckMusic(ducked: boolean) {
      // Track the flag even while silent so a track started mid-decision opens
      // already ducked instead of blaring then sinking.
      this.ducked = ducked;
      if (!this.ctx || !this.masterGain || !this.isPlaying) return;
      this.masterGain.gain.setTargetAtTime((ducked ? 0.08 : 0.4) * this.musicVolume, this.ctx.currentTime, 0.35);
  }

  /** The choice lands: a low hit for aggression, a soft pulse for stealth. */
  public decisionAccent(kind: 'aggressive' | 'stealth') {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;
      if (kind === 'aggressive') {
          this.blip(ctx, bus, now, { freq: 110, endFreq: 55, duration: 0.4, gain: 0.22, type: 'sawtooth', cutoff: 1400 });
          this.noiseBurst(ctx, bus, now, { duration: 0.3, gain: 0.12, type: 'lowpass', frequency: 1800 });
      } else {
          this.blip(ctx, bus, now, { freq: noteFreq(7, -1), duration: 0.35, gain: 0.12, type: 'sine' });
          this.blip(ctx, bus, now + 0.1, { freq: noteFreq(0, 0), duration: 0.3, gain: 0.08, type: 'sine' });
      }
  }
}

export const audioEngine = new NeuralAudioEngine();
