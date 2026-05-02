/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { tools } from "./assistantTools";

// Store API key in a global or use ENV
export class AudioStreamer {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  public analyser: AnalyserNode | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  public getVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
       sum += dataArray[i];
    }
    return sum / dataArray.length; // 0 to ~255
  }

  async startInput(onData: (base64: string) => void) {
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    const processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const buffer = new Uint8Array(pcm16.buffer);
      // Fast manual array to binary string conversion to avoid call stack limits
      let binaryString = "";
      for (let i = 0; i < buffer.byteLength; i++) {
        binaryString += String.fromCharCode(buffer[i]);
      }
      onData(btoa(binaryString));
    };

    source.connect(processor);
    processor.connect(this.audioCtx.destination);
    this.processor = processor;
  }

  initOutput() {
    this.outputAudioCtx = new AudioContext({ sampleRate: 24000 });
    this.analyser = this.outputAudioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.outputAudioCtx.destination);
    this.nextStartTime = this.outputAudioCtx.currentTime;
  }

  playOutput(base64: string) {
    if (!this.outputAudioCtx || !this.analyser) return;
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

    if (this.nextStartTime < this.outputAudioCtx.currentTime) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  stopOutput() {
    this.activeSources.forEach((s) => {
      try { s.stop(); } catch (e) {}
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
    if (this.audioCtx) this.audioCtx.close();
    if (this.outputAudioCtx) this.outputAudioCtx.close();
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
    this.displayStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: {
        displaySurface: "monitor",
      },
      // @ts-ignore
      selfBrowserSurface: "exclude",
      preferCurrentTab: false,
      systemAudio: "include"
    } as any);
    this.video = document.createElement("video");
    this.video.srcObject = this.displayStream;
    await this.video.play();

    this.canvas = document.createElement("canvas");
    this.canvas.width = 1280; 
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext("2d");

    this.timer = setInterval(() => {
      if (!this.ctx || !this.video || !this.canvas) return;
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const dataUrl = this.canvas.toDataURL("image/jpeg", 0.6);
      const base64 = dataUrl.split(",")[1];
      this.lastFrame = base64;
      onData(base64);
    }, 1000); // 1 frame per second
  }

  getLastFrame() {
    return this.lastFrame;
  }

  cleanup() {
    if (this.timer) clearInterval(this.timer);
    if (this.video) this.video.pause();
    if (this.displayStream) this.displayStream.getTracks().forEach((t) => t.stop());
  }
}
