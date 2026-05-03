/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  public analyser: AnalyserNode | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private inputAnalyser: AnalyserNode | null = null;

  public getVolume(): number {
    const outputLevel = this._getAnalyserLevel(this.analyser);
    const inputLevel = this._getAnalyserLevel(this.inputAnalyser);
    return Math.max(outputLevel, inputLevel);
  }

  private _getAnalyserLevel(analyser: AnalyserNode | null): number {
    if (!analyser) return 0;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length;
  }

  async startInput(onData: (base64: string) => void) {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ sampleRate: 16000 });
    }
    
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);

      this.inputAnalyser = this.audioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      source.connect(this.inputAnalyser);

      // Create a ScriptProcessorNode to handle raw PCM data
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          const s = Math.max(-1, Math.min(1, channelData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const buffer = new Uint8Array(pcm16.buffer);
        let binaryString = "";
        for (let i = 0; i < buffer.byteLength; i++) {
          binaryString += String.fromCharCode(buffer[i]);
        }
        onData(btoa(binaryString));
      };

      source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);
    } catch (e) {
      console.error("Error starting audio input:", e);
      throw e;
    }
  }

  initOutput() {
    if (this.outputAudioCtx) return;
    this.outputAudioCtx = new AudioContext({ sampleRate: 24000 });
    this.analyser = this.outputAudioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.outputAudioCtx.destination);
    this.nextStartTime = this.outputAudioCtx.currentTime;
  }

  async resumeOutput() {
    if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
    }
  }

  async playOutput(base64: string) {
    if (!this.outputAudioCtx || !this.analyser) return;

    if (this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
    }

    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16View = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        float32Data[i] = int16View[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyser);
      source.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== source);
      };
      this.activeSources.push(source);

      const now = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now;
      }
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } catch (e) {
      console.error("Error playing audio output:", e);
    }
  }

  stopOutput() {
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  cleanup() {
    this.stopOutput();
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      this.outputAudioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.outputAudioCtx = null;
    this.analyser = null;
    this.inputAnalyser = null;
    this.processor = null;
    this.mediaStream = null;
    this.activeSources = [];
  }
}

export class ScreenStreamer {
  private displayStream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private timer: any;
  private lastFrame: string | null = null;

  async start(onData: (base64: string) => void) {
    // Use flexible constraints to avoid browser refusal (e.g. Chrome's strict monitor policy)
    this.displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { max: 1280 },
        height: { max: 720 },
        frameRate: { max: 5 } // Low FPS is fine for vision tasks, saves bandwidth
      },
      audio: false,
    });

    this.video = document.createElement("video");
    this.video.srcObject = this.displayStream;
    this.video.muted = true;
    
    // Wait for video to be ready before starting timer
    await new Promise((resolve) => {
      this.video!.onloadedmetadata = () => {
        this.video!.play().then(resolve);
      };
    });

    this.canvas = document.createElement("canvas");
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext("2d", { alpha: false }); // performance optimization

    this.displayStream.getVideoTracks()[0].addEventListener('ended', () => {
      this.cleanup();
    });

    this.timer = setInterval(() => {
      if (!this.ctx || !this.video || !this.canvas) return;
      if (this.video.readyState < 2) return;
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const dataUrl = this.canvas.toDataURL("image/jpeg", 0.6);
      const base64 = dataUrl.split(",")[1];
      this.lastFrame = base64;
      onData(base64);
    }, 2000); // 2 second interval is plenty for vision context and much lighter on CPU
  }

  getLastFrame() {
    return this.lastFrame;
  }

  cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    if (this.displayStream) {
      this.displayStream.getTracks().forEach((t) => t.stop());
    }
    this.displayStream = null;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.lastFrame = null;
  }
}

// ─── Ambient Noise Generator ──────────────────────────────────────────────────

export class AmbientNoise {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nodes: AudioNode[] = [];

  async start(type: 'rain' | 'coffee' | 'waves') {
    this.stop(); // clean up previous
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 1);
    this.gainNode.connect(this.ctx.destination);

    switch (type) {
      case 'rain':
        this._buildRain();
        break;
      case 'coffee':
        this._buildCoffee();
        break;
      case 'waves':
        this._buildWaves();
        break;
    }
  }

  private _bufferNoise(ctx: AudioContext, durationSec = 2): AudioBuffer {
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * durationSec, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private _loopBuffer(buf: AudioBuffer): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  private _buildRain() {
    const ctx = this.ctx!;
    // White noise → highpass for rain texture
    const buf = this._bufferNoise(ctx, 3);
    const src = this._loopBuffer(buf);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 10000;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(this.gainNode!);
    src.start();
    this.nodes.push(src, hp, lp);

    // Drip layer — periodic soft clicks
    const dripLoop = () => {
      if (!this.ctx || !this.gainNode) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 800 + Math.random() * 600;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.04, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(env);
      env.connect(this.gainNode!);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      setTimeout(dripLoop, 60 + Math.random() * 200);
    };
    dripLoop();
  }

  private _buildCoffee() {
    const ctx = this.ctx!;
    // Bandpass noise = crowd murmur
    const buf = this._bufferNoise(ctx, 4);
    const src = this._loopBuffer(buf);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2500;

    src.connect(bp);
    bp.connect(lp);
    lp.connect(this.gainNode!);
    src.start();
    this.nodes.push(src, bp, lp);

    // Occasional cup clink
    const clinkLoop = () => {
      if (!this.ctx || !this.gainNode) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 1200 + Math.random() * 400;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.06, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(env);
      env.connect(this.gainNode!);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setTimeout(clinkLoop, 3000 + Math.random() * 7000);
    };
    clinkLoop();
  }

  private _buildWaves() {
    const ctx = this.ctx!;
    // Low rumble + periodic swell
    const buf = this._bufferNoise(ctx, 4);
    const src = this._loopBuffer(buf);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;

    // LFO for wave swell
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18; // ~1 wave per 5 seconds
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain);
    lfoGain.connect(this.gainNode!.gain);
    lfo.start();

    src.connect(lp);
    lp.connect(this.gainNode!);
    src.start();
    this.nodes.push(src, lp, lfo, lfoGain);

    // White crash layer
    const crashBuf = this._bufferNoise(ctx, 2);
    const crashSrc = this._loopBuffer(crashBuf);
    const crashHp = ctx.createBiquadFilter();
    crashHp.type = 'highpass';
    crashHp.frequency.value = 1500;
    const crashGain = ctx.createGain();
    crashGain.gain.value = 0.08;
    crashSrc.connect(crashHp);
    crashHp.connect(crashGain);
    crashGain.connect(this.gainNode!);
    crashSrc.start();
    this.nodes.push(crashSrc, crashHp, crashGain);
  }

  stop() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }
    setTimeout(() => {
      this.nodes.forEach((n) => {
        try {
          (n as any).stop?.();
          n.disconnect();
        } catch (_) {}
      });
      this.nodes = [];
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close();
      }
      this.ctx = null;
      this.gainNode = null;
    }, 600);
  }
}
