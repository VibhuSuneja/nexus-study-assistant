import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useSessionSync() {
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('nexus_session_id'));
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    // Subscribe to remote frame and history updates
    const unsub = onSnapshot(doc(db, "sessions", sessionId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRemoteFrame(data.lastFrame || null);
        setHistory(data.history || []);
      }
    });

    return () => unsub();
  }, [sessionId]);

  const createSession = useCallback(async () => {
    try {
      const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log("Attempting to create session:", newId);
      await setDoc(doc(db, "sessions", newId), {
        createdAt: new Date(),
        lastFrame: null,
        history: []
      });
      setSessionId(newId);
      localStorage.setItem('nexus_session_id', newId);
      console.log("Session created successfully!");
      return newId;
    } catch (e) {
      console.error("Error creating session (Check Firebase Rules):", e);
    }
  }, []);

  const joinSession = useCallback((id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;
    console.log("Joining session:", cleanId);
    setSessionId(cleanId);
    localStorage.setItem('nexus_session_id', cleanId);
  }, []);

  const addMessageToHistory = useCallback(async (role: 'user' | 'assistant', content: string, type: 'local' | 'cloud' = 'cloud') => {
    if (!sessionId) return;
    try {
      // Use the functional state to get most recent history for atomicity
      const sessionRef = doc(db, "sessions", sessionId);
      const newMessage = { role, content, type, timestamp: new Date().toISOString() };
      
      // Fetch current doc to append (simpler than arrayUnion for structured logs)
      setHistory(prev => {
        const updated = [...prev, newMessage].slice(-50); // Keep last 50 messages
        updateDoc(sessionRef, { history: updated });
        return updated;
      });
    } catch (e) {
      console.error("Error saving message:", e);
    }
  }, [sessionId]);

  const broadcastFrame = useCallback(async (base64: string) => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(db, "sessions", sessionId), {
        lastFrame: base64,
        updatedAt: new Date()
      });
    } catch (e) {
      console.error("Broadcast error:", e);
    }
  }, [sessionId]);

  const disconnectSession = useCallback(() => {
    setSessionId(null);
    localStorage.removeItem('nexus_session_id');
  }, []);

  return { 
    sessionId, 
    remoteFrame, 
    createSession, 
    joinSession, 
    broadcastFrame,
    isBroadcasting,
    setIsBroadcasting,
    history,
    addMessageToHistory,
    disconnectSession
  };
}
