import React from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, Pause, RefreshCcw, ArrowLeft, 
  Clock, Brain, Sparkles
} from "lucide-react";
import { useNexus } from "../context/NexusContext";
import { useState, useEffect, useMemo } from "react";
import { useActiveRecall } from "../hooks/useActiveRecall";

interface PomodoroProps {
  onBack: () => void;
}

export default function Pomodoro({ onBack }: PomodoroProps) {
  const { 
    secondsRemaining, isRunning, toggleTimer, formatTime, resetTimer, sessionType
  } = useNexus();

  const { dueCount } = useActiveRecall();

  useEffect(() => {
    // Session timer effect is handled by NexusContext
  }, []);

  const handleBack = () => {
    onBack();
  };

  const handleResetTimer = (mins: number) => {
    const type = mins <= 15 ? 'break' : 'work';
    resetTimer(mins, type);
  };

  const showReviewSuggestion = useMemo(() => {
    return sessionType === 'break' && dueCount > 0;
  }, [sessionType, dueCount]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-300 flex flex-col font-sans overflow-hidden relative">
      {/* Dynamic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,#F27D2610,transparent_50%)]" />
        {sessionType === 'break' && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#4ade8010,transparent_50%)]" />
        )}
      </div>

      {/* Header */}
      <header className="z-50 h-20 px-8 flex items-center justify-between backdrop-blur-xl bg-black/40 border-b border-white/5">
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all group"
        >
          <div className="p-2 rounded-full border border-white/5 group-hover:border-white/20 bg-white/5">
            <ArrowLeft size={18} />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Return_to_Nexus</span>
        </button>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
             <span className="text-[10px] font-mono text-[#F27D26] uppercase tracking-widest font-bold">Zen_Module</span>
             <span className="text-[8px] font-mono text-zinc-600 uppercase">Pomodoro_Interface_v1.0</span>
           </div>
        </div>
      </header>

      {/* Main content - Centered Timer */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        <div className="max-w-4xl w-full flex flex-col items-center">
          
          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 ${sessionType === 'break' ? 'border-green-500/30' : ''}`}
            >
              <Clock size={12} className={sessionType === 'break' ? 'text-green-400' : 'text-[#F27D26]'} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                {sessionType === 'work' ? 'Focus_Session' : 'Break_Interval'}
              </span>
            </motion.div>

            <motion.div 
              onClick={toggleTimer}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-[9rem] md:text-[12rem] font-bold tracking-tighter tabular-nums text-white leading-none cursor-pointer transition-colors group relative ${sessionType === 'break' ? 'hover:text-green-400' : 'hover:text-[#F27D26]'}`}
            >
              {formatTime(secondsRemaining)}
              <div className="absolute -inset-4 bg-white/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.div>

            {/* Active Recall Suggestion */}
            <AnimatePresence>
              {showReviewSuggestion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4 max-w-md shadow-2xl"
                >
                  <div className="w-10 h-10 rounded-full bg-[#F27D26]/20 flex items-center justify-center text-[#F27D26]">
                    <Sparkles size={20} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Recall Opportunity</h4>
                    <p className="text-[10px] text-zinc-500 mt-1">You have {dueCount} cards due. Use this 5m break for a quick review session?</p>
                  </div>
                  <button 
                    className="ml-auto px-4 py-2 bg-[#F27D26] text-black text-[10px] font-bold rounded-lg hover:bg-[#ff8e3a] transition-all uppercase"
                    onClick={() => {
                      onBack();
                    }}
                  >
                    Start Review
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-6 mt-12">
              <button 
                onClick={toggleTimer}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isRunning ? 'bg-white/5 border border-white/20 text-white' : (sessionType === 'break' ? 'bg-green-500 text-black shadow-[0_0_50px_rgba(74,222,128,0.3)]' : 'bg-[#F27D26] text-black shadow-[0_0_50px_rgba(242,125,38,0.3)]')}`}
              >
                {isRunning ? <Pause size={36} fill="currentColor" /> : <Play size={36} className="ml-1" fill="currentColor" />}
              </button>
              
              <button 
                onClick={() => handleResetTimer(sessionType === 'work' ? 25 : 5)}
                className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <RefreshCcw size={24} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-12">
              {[25, 50, 15, 5].map(mins => (
                <button 
                  key={mins}
                  onClick={() => handleResetTimer(mins)}
                  className={`px-4 py-2 rounded-lg border text-[10px] font-mono uppercase transition-all ${secondsRemaining === mins * 60 ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10'}`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="h-16 px-8 flex items-center justify-between border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-4 text-zinc-600">
           <span className="text-[8px] font-mono tracking-widest uppercase">Encryption_State: Verified</span>
           <div className="w-1 h-1 rounded-full bg-green-500/40" />
           <span className="text-[8px] font-mono tracking-widest uppercase">Session: Protected</span>
        </div>
         <div className="flex items-center gap-2">
           <Brain size={12} className="text-zinc-600" />
           <span className="text-[9px] font-mono text-zinc-600 uppercase">Nexus_Cognitive_Support_AI</span>
         </div>
      </footer>
    </div>
  );
}
