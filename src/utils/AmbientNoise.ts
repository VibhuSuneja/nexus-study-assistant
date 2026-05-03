// Ambient noise utility using Web Audio API

export type NoiseType = 'rain' | 'white' | 'lofi' | 'forest';

export class AmbientNoise {
  private static audioCtx: any | null = null;
  private static sources: Partial<Record<NoiseType, { oscillator?: any, gain: any, filter?: any, bufferSource?: any }>> = {};
  private static lofiStream: HTMLAudioElement | null = null;

  private static initContext() {
    if (!this.audioCtx) {
      // @ts-ignore
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  static async start(type: NoiseType, volume: number = 0.5) {
    this.initContext();
    if (this.sources[type]) return;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    gainNode.connect(this.audioCtx.destination);

    if (type === 'white') {
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const source = this.audioCtx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      source.start();
      this.sources[type] = { bufferSource: source, gain: gainNode, filter };
    } else if (type === 'rain') {
      // Simulate rain with brown noise + filter
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // brown noise is quiet
      }
      const source = this.audioCtx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.audioCtx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      source.start();
      this.sources[type] = { bufferSource: source, gain: gainNode, filter };
    } else if (type === 'forest') {
      // Simulate forest with low-pass pink noise + some chirps (sine waves)
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; // pink noise
        b6 = white * 0.115926;
      }
      const source = this.audioCtx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, this.audioCtx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      source.start();
      this.sources[type] = { bufferSource: source, gain: gainNode, filter };
    } else if (type === 'lofi') {
      // Use a sample URL for lofi or simulate with lofi-ish oscillators
      // For now, let's use a public stream if possible or just some rhythmic low-pass noise
      const lofiAudio = new Audio('https://stream.zeno.fm/0r0xa792kwzuv'); // Example lofi stream
      lofiAudio.crossOrigin = "anonymous";
      lofiAudio.volume = volume;
      lofiAudio.play().catch(e => console.warn("Lofi play blocked:", e));
      this.lofiStream = lofiAudio;
      this.sources[type] = { gain: { gain: { set value(v: number) { lofiAudio.volume = v; } } } as any };
    }
  }

  static stop(type?: NoiseType) {
    if (type) {
      if (type === 'lofi' && this.lofiStream) {
        this.lofiStream.pause();
        this.lofiStream = null;
      }
      const source = this.sources[type];
      if (source) {
        if (source.bufferSource) source.bufferSource.stop();
        if (source.oscillator) source.oscillator.stop();
        delete this.sources[type];
      }
    } else {
      Object.keys(this.sources).forEach(k => this.stop(k as NoiseType));
      if (this.lofiStream) {
        this.lofiStream.pause();
        this.lofiStream = null;
      }
    }
  }

  static setVolume(val: number, type?: NoiseType) {
    if (type) {
      const source = this.sources[type];
      if (source && source.gain) {
        source.gain.gain.setValueAtTime(val, this.audioCtx?.currentTime || 0);
      }
    } else {
      Object.values(this.sources).forEach(s => {
        if (s?.gain) s.gain.gain.setValueAtTime(val, this.audioCtx?.currentTime || 0);
      });
    }
  }
}
