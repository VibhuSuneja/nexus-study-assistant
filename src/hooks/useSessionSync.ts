import { useState, useEffect, useCallback, useContext } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNexus } from '../context/NexusContext';

export function useSessionSync() {
  const { focusState, sessionType } = useNexus();
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('nexus_session_id'));
  // ... rest of state ...
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [nearbyNodes, setNearbyNodes] = useState<any[]>([]);
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('nexus_device_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('nexus_device_id', id);
    }
    return id;
  });

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

  // Handle Node Discovery (Bluetooth-like behavior)
  useEffect(() => {
    let publicIp = "unknown";
    const getIpAndRegister = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        publicIp = data.ip;
      } catch (e) {
        console.warn("Could not fetch IP for discovery, using fallback.");
      }

      const ua = navigator.userAgent;
      const deviceName = /android/i.test(ua) ? "Android Node" : 
                         /iPad|iPhone|iPod/.test(ua) ? "Mobile Node" : 
                         /windows/i.test(ua) ? "Windows Hub" : 
                         /macintosh/i.test(ua) ? "Mac Hub" : "Nexus Node";

      const nodeRef = doc(db, "nodes", deviceId);
      
      const updatePresence = () => {
        setDoc(nodeRef, {
          name: deviceName,
          ip: publicIp,
          lastActive: new Date(),
          currentSession: sessionId,
          focusState,
          sessionType
        }, { merge: true });
      };

      updatePresence();
      const interval = setInterval(updatePresence, 30000); // Pulse every 30s

      // Update the discovery document with our info
      const discRef = doc(db, "discovery", publicIp.replace(/\./g, '_'));
      const updateDisc = () => {
        const discData = {
          name: deviceName,
          lastActive: new Date().toISOString(),
          currentSession: sessionId,
          focusState,
          sessionType
        };
        
        updateDoc(discRef, {
          [deviceId]: discData
        }).catch(() => {
          setDoc(discRef, { [deviceId]: discData });
        });
      };

      updateDisc();
      const discInterval = setInterval(updateDisc, 15000);

      // Listen for other nodes on the same IP
      const nodesUnsub = onSnapshot(discRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const nodes = Object.entries(data)
            .filter(([id]) => id !== deviceId)
            .map(([id, node]: [string, any]) => ({ id, ...node }))
            .filter(node => (new Date().getTime() - new Date(node.lastActive).getTime()) < 120000); // Active in last 2 mins
          setNearbyNodes(nodes);
        }
      });

      return () => {
        clearInterval(interval);
        clearInterval(discInterval);
        nodesUnsub();
      };
    };

    getIpAndRegister();
  }, [deviceId, sessionId, focusState, sessionType]);

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
      const sessionRef = doc(db, "sessions", sessionId);
      const newMessage = { role, content, type, timestamp: new Date().toISOString() };
      
      // Atomic append to Firestore; onSnapshot will update the local 'history' state
      await updateDoc(sessionRef, {
        history: arrayUnion(newMessage)
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
    disconnectSession,
    nearbyNodes
  };
}
