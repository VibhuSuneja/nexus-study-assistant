import { GoogleGenAI, Modality } from "@google/genai";
import { useState, useRef, useCallback, useEffect } from "react";
import { AudioStreamer, ScreenStreamer } from "../lib/media";
import { tools } from "../lib/assistantTools";

export function useLiveAssistant(
  processToolCall: (name: string, args: any) => Promise<any>,
  remoteFrame?: string | null
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioStreamer = useRef<AudioStreamer | null>(null);
  const screenStreamer = useRef<ScreenStreamer | null>(null);
  const sessionRef = useRef<any>(null);

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Auto-send remote frame to Gemini if it arrives and we are connected
  useEffect(() => {
    if (isConnected && remoteFrame && !isScreenSharing) {
      if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.sendRealtimeInput({
          video: { data: remoteFrame, mimeType: "image/jpeg" }
        }));
      }
    }
  }, [isConnected, remoteFrame, isScreenSharing]);

  const sendTextMessage = useCallback(async (text: string, frame?: string | null) => {
    if (!sessionRef.current) return;
    const session = await sessionRef.current;
    
    const parts: any[] = [{ text: `[VISION_QUERY]: ${text}` }];
    if (frame) {
      parts.push({ inlineData: { data: frame, mimeType: "image/jpeg" } });
    }
    
    session.send(parts);
  }, []);

  const startScreenSharing = useCallback(async () => {
    try {
      if (!screenStreamer.current) {
        screenStreamer.current = new ScreenStreamer();
      }
      setIsScreenSharing(true);
      await screenStreamer.current.start((base64) => {
        if (sessionRef.current) {
           sessionRef.current.then((s: any) => s.sendRealtimeInput({
             video: { data: base64, mimeType: "image/jpeg" }
           }));
        }
      });
    } catch (e) {
      console.error("Screen sharing error:", e);
      setIsScreenSharing(false);
    }
  }, []);

  const stopScreenSharing = useCallback(() => {
    if (screenStreamer.current) {
      screenStreamer.current.cleanup();
      screenStreamer.current = null;
    }
    setIsScreenSharing(false);
  }, []);

  const startSession = useCallback(async () => {
    setIsConnecting(true);
    try {
      // @ts-ignore
      if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }

      // Re-initialize to get potentially updated environment variables or fallback to GEMINI_API_KEY
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      audioStreamer.current = new AudioStreamer();
      screenStreamer.current = new ScreenStreamer();

      audioStreamer.current.initOutput();

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are an expert AI study companion and productivity assistant for a Computer Science student. You can guide them through their tasks, see their screen to help them read or understand text, and manage their study schedule. When they ask to sync with MCP apps, simulate the action with tools. Always be concise, helpful, and motivating.",
          tools: tools as any,
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Start audio capture
            await audioStreamer.current?.startInput((base64) => {
              sessionPromise.then((s) => s.sendRealtimeInput({
                audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
              }));
            });
          },
          onmessage: async (message) => {
            if (message.serverContent?.interrupted) {
              audioStreamer.current?.stopOutput();
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              audioStreamer.current?.playOutput(base64Audio);
            }

            const toolCalls = message.toolCall?.functionCalls;
            if (toolCalls && toolCalls.length > 0) {
              const responses = [];
              for (const call of toolCalls) {
                try {
                  const result = await processToolCall(call.name, call.args);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: result,
                  });
                } catch (e: any) {
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { error: e.message },
                  });
                }
              }
              sessionPromise.then(s => s.sendToolResponse({ functionResponses: responses }));
            }
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        }
      });
      
      sessionRef.current = sessionPromise;
      await sessionPromise;
    } catch (e) {
      console.error(e);
      setIsConnecting(false);
      stopSession();
    }
  }, [processToolCall]);

  const stopSession = useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);
    setIsScreenSharing(false);
    if (audioStreamer.current) {
      audioStreamer.current.cleanup();
      audioStreamer.current = null;
    }
    if (screenStreamer.current) {
      screenStreamer.current.cleanup();
      screenStreamer.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.then((s: any) => s.close?.()).catch(() => {});
      sessionRef.current = null;
    }
  }, []);

  const [volume, setVolume] = useState(0);

  // Poll volume
  useEffect(() => {
    if (!isConnected) {
      setVolume(0);
      return;
    }
    const interval = setInterval(() => {
      if (audioStreamer.current) {
        setVolume(audioStreamer.current.getVolume());
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isConnected]);

  const getLastFrame = useCallback(() => {
    return screenStreamer.current?.getLastFrame() || null;
  }, []);

  return { 
    stopSession, 
    startSession, 
    isConnected, 
    isConnecting, 
    volume,
    isScreenSharing,
    startScreenSharing,
    stopScreenSharing,
    getLastFrame,
    sendTextMessage
  };
}
