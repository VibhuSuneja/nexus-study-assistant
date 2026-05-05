import { GoogleGenAI, Modality } from "@google/genai";
import { useState, useRef, useCallback, useEffect } from "react";
import { AudioStreamer, ScreenStreamer } from "../lib/media";
import { tools } from "../lib/assistantTools";

export function useLiveAssistant(
  processToolCall: (name: string, args: any) => Promise<any>,
  remoteFrame?: string | null,
  isGhostMode?: boolean
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioStreamer = useRef<AudioStreamer | null>(null);
  const screenStreamer = useRef<ScreenStreamer | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const resolvedSessionRef = useRef<any>(null);

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Auto-send remote frame to Gemini if it arrives and we are connected
  useEffect(() => {
    if (isConnected && remoteFrame && !isScreenSharing) {
      if (resolvedSessionRef.current) {
        try {
          resolvedSessionRef.current.sendRealtimeInput({
            video: { data: remoteFrame, mimeType: "image/jpeg" }
          });
        } catch (e) {}
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
        if (resolvedSessionRef.current) {
           try {
             resolvedSessionRef.current.sendRealtimeInput({
               video: { data: base64, mimeType: "image/jpeg" }
             });
           } catch (e) {}
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

  const processToolCallRef = useRef(processToolCall);
  useEffect(() => {
    processToolCallRef.current = processToolCall;
  }, [processToolCall]);

  const startSession = useCallback(async () => {
    setIsConnecting(true);
    try {
      // @ts-ignore
      if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      audioStreamer.current = new AudioStreamer();
      screenStreamer.current = new ScreenStreamer();

      // Initialize contexts in the user gesture context
      await audioStreamer.current.initInput();
      await audioStreamer.current.initOutput();

      const sessionPromise = ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: isGhostMode ? `You are a Ghost Student — an AI studying alongside the user using the Feynman Technique.
You have access to powerful tools.

Your role is to ACT CONFUSED and ASK THE USER TO EXPLAIN concepts to you based on what you see on their screen or what they say.
Do NOT teach them. Say things like: "I don't quite understand this part, can you explain it to me?"

1. EVALUATE (updateConceptMastery): After the user explains something, evaluate their explanation. Use 'updateConceptMastery' to score them (0-100) and list any gaps in their knowledge.
2. NEURAL WIKI (upsertWikiEntry): If they explain a completely new concept well, save it to the Neural Wiki.
3. VISION: Always look at their screen to find things to ask them about.

Behavior rules:
- Be curious, slightly confused, and eager to learn from the user.
- Ask probing questions to test the user's understanding.
- Never just give them the answer. Make them teach you.
- Respond in the same language the user speaks.` : `You are Nexus — an elite AI study companion and productivity assistant. You have access to powerful tools to help the user learn and retain knowledge:

1. NEURAL WIKI (upsertWikiEntry): Whenever you explain a concept in depth, you MUST automatically save it to the Neural Wiki using the 'upsertWikiEntry' tool. Do this proactively — don't wait to be asked. Always include relatedConcepts and a category.

2. ACTIVE RECALL (generateRecallQuestion): After saving a concept to the Wiki, generate a probing recall question using 'generateRecallQuestion'. These questions will appear during the user's focused work sessions as spaced-repetition challenges.

3. TASKS (addTask, getTasks, setFocusMode): Help the user manage their study schedule, add tasks, and trigger focus sessions.

4. VISION: You can see the user's screen when shared. Analyze it and proactively offer help based on what you see.

Behavior rules:
- Be concise, sharp, and motivating. You are a high-performance study system.
- Always use tools proactively, especially upsertWikiEntry after any substantive explanation.
- When the user says 'save to wiki', 'note this', or 'remember this' — immediately call upsertWikiEntry.
- Respond in the same language the user speaks.`,
          tools: tools as any,
        },
        callbacks: {
          onopen: async () => {
            const session = await sessionPromise;
            resolvedSessionRef.current = session;
            setIsConnected(true);
            setIsConnecting(false);
            
            // Start audio capture
            await audioStreamer.current?.startInput((base64) => {
              if (resolvedSessionRef.current) {
                try {
                  resolvedSessionRef.current.sendRealtimeInput({
                    audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
                  });
                } catch (e: any) {
                  if (!e?.message?.includes("CLOSING or CLOSED")) {
                    console.warn("Failed to send audio input:", e);
                  }
                }
              }
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
                  const toolArgs = (call as any).args || (call as any).arguments || {};
                  const result = await processToolCallRef.current(call.name, toolArgs);
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
              sessionPromise.then(s => {
                try {
                  s.sendToolResponse({ functionResponses: responses });
                } catch (e) {}
              });
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
  }, [isGhostMode]);

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
      sessionRef.current.then((s: any) => {
        try { s.close?.(); } catch (e) {}
      }).catch(() => {});
      sessionRef.current = null;
    }
    resolvedSessionRef.current = null;
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
