/**
 * NARRATIVE FLOW - PROCEDURAL AUDIO ENGINE (NEURAL-LINK CORE)
 * Version: 2.0.0 (Sequencer Upgrade)
 * Engineering: Neural-Link Audio Synthesis Subsystem
 * 
 * Implements a precise scheduling system for rhythmic stability.
 */

class NeuralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  
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

  constructor() {}

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
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

  public toggle() {
      this.initContext();
      if (this.ctx!.state === 'suspended') {
        this.ctx!.resume();
      }
      
      this.isPlaying = !this.isPlaying;
      
      if (this.isPlaying) {
          // Fade In
          this.masterGain?.gain.setTargetAtTime(0.4, this.ctx!.currentTime, 0.5);
          
          this.startDrone();
          
          // Reset Sequencer
          this.current16thNote = 0;
          this.nextNoteTime = this.ctx!.currentTime + 0.1;
          this.scheduler();
      } else {
          // Fade Out
          this.masterGain?.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.1);
          if (this.timerID) clearTimeout(this.timerID);
          setTimeout(() => this.stopDrone(), 200); 
      }
      
      return this.isPlaying;
  }
  
  public setIntensity(val: number) {
      // Smoothly update intensity
      this.intensity = val;
  }
}

export const audioEngine = new NeuralAudioEngine();
