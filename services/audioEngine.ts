/**
 * NARRATIVE FLOW - PROCEDURAL AUDIO ENGINE (NEURAL-LINK CORE)
 * Version: 2.0.0 (Sequencer Upgrade)
 * Engineering: Neural-Link Audio Synthesis Subsystem
 * 
 * Implements a precise scheduling system for rhythmic stability.
 */

export const AUDIO_ENABLED_STORAGE_KEY = 'typomancerAudioEnabled';

// A minor pentatonic, in semitones from A. The keystroke voice walks this scale so
// typing arpeggiates in the same key as the sequencer instead of clicking atonally.
const PENTATONIC_SEMITONES = [0, 3, 5, 7, 10];
const noteFreq = (semitone: number, octave: number) => 440 * Math.pow(2, (semitone + (octave * 12)) / 12);

export type ComboTier = 0 | 1 | 2 | 3;

class NeuralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  /**
   * SFX live on their own bus wired straight to the destination. The music bus is
   * faded to zero whenever the sequencer is off, so routing keystrokes through it
   * would silence every hit for anyone who plays without the soundtrack.
   */
  private sfxGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private enabled: boolean = true;
  private keyStep = 0;

  // Sequencer State
  private tempo = 110;
  private lookahead = 25.0; // ms
  private scheduleAheadTime = 0.1; // s
  private nextNoteTime = 0.0;
  private current16thNote = 0;
  private timerID: number | null = null;
  private intensity = 0; // 0 to 100

  // Persistent Nodes
  private droneNodes: AudioNode[] = [];

  constructor() {
    try {
      this.enabled = window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY) !== '0';
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
      this.enabled = true;
    }
  }

  /** Returns false when the browser refuses us an audio context at all. */
  private initContext(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.sfxGain.gain.setValueAtTime(1, this.ctx.currentTime);
    } catch {
      // No audio output available. Everything below degrades to a silent no-op
      // rather than taking the typing loop down with it.
      this.ctx = null;
      return false;
    }
    return true;
  }

  /**
   * Returns the SFX bus only when we are allowed to make noise right now: audio
   * enabled, context built, and the browser has actually granted us playback.
   */
  private sfxBus(): { ctx: AudioContext; bus: GainNode; now: number } | null {
    if (!this.enabled) return null;
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
    
    // Punchy Kick: Fast frequency sweep
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.5);
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
     noiseGain.gain.setValueAtTime(0.3, time);
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
     // Velocity variation
     const velocity = 0.1 + (Math.random() * 0.05);
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
      filter.frequency.setValueAtTime(600, time);
      filter.frequency.exponentialRampToValueAtTime(100, time + 0.2); // Pluck envelope
      filter.Q.value = 2;

      gain.gain.setValueAtTime(0.4, time);
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
      // High pingy synth
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      
      // Simple stereo width (random pan)
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.random() * 2 - 1;

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + 0.2);
  }

  // --- ATMOSPHERICS ---

  private startDrone() {
     if (!this.ctx || !this.masterGain || this.droneNodes.length > 0) return;

     // Function to create a single drone voice
     const createDroneVoice = (freq: number, type: OscillatorType, pan: number) => {
         const osc = this.ctx!.createOscillator();
         const gain = this.ctx!.createGain();
         const panner = this.ctx!.createStereoPanner();
         const filter = this.ctx!.createBiquadFilter();

         osc.type = type;
         osc.frequency.value = freq;

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
     };
     
     // Root A1 (55Hz) drone cluster
     createDroneVoice(55.00, 'sawtooth', -0.5);
     createDroneVoice(55.50, 'sawtooth', 0.5); // Detuned stereo
     createDroneVoice(110.00, 'sine', 0); // Octave up sine for warmth
  }
  
  private stopDrone() {
      this.droneNodes.forEach(node => {
          if (node instanceof OscillatorNode) {
            try { node.stop(); } catch(e){}
          }
          node.disconnect();
      });
      this.droneNodes = [];
  }

  // --- SEQUENCER SCHEDULER ---
  
  private nextNote() {
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += 0.25 * secondsPerBeat; // Advance by 1/16th note
      this.current16thNote++;
      if (this.current16thNote === 16) {
          this.current16thNote = 0;
      }
  }

  private scheduleNote(beatNumber: number, time: number) {
      // beatNumber is 0..15 (16th notes in a 4/4 bar)
      
      // 1. KICK (Four on the floor)
      if (beatNumber % 4 === 0) {
          this.playKick(time);
      }
      
      // 2. SNARE/CLAP (On 2 and 4) -> 16th index 4 and 12
      if (beatNumber === 4 || beatNumber === 12) {
          this.playSnare(time);
      }

      // 3. HIHATS (Offbeats + some fills)
      if (beatNumber % 2 !== 0) {
          this.playHiHat(time);
      }
      
      // 4. BASSLINE (Driving 8ths, root F# or A)
      // Root 43.65 (F1) or 55 (A1). Let's go A1 to match drone.
      const root = 55; 
      if (beatNumber % 2 === 0) {
          // Don't play bass on the Kick impacts to clean up mix (Sidechain feel)
          if (beatNumber !== 0 && beatNumber !== 4 && beatNumber !== 8 && beatNumber !== 12) {
              this.playBass(time, root);
          } else if (this.intensity > 50) {
              // At high intensity, play bass on kick too for wall-of-sound
              this.playBass(time, root);
          }
      }

      // 5. GENERATIVE ARP (Based on intensity)
      // Scales with intensity. 
      // Pentatonic Minor: A, C, D, E, G (A Minor Pentatonic)
      const scale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
      
      // Chance increases with intensity (0.1 to 0.8)
      const chance = 0.1 + (this.intensity / 130);
      
      // Play on 16ths randomly
      if (Math.random() < chance) {
          const note = scale[Math.floor(Math.random() * scale.length)];
          this.playArp(time, note);
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

  public isEnabled() {
      return this.enabled;
  }

  /**
   * Opens the audio context from a real user gesture and starts the soundtrack if
   * the player has not explicitly muted it. Safe to call on every gesture.
   */
  public unlock() {
      if (!this.enabled) return;
      if (!this.initContext()) return;
      if (this.ctx!.state === 'suspended') this.ctx!.resume();
      if (!this.isPlaying) this.startMusic();
  }

  /**
   * Turns all audio on or off and remembers the choice. Muting is a deliberate
   * player decision, so starting a run must never silently undo it.
   */
  public setEnabled(on: boolean) {
      this.enabled = on;
      try {
          window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, on ? '1' : '0');
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      if (on) {
          if (!this.initContext()) return this.enabled;
          if (this.ctx!.state === 'suspended') this.ctx!.resume();
          if (!this.isPlaying) this.startMusic();
      } else if (this.isPlaying) {
          this.stopMusic();
      }
      return this.enabled;
  }

  public toggle() {
      return this.setEnabled(!this.enabled);
  }

  // --- SFX ---

  /**
   * One correct keystroke. Walks the pentatonic so a clean streak arpeggiates
   * upward; `tier` (from the combo ladder) raises the octave and opens the filter
   * so a big combo is audibly brighter than a cold start.
   */
  public keyHit(tier: ComboTier = 0) {
      const ch = this.sfxBus();
      if (!ch) return;
      const { ctx, bus, now } = ch;

      const degree = this.keyStep % PENTATONIC_SEMITONES.length;
      const loopOctave = Math.floor(this.keyStep / PENTATONIC_SEMITONES.length) % 2;
      this.keyStep = (this.keyStep + 1) % (PENTATONIC_SEMITONES.length * 2);

      const baseOctave = tier >= 3 ? 1 : tier >= 2 ? 0 : -1;
      const freq = noteFreq(PENTATONIC_SEMITONES[degree], baseOctave + loopOctave);

      this.blip(ctx, bus, now, {
          freq,
          duration: 0.075,
          gain: 0.05 + (tier * 0.012),
          type: 'triangle',
          cutoff: 2600 + (tier * 1400)
      });
      this.noiseBurst(ctx, bus, now, {
          duration: 0.018,
          gain: 0.03 + (tier * 0.006),
          type: 'highpass',
          frequency: 4200
      });
  }

  /** A counted mistake: detuned low thud, deliberately sour against the key. */
  public keyError() {
      // Reset before the audibility guard: a muted run still breaks the combo.
      this.keyStep = 0;
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

      // Fade In
      this.masterGain?.gain.setTargetAtTime(0.4, this.ctx!.currentTime, 0.5);

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
      // Smoothly update intensity
      this.intensity = val;
  }

  /**
   * Decisions sink the soundtrack to a whisper so the pause reads physically.
   * The SFX bus is untouched — the choice itself still lands with an accent.
   */
  public duckMusic(ducked: boolean) {
      if (!this.ctx || !this.masterGain || !this.isPlaying) return;
      this.masterGain.gain.setTargetAtTime(ducked ? 0.08 : 0.4, this.ctx.currentTime, 0.35);
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
