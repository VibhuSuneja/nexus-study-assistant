import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface NexusContextType {
  // Timer State
  secondsRemaining: number;
  setSecondsRemaining: (secs: number) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  isLockedIn: boolean;
  setIsLockedIn: (locked: boolean) => void;
  startTimer: (duration?: number) => void;
  pauseTimer: () => void;
  resetTimer: (duration?: number) => void;
  toggleTimer: () => void;
  formatTime: (secs: number) => string;
}

const NexusContext = createContext<NexusContextType | undefined>(undefined);

export function NexusProvider({ children }: { children: React.ReactNode }) {
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isLockedIn, setIsLockedIn] = useState(false);
  
  const timerRef = useRef<number | null>(null);

  const toggleTimer = useCallback(() => {
    setSecondsRemaining(prev => prev <= 0 ? 25 * 60 : prev);
    setIsRunning(prev => !prev);
  }, []);

  const startTimer = useCallback((durationMinutes?: number) => {
    if (durationMinutes) setSecondsRemaining(durationMinutes * 60);
    setIsRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback((durationMinutes: number = 25) => {
    setIsRunning(false);
    setSecondsRemaining(durationMinutes * 60);
  }, []);

  // Centralized Timer Interval
  useEffect(() => {
    let interval: number | null = null;

    if (isRunning) {
      // Logic for catching up if backgrounded
      let lastTick = Date.now();
      
      interval = window.setInterval(() => {
        const now = Date.now();
        const delta = Math.round((now - lastTick) / 1000);
        
        if (delta >= 1) {
          lastTick = now;
          setSecondsRemaining(prev => {
            const next = prev - delta;
            if (next <= 0) {
              setIsRunning(false);
              // Notification / Sound for end of session could be added here
              return 0;
            }
            return next;
          });
        }
      }, 500); // Check every 500ms for responsiveness
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning]);


  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <NexusContext.Provider value={{
      secondsRemaining, setSecondsRemaining, isRunning, setIsRunning, isLockedIn, setIsLockedIn,
      startTimer, pauseTimer, resetTimer, toggleTimer, formatTime
    }}>
      {children}
    </NexusContext.Provider>
  );
}

export const useNexus = () => {
  const context = useContext(NexusContext);
  if (!context) throw new Error('useNexus must be used within a NexusProvider');
  return context;
};
