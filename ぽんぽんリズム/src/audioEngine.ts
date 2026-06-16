import { InstrumentType } from './types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private soundVolume: GainNode | null = null;
  private melodyVolume: GainNode | null = null;
  private scheduledSources: { osc: OscillatorNode; gain: GainNode; stopTime: number }[] = [];

  constructor() {
    // Lazy loaded context to satisfy browser policies
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.8, this.ctx.currentTime);
      
      this.soundVolume = this.ctx.createGain();
      this.soundVolume.gain.setValueAtTime(0.7, this.ctx.currentTime);
      
      this.melodyVolume = this.ctx.createGain();
      this.melodyVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);

      this.soundVolume.connect(this.masterVolume);
      this.melodyVolume.connect(this.masterVolume);
      this.masterVolume.connect(this.ctx.destination);
    } catch (e) {
      console.error('Web Audio API not supported', e);
    }
  }

  getContext() {
    this.init();
    return this.ctx;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMelodyVolume(val: number) {
    this.init();
    if (this.melodyVolume && this.ctx) {
      this.melodyVolume.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setSoundVolume(val: number) {
    this.init();
    if (this.soundVolume && this.ctx) {
      this.soundVolume.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  stopAllScheduled() {
    this.scheduledSources.forEach((item) => {
      try {
        item.osc.stop();
      } catch (e) {
        // Already stopped or scheduled
      }
    });
    this.scheduledSources = [];
  }

  getFrequencyOfNote(noteName: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const regex = /^([A-G]#?)([0-9])$/;
    const match = noteName.match(regex);
    if (!match) return 440;
    const name = match[1];
    const octave = parseInt(match[2], 10);
    const semitone = notes.indexOf(name);
    const midi = 12 * (octave + 1) + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Play a beautiful synthesized nursery/kids background melody note precisely
  playMelodyNote(noteName: string, startTime: number, duration: number) {
    this.init();
    if (!this.ctx || !this.melodyVolume) return;

    const freq = this.getFrequencyOfNote(noteName);
    if (freq <= 0) return; // Rest note

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Kids love soft marimba/sinusoidal key sound
    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.03);
    gain.gain.setValueAtTime(0.3, startTime + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.melodyVolume);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.scheduledSources.push({ osc, gain, stopTime: startTime + duration });
  }

  // Interactive user touch drums
  playInstrument(type: InstrumentType, userTriggered = true) {
    this.init();
    if (!this.ctx || !this.soundVolume) return;

    this.resume();

    const dest = this.soundVolume;
    const now = this.ctx.currentTime;

    switch (type) {
      case 'drum': {
        // Fat, bassy kid drum sound (Taiko style)
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.25);

        oscGain.gain.setValueAtTime(0.8, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(oscGain);
        oscGain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }

      case 'bell': {
        // Ting Chime sound
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5

        // Chime overtone
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1975.54, now); // B6

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(dest);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.5);
        osc2.stop(now + 0.5);
        break;
      }

      case 'cat': {
        // Cute, electronic cat meow "Nya~" using frequency sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, now);
        // Cat meow pitch sweep upward
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.35);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now);
        osc.stop(now + 0.36);
        break;
      }

      case 'dog': {
        // Playful short puppy bark "Waf!"
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        // Low pass filter to make it sound muffled/puppy-like
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }

      case 'frog': {
        // Playful frog ribbit / bubble "Kerokero"
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Modulate with rapid LFO to create a croak texture
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sawtooth';
        lfo.frequency.setValueAtTime(45, now); // 45 Hz flutter
        lfoGain.gain.setValueAtTime(80, now); // FM depth

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, now); // C4

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(dest);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + 0.25);
        osc.stop(now + 0.25);
        break;
      }
    }
  }

  // Play standard UI sound response (Success chime, Level up fanfare, etc.)
  playUIAudio(type: 'success' | 'click' | 'fail' | 'levelUp') {
    this.init();
    if (!this.ctx || !this.soundVolume) return;
    this.resume();

    const dest = this.soundVolume;
    const now = this.ctx.currentTime;

    switch (type) {
      case 'click': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case 'success': {
        // Cute double chime
        const playTing = (timeOffset: number, pitch: number) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(pitch, now + timeOffset);
          gain.gain.setValueAtTime(0.3, now + timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.2);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now + timeOffset);
          osc.stop(now + timeOffset + 0.21);
        };
        playTing(0, 523.25); // C5
        playTing(0.1, 659.25); // E5
        break;
      }
      case 'levelUp': {
        // Cute triple upbeat arpeggio
        const playChime = (timeOffset: number, pitch: number) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(pitch, now + timeOffset);
          gain.gain.setValueAtTime(0.4, now + timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.3);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now + timeOffset);
          osc.stop(now + timeOffset + 0.31);
        };
        playChime(0, 523.25); // C5
        playChime(0.08, 659.25); // E5
        playChime(0.16, 783.99); // G5
        playChime(0.24, 1046.5); // C6
        break;
      }
      case 'fail': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.25);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }
    }
  }
}

export const audioEngine = new AudioEngine();
