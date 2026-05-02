import { useState, useEffect, useCallback } from 'react';

type LocalMode = 'ollama' | 'lm-studio' | 'mediapipe' | 'none';

export function useLocalGemma() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LocalMode>('none');
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [customIp, setCustomIp] = useState<string>(localStorage.getItem('nexus_node_ip') || '127.0.0.1');

  useEffect(() => {
    async function checkLocalServers() {
      const baseUrl = `http://${customIp}`;
      
      // Check LM Studio
      try {
        const res = await fetch(`${baseUrl}:1234/v1/models`);
        if (res.ok) {
          const data = await res.json();
          setMode('lm-studio');
          setActiveModel(data.data[0]?.id || "LM Studio");
          setIsLoaded(true);
          setError(null);
          return;
        }
      } catch (e) {}

      // Check Ollama
      try {
        const res = await fetch(`${baseUrl}:11434/api/tags`);
        if (res.ok) {
          const data = await res.json();
          setMode('ollama');
          setActiveModel(data.models[0]?.name || "Ollama");
          setIsLoaded(true);
          setError(null);
          return;
        }
      } catch (e) {}

      setMode('none');
      setIsLoaded(false);
      setError("No local LLM server detected at " + customIp);
    }

    checkLocalServers();
    const interval = setInterval(checkLocalServers, 5000);
    return () => clearInterval(interval);
  }, [customIp]);

  const updateIp = (ip: string) => {
    setCustomIp(ip);
    localStorage.setItem('nexus_node_ip', ip);
  };

  const generateResponse = useCallback(async (prompt: string, onPartial?: (text: string) => void, base64Image?: string) => {
    const baseUrl = `http://${customIp}`;
    setIsProcessing(true);
    try {
      if (mode === 'ollama') {
        const visualPrompt = base64Image 
          ? `[VISUAL CONTEXT: Analyze the user's screen capture.]\n${prompt}`
          : prompt;

        const response = await fetch(`${baseUrl}:11434/api/generate`, {
          method: "POST",
          body: JSON.stringify({
            model: "gemma",
            prompt: visualPrompt,
            system: "You are the Nexus Study Assistant. Focus on accurate technical analysis of the visual input.",
            images: base64Image ? [base64Image] : [],
            options: { temperature: 0.2 },
            stream: !!onPartial
          }),
        });

        if (onPartial) {
          const reader = response.body?.getReader();
          if (!reader) return "Streaming not supported";
          
          let fullText = "";
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  fullText += json.response;
                  onPartial(json.response);
                }
              } catch (e) {}
            }
          }
          return fullText;
        } else {
          const data = await response.json();
          return data.response;
        }
      } else if (mode === 'lm-studio') {
        const content: any[] = [];
        
        // Image FIRST for vision models
        if (base64Image) {
          content.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
          });
        }

        content.push({ 
          type: "text", 
          text: `IMPORTANT: Look at the attached screen capture to answer this. \n\nUSER QUESTION: ${prompt}` 
        });

        const response = await fetch(`${baseUrl}:1234/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You are a vision-capable study assistant. Analyze the provided image to answer accurately." },
              { role: "user", content }
            ],
            temperature: 0.1, // Near zero for maximum factualness
            max_tokens: 1000,
            stream: !!onPartial
          }),
        }).catch(err => {
          console.error("Local AI Fetch Failed:", err);
          throw new Error(`CONNECTION_FAILED: Ensure phone is on same Wi-Fi as PC (${baseUrl})`);
        });

        if (onPartial) {
          const reader = response.body?.getReader();
          if (!reader) return "Streaming not supported";
          
          let fullText = "";
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr.trim() === '[DONE]') break;
                try {
                  const json = JSON.parse(dataStr);
                  const text = json.choices[0]?.delta?.content || "";
                  fullText += text;
                  onPartial(text);
                } catch (e) {}
              }
            }
          }
          return fullText;
        } else {
          const data = await response.json();
          return data.choices[0].message.content;
        }
      }
      
      return "Local server mode not active.";
    } catch (err: any) {
      console.error("Local inference error:", err);
      return `Error connecting to ${mode}. Check CORS settings.`;
    } finally {
      setIsProcessing(false);
    }
  }, [mode, customIp]);

  return { isLoaded, isProcessing, generateResponse, error, mode, activeModel, customIp, updateIp };
}
