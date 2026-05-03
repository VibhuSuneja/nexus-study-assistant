import { useCallback, useEffect, useState, useRef } from "react";
import { Mic, MicOff, Settings, Calendar, Play, Pause, Activity, Lock, Unlock, X, CheckCircle2, Circle, ListTodo, Timer, Monitor, Terminal as TerminalIcon, Brain } from "lucide-react";
import { useLiveAssistant } from "../hooks/useLiveAssistant";
import { useTasks } from "../hooks/useTasks";
import { useLocalGemma } from "../hooks/useLocalGemma";
import { useSessionSync } from "../hooks/useSessionSync";
import { useNeuralWiki } from "../hooks/useNeuralWiki";
import { useActiveRecall } from "../hooks/useActiveRecall";
import { useNexus } from "../context/NexusContext";
import { motion, AnimatePresence } from "motion/react";

import Face3D from "./Face3D";

interface DashboardProps {
  onNavigateToAudio: () => void;
}

export default function Dashboard({ onNavigateToAudio }: DashboardProps) {
  // 1. Hooks and State at the top
  const { tasks, updateTask, toolHandlers, focusTask, focusDuration, setFocusTask, setFocusDuration } = useTasks();
  const { sessionId, remoteFrame, createSession, joinSession, broadcastFrame, isBroadcasting, setIsBroadcasting, history, addMessageToHistory, disconnectSession, nearbyNodes } = useSessionSync();
  const { entries: wikiEntries, upsertWikiEntry, isSyncing: isWikiSyncing } = useNeuralWiki();
  const { questions: recallQueue, activeQuestion, setActiveQuestion, generateRecallQuestion, submitAnswer } = useActiveRecall();
  const { isLoaded: isLocalGemmaLoaded, generateResponse: generateLocalResponse, isProcessing: isLocalProcessing, mode, activeModel, customIp, updateIp } = useLocalGemma();
  const { 
    secondsRemaining, setSecondsRemaining, isRunning: isTimerRunning, setIsRunning: setIsTimerRunning,
    isLockedIn, setIsLockedIn, toggleTimer, formatTime 
  } = useNexus();
  
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [sessionInput, setSessionInput] = useState("");
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [localResponse, setLocalResponse] = useState<string>("");
  const [cloudResponse, setCloudResponse] = useState<string>("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMCPOpen, setIsMCPOpen] = useState(false);
  const [isFullscreenVision, setIsFullscreenVision] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'vision' | 'history' | 'wiki'>('vision');
  const [selectedWikiEntry, setSelectedWikiEntry] = useState<string | null>(null);

  // 2. Refs for values that change frequently but shouldn't trigger handler recreation
  const remoteFrameRef = useRef(remoteFrame);
  useEffect(() => {
    remoteFrameRef.current = remoteFrame;
  }, [remoteFrame]);

  const secondsRemainingRef = useRef(secondsRemaining);
  useEffect(() => {
    secondsRemainingRef.current = secondsRemaining;
  }, [secondsRemaining]);

  const screenStateRef = useRef({ isScreenSharing: false, getLastFrame: (() => null) as () => string | null });

  // 3. The Tool Handler
  const processToolCall = useCallback(async (name: string, args: any) => {
    console.log("Tool execution requested:", name, args);
    
    const allHandlers = {
      ...toolHandlers,
      setFocusMode: (toolArgs: any) => {
        const res = toolHandlers.setFocusMode(toolArgs);
        // Immediately update global timer state to match focus mode
        if (toolArgs.durationMinutes) {
          const secs = toolArgs.durationMinutes * 60;
          setSecondsRemaining(secs);
          setIsTimerRunning(true);
          setIsLockedIn(true);
        } else {
          setIsTimerRunning(true);
          setIsLockedIn(true);
        }
        return res;
      },
      upsertWikiEntry: async (toolArgs: any) => {
        const frame = screenStateRef.current.isScreenSharing ? screenStateRef.current.getLastFrame() : remoteFrameRef.current;
        return upsertWikiEntry({ ...toolArgs, frame: frame || undefined });
      },
      generateRecallQuestion,
      startTimer: () => {
        setSecondsRemaining(prev => prev <= 0 ? 25 * 60 : prev);
        setIsTimerRunning(true);
        setIsLockedIn(true);
        return { success: true, message: "Timer started and locked in." };
      },
      stopTimer: () => {
        setIsTimerRunning(false);
        return { success: true, message: "Timer paused successfully." };
      },
      updateConceptMastery: (toolArgs: any) => {
        console.log("Concept mastery updated:", toolArgs);
        return { success: true, message: "Mastery updated." };
      }
    };

    const handler = (allHandlers as any)[name];
    if (handler) {
      try {
        const result = await handler(args);
        return result;
      } catch (err) {
        console.error(`Error executing tool ${name}:`, err);
        return { error: String(err) };
      }
    }
    return { error: `Tool ${name} not found.` };
  }, [toolHandlers, upsertWikiEntry, generateRecallQuestion, setIsLockedIn]);

  // 4. Assistant Hook
  const assistantProps = useLiveAssistant(processToolCall, remoteFrame, isGhostMode);
  const { 
    startSession, stopSession, isConnected, isConnecting, volume, 
    isScreenSharing, startScreenSharing, stopScreenSharing, 
    getLastFrame, sendTextMessage 
  } = assistantProps;
  
  // Sync screen state to ref for tools
  useEffect(() => {
    screenStateRef.current = { isScreenSharing, getLastFrame };
  }, [isScreenSharing, getLastFrame]);

  // 5. Other Effects
  const terminalEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    // Automatically trigger active recall ONLY during an active Lock In session
    if (isLockedIn && recallQueue.length > 0 && !activeQuestion) {
      setActiveQuestion(recallQueue[0]);
    }
  }, [isLockedIn, recallQueue, activeQuestion, setActiveQuestion]);

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.subtasks) {
      const newSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      updateTask(taskId, { subtasks: newSubtasks });
    }
  };

  useEffect(() => {
    if (focusDuration > 0) {
      setSecondsRemaining(focusDuration * 60);
    }
  }, [focusDuration, focusTask, setSecondsRemaining]);

  const handleSyncMCP = () => {
    const result = toolHandlers.syncWithMCP({ appName: 'Calendar' });
    setSyncMessage(result.message);
    setTimeout(() => setSyncMessage(null), 3000);
  };
  
  useEffect(() => {
    const int = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    return () => clearInterval(int);
  }, []);

  const currentFocusedTask = focusTask ? tasks.find(t => t.id === focusTask) : null;

  // Auto-broadcast screen if enabled
  const [syncStats, setSyncStats] = useState({ sent: 0, received: 0 });

  useEffect(() => {
    let interval: any;
    if (isBroadcasting && sessionId && isScreenSharing) {
      interval = setInterval(async () => {
        const frame = getLastFrame();
        if (frame) {
          await broadcastFrame(frame);
          setSyncStats(prev => ({ ...prev, sent: prev.sent + 1 }));
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isBroadcasting, sessionId, isScreenSharing, broadcastFrame, getLastFrame]);

  // Monitor received frames
  useEffect(() => {
    if (remoteFrame) {
      setSyncStats(prev => ({ ...prev, received: prev.received + 1 }));
    }
  }, [remoteFrame]);

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-300 flex flex-col font-sans selection:bg-[#F27D26]/30 overflow-x-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#F27D26]/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#00FFDD]/5 blur-[120px] rounded-full" />
        <div className="absolute top-0 w-full h-full bg-gradient-to-br from-[#121318] via-[#0D0E12] to-[#0A0B0E] -z-20" />
      </div>

      {/* Header: Status Bar */}
      <header className="z-50 h-14 border-b border-white/5 bg-black/40 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tighter text-white uppercase italic">Nexus<span className="text-[#F27D26]">_Vision</span></h1>
            <span className="text-[8px] font-mono text-zinc-500 tracking-widest uppercase">Autonomous_Study_Node</span>
          </div>
          <div className="hidden sm:flex h-6 w-px bg-white/10" />
          <div className="hidden sm:flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isLocalGemmaLoaded ? 'bg-[#00FFDD] animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{isLocalGemmaLoaded ? 'LOCAL_READY' : 'LOCAL_OFFLINE'}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">System_Time</span>
            <span className="text-xs font-mono text-white tracking-widest">{time}</span>
          </div>
          {sessionId && (
            <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] font-mono text-zinc-400">ID: <span className="text-[#00FFDD]">{sessionId}</span></span>
              <button onClick={() => disconnectSession()} className="text-red-500 hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* Mobile Navigation Tabs */}
        <div className="lg:hidden flex bg-black/60 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-all ${activeTab === 'tasks' ? 'text-white border-b border-white bg-white/5' : 'text-zinc-500'}`}
          >
            TASKS
          </button>
          <button 
            onClick={() => setActiveTab('vision')}
            className={`flex-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-all ${activeTab === 'vision' ? 'text-[#F27D26] border-b border-[#F27D26] bg-[#F27D26]/5' : 'text-zinc-500'}`}
          >
            MISSION_HUB
          </button>
          <button 
            onClick={() => setActiveTab('wiki')}
            className={`flex-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-all ${activeTab === 'wiki' ? 'text-purple-400 border-b border-purple-400 bg-purple-400/5' : 'text-zinc-500'}`}
          >
            NEURAL_WIKI
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-all ${activeTab === 'history' ? 'text-[#00FFDD] border-b border-[#00FFDD] bg-[#00FFDD]/5' : 'text-zinc-500'}`}
          >
            NEURAL_LOG
          </button>
        </div>

        {/* Left Column: Tasks & System (Hidden on mobile if not active) */}
        <div className={`w-full lg:w-80 flex flex-col border-r border-white/5 bg-[#0A0A0C]/50 ${activeTab === 'tasks' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="p-4 border-b border-white/5 bg-black/20">
            <button 
              onClick={() => setIsLockedIn(true)}
              className="w-full py-3 mb-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 hover:border-[#F27D26]/50 transition-all group"
            >
              <Timer size={18} className="text-[#F27D26] group-hover:animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white">Enter_Focus_Hub</span>
            </button>

            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <ListTodo size={12} />
                Active_Workload
              </h2>
              <button onClick={handleSyncMCP} className="text-[#00FFDD] hover:scale-110 transition-transform">
                <Activity size={14} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {tasks.map((task, i) => (
              <div 
                key={task.id} 
                onClick={() => setFocusTask(task.id)}
                className={`p-3 rounded-lg mb-2 cursor-pointer transition-all border ${focusTask === task.id ? 'bg-[#F27D26]/10 border-[#F27D26]/30' : 'bg-white/5 border-transparent hover:border-white/10'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-mono text-zinc-500">#{i+1 > 9 ? i+1 : `0${i+1}`}</span>
                  <span className="text-[9px] font-mono text-[#F27D26] uppercase">{task.course}</span>
                </div>
                <h4 className={`text-xs font-medium leading-tight ${focusTask === task.id ? 'text-white' : 'text-zinc-400'}`}>{task.title}</h4>
                {focusTask === task.id && (
                  <motion.button
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLockedIn(true);
                    }}
                    className="mt-3 w-full py-2 bg-[#F27D26] text-black text-[10px] font-bold rounded uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Lock size={12} />
                    Lock In
                  </motion.button>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/5 bg-black/40">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-zinc-500 uppercase">Node_Config</span>
              <button onClick={() => setIsEditingIp(!isEditingIp)} className="text-zinc-600 hover:text-white">
                <Settings size={12} />
              </button>
            </div>
            {isEditingIp ? (
              <input 
                type="text" 
                defaultValue={customIp}
                onBlur={(e) => { updateIp(e.target.value); setIsEditingIp(false); }}
                className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white outline-none focus:border-[#00FFDD]/50"
                autoFocus
              />
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-white truncate max-w-[140px]">{activeModel || 'STANDBY'}</span>
                <span className="text-[9px] font-mono text-zinc-600">{customIp}</span>
              </div>
            )}

            {/* PC Sync Section */}
            {!sessionId && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text"
                    value={sessionInput}
                    onChange={(e) => setSessionInput(e.target.value)}
                    placeholder="CODE"
                    className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white"
                  />
                  <button 
                    onClick={() => joinSession(sessionInput)}
                    className="px-2 py-1 bg-[#00FFDD]/10 border border-[#00FFDD]/30 text-[#00FFDD] text-[10px] font-mono rounded hover:bg-[#00FFDD]/20 transition-all"
                  >
                    JOIN
                  </button>
                </div>

                {/* Nearby Discovery (Bluetooth style) */}
                {nearbyNodes.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#00FFDD] animate-ping" />
                      Detected_Nearby
                    </span>
                    {nearbyNodes.map(node => (
                      <button 
                        key={node.id}
                        onClick={() => {
                          if (node.currentSession) {
                            joinSession(node.currentSession);
                          } else {
                            createSession().then(id => {
                              // We could potentially notify the other device here, 
                              // but for now we just join the local session.
                            });
                          }
                        }}
                        className="w-full flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-lg hover:border-[#00FFDD]/50 hover:bg-[#00FFDD]/5 transition-all group"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] font-mono text-white font-bold">{node.name}</span>
                          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">
                            {node.currentSession ? 'ACTIVE_SESSION' : 'READY_TO_PAIR'}
                          </span>
                        </div>
                        <Activity size={12} className="text-[#00FFDD] opacity-20 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => createSession()}
                  className="w-full py-1.5 bg-white/5 border border-white/10 text-white text-[10px] font-mono rounded hover:bg-white/10 transition-all uppercase"
                >
                  GEN_NEW_ACCESS_CODE
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center Column: AI Hub & Vision (Hidden on mobile if not active) */}
        <div className={`flex-1 flex flex-col bg-[#0C0D10]/30 ${activeTab === 'vision' ? 'flex' : 'hidden lg:flex'}`}>
          {/* AI Face Zone */}
          <div className="relative flex-1 min-h-[300px] flex items-center justify-center p-8 overflow-hidden">
            <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#F27D26]/5 to-transparent border-b border-[#F27D26]/10" />
            
            <div className="z-10 w-full max-w-md aspect-square relative">
              <Face3D 
                volume={volume} 
                isConnected={isConnected} 
                isConnecting={isConnecting} 
                onClick={isConnected ? stopSession : startSession} 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {!isConnected && (
                  <button 
                    onClick={() => startSession()}
                    className="pointer-events-auto bg-[#F27D26] text-black font-bold text-[10px] px-6 py-2 rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(242,125,38,0.2)] uppercase tracking-widest"
                  >
                    Engage_Core
                  </button>
                )}
                {isConnecting && (
                  <div className="text-[#F27D26] font-mono text-[8px] animate-pulse">UPLINKING...</div>
                )}
              </div>
            </div>

            <div className="absolute bottom-8 left-8 flex flex-col gap-1">
              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Feedback_Pulse</span>
              <div className="flex gap-0.5 items-end h-4">
                {[...Array(8)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: isConnected ? 4 + Math.random() * 12 : 2 }}
                    className="w-1 bg-[#F27D26]/60 rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Vision Monitor Section */}
          <div className="p-4 border-t border-white/5 bg-black/40 h-64 lg:h-72">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Monitor size={12} />
                Vision_Stream
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[9px] font-mono">
                  <span className="text-zinc-600">SYNC:</span>
                  <span className="text-[#00FFDD]">{syncStats.received}</span>
                </div>
                {!isScreenSharing && !remoteFrame ? (
                  <button 
                    onClick={() => startScreenSharing()} 
                    className="text-[9px] font-mono text-[#F27D26] border border-[#F27D26]/30 px-3 py-1 rounded-full hover:bg-[#F27D26]/10 transition-all flex items-center gap-1.5 group"
                    title="Share Entire Screen (Hint: Select 'Entire Screen' in the browser dialog)"
                  >
                    <Monitor size={10} className="group-hover:scale-110 transition-transform" />
                    SHARE_ENTIRE_SCREEN
                  </button>
                ) : isScreenSharing && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => stopScreenSharing()}
                      className="text-[9px] font-mono text-red-500 border border-red-500/30 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all"
                    >
                      STOP_SHARE
                    </button>
                    <button 
                      onClick={() => setIsBroadcasting(!isBroadcasting)}
                      className={`text-[9px] font-mono px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${isBroadcasting ? 'bg-[#00FFDD]/10 border-[#00FFDD] text-[#00FFDD] shadow-[0_0_10px_rgba(0,255,221,0.2)]' : 'bg-white/5 border-white/10 text-zinc-500'}`}
                    >
                      <Activity size={10} className={isBroadcasting ? "animate-pulse" : ""} />
                      {isBroadcasting ? 'SYNC_LIVE' : 'BROADCAST'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative h-full max-h-[180px] lg:max-h-[220px] rounded-xl overflow-hidden border border-white/5 bg-black/60 group">
              {(isScreenSharing || remoteFrame) ? (
                <>
                  <img 
                    src={`data:image/jpeg;base64,${isScreenSharing ? getLastFrame() : remoteFrame}`} 
                    className="w-full h-full object-contain"
                    alt="Vision Feed"
                  />
                  <button 
                    onClick={() => setIsFullscreenVision(true)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 border border-white/10 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <Activity size={14} className="rotate-45" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-700">
                  <Monitor size={24} strokeWidth={1} />
                  <span className="text-[9px] font-mono uppercase tracking-[0.3em]">No_Vision</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Terminal & History (Hidden on mobile if not active) */}
        <div className={`w-full lg:w-[400px] flex flex-col border-l border-white/5 bg-[#0A0A0C]/50 ${(activeTab === 'history' || activeTab === 'wiki') ? 'flex' : 'hidden lg:flex'}`}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <TerminalIcon size={12} />
              {activeTab === 'wiki' ? 'Knowledge_Graph' : 'Neural_History'}
            </h2>
            <div className="flex items-center gap-4">
              {activeTab !== 'wiki' && (
                <button 
                  onClick={() => setActiveTab('wiki')}
                  className="text-[9px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <Brain size={12} /> WIKI
                </button>
              )}
              {activeTab === 'wiki' && (
                <button 
                  onClick={() => setActiveTab('history')}
                  className="text-[9px] font-mono text-[#00FFDD] hover:text-[#00FFDD]/80 flex items-center gap-1"
                >
                  <TerminalIcon size={12} /> LOG
                </button>
              )}
              <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#00FFDD] animate-pulse' : 'bg-zinc-800'}`} />
              <span className="text-[9px] font-mono text-zinc-600 uppercase">{sessionId || 'OFFLINE'}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {activeTab === 'wiki' ? (
              <div className="space-y-4">
                {wikiEntries.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 grayscale pt-20">
                    <Brain size={48} strokeWidth={0.5} />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-center">Awaiting_Neural_Synthesis<br/>Study to generate knowledge</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {wikiEntries.map(entry => (
                      <motion.div 
                        key={entry.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setSelectedWikiEntry(selectedWikiEntry === entry.id ? null : entry.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedWikiEntry === entry.id ? 'bg-purple-500/10 border-purple-500/40' : 'bg-white/5 border-white/5 hover:border-purple-500/20'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[8px] font-mono text-purple-400 uppercase tracking-tighter">{entry.category || 'Concept'}</span>
                          <span className="text-[8px] font-mono text-zinc-600">{new Date(entry.lastUpdated.toDate?.() || entry.lastUpdated).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-xs font-bold text-white mb-1">{entry.title}</h3>
                        {selectedWikiEntry === entry.id ? (
                          <div className="text-[10px] leading-relaxed text-zinc-300 space-y-2 mt-2 border-t border-white/5 pt-2">
                             <div className="font-mono text-[9px] whitespace-pre-wrap text-zinc-300 leading-5">
                               {entry.content.split('\n').map((line, li) => {
                                 if (line.startsWith('### ')) return <div key={li} className="text-purple-300 font-bold text-[10px] mt-2">{line.slice(4)}</div>;
                                 if (line.startsWith('## ')) return <div key={li} className="text-purple-200 font-bold text-[11px] mt-3">{line.slice(3)}</div>;
                                 if (line.startsWith('# ')) return <div key={li} className="text-white font-bold text-xs mt-3">{line.slice(2)}</div>;
                                 if (line.startsWith('- ') || line.startsWith('* ')) return <div key={li} className="flex gap-1.5 ml-2"><span className="text-[#F27D26]">›</span><span>{line.slice(2).replace(/\*\*(.*?)\*\*/g, (_, t) => t)}</span></div>;
                                 if (line.startsWith('```')) return <div key={li} className="bg-black/40 border border-white/5 rounded px-2 py-0.5 font-mono text-[8px] text-[#00FFDD]">{line.slice(3)}</div>;
                                 const parts = line.split(/\*\*(.*?)\*\*/g);
                                 return <div key={li}>{parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-white font-semibold">{p}</strong> : p)}</div>;
                               })}
                             </div>
                             {entry.relatedConcepts && entry.relatedConcepts.length > 0 && (
                               <div className="flex flex-wrap gap-1 mt-3">
                                 {entry.relatedConcepts.map(link => (
                                   <span key={link} className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[8px] font-mono">
                                     #{link}
                                   </span>
                                 ))}
                               </div>
                             )}
                          </div>

                        ) : (
                          <p className="text-[10px] text-zinc-500 line-clamp-1">{entry.content}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 grayscale">
                    <Brain size={48} strokeWidth={0.5} />
                    <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting_Interaction</p>
                  </div>
                ) : (
                  history.map((msg, idx) => (
                    <div key={idx} className={`space-y-1 ${msg.role === 'assistant' ? 'border-l border-[#F27D26]/20 pl-4' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-mono font-bold tracking-tighter ${msg.role === 'user' ? 'text-zinc-500' : (msg.type === 'local' ? 'text-[#00FFDD]' : 'text-[#F27D26]')}`}>
                          {msg.role === 'user' ? 'AUTH_USER' : (msg.type === 'local' ? 'NODE_G4' : 'CLOUD_G1')}
                        </span>
                        <span className="text-[8px] font-mono text-zinc-800">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`text-xs leading-relaxed ${msg.role === 'user' ? 'text-zinc-400' : 'text-zinc-200'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                
                {/* Live Streaming Indicator */}
                {(localResponse || cloudResponse) && (
                  <div className="space-y-1 border-l border-[#00FFDD]/20 pl-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono font-bold tracking-tighter ${isLocalMode ? 'text-[#00FFDD]' : 'text-[#F27D26]'}`}>
                        {isLocalMode ? 'NODE_G4' : 'CLOUD_G1'}
                      </span>
                      <span className="text-[8px] font-mono text-zinc-500 animate-pulse">STREAMING...</span>
                    </div>
                    <div className="text-xs text-zinc-200 leading-relaxed">
                      {isLocalMode ? localResponse : cloudResponse}
                      <span className={`inline-block w-1 h-3 ml-1 animate-pulse ${isLocalMode ? 'bg-[#00FFDD]' : 'bg-[#F27D26]'}`} />
                    </div>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>

          {/* Quick Input (Desktop/History Tab Only) */}
          <div className="p-4 border-t border-white/5 bg-black/40">
             <div className="flex bg-black/40 p-1 rounded-lg border border-white/10 mb-3">
               <button 
                 onClick={() => setIsLocalMode(false)}
                 className={`flex-1 py-1 rounded text-[9px] font-mono transition-all ${!isLocalMode ? 'bg-[#F27D26] text-black font-bold' : 'text-zinc-600 hover:text-white'}`}
               >
                 CLOUD
               </button>
               <button 
                 onClick={() => setIsLocalMode(true)}
                 className={`flex-1 py-1 rounded text-[9px] font-mono transition-all ${isLocalMode ? 'bg-[#00FFDD] text-black font-bold' : 'text-zinc-600 hover:text-white'}`}
               >
                 LOCAL
               </button>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const promptInput = e.currentTarget.elements.namedItem('prompt') as HTMLInputElement;
                const input = promptInput.value;
                if (!input) return;
                
                const frame = isScreenSharing ? getLastFrame() : remoteFrame;
                promptInput.value = "";

                // 1. Save user message to history
                await addMessageToHistory('user', input, isLocalMode ? 'local' : 'cloud');

                if (isLocalMode) {
                  if (isLocalProcessing) return;
                  let fullResponse = "";
                  setLocalResponse("");
                  await generateLocalResponse(input, (partial) => {
                    fullResponse += partial;
                    setLocalResponse(fullResponse);
                  }, frame || undefined);
                  // 2. Save complete local response
                  await addMessageToHistory('assistant', fullResponse, 'local');
                  setLocalResponse("");
                } else {
                  if (!isConnected) {
                    setCloudResponse("System offline.");
                    setTimeout(() => setCloudResponse(""), 3000);
                    return;
                  }
                  await sendTextMessage(input, frame);
                  setCloudResponse("");
                }
              }}
              className="relative"
            >
              <input 
                name="prompt"
                autoComplete="off"
                disabled={(isLocalMode && !isLocalGemmaLoaded) || isLocalProcessing}
                placeholder={isLocalMode ? (isLocalGemmaLoaded ? "CMD..." : "WAIT...") : "MSG..."}
                className={`w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs font-mono focus:outline-none transition-all placeholder:text-zinc-600 ${isLocalMode ? 'focus:border-[#00FFDD]/30' : 'focus:border-[#F27D26]/30'}`}
              />
            </form>
          </div>
        </div>
      </main>

      {/* Active Recall Overlay */}
      <AnimatePresence>
        {activeQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg bg-zinc-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/10"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-3 text-purple-400">
                  <Brain className="animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Active_Recall_Phase</span>
                </div>
                
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {activeQuestion.question}
                </h2>

                <div className="space-y-4 pt-4">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Self-Evaluate Performance:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => submitAnswer(activeQuestion.id, 'easy')}
                      className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all text-left"
                    >
                      <div className="text-xs font-bold text-green-400">EASY</div>
                      <div className="text-[10px] text-green-700">Mastered</div>
                    </button>
                    <button 
                      onClick={() => submitAnswer(activeQuestion.id, 'good')}
                      className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-left"
                    >
                      <div className="text-xs font-bold text-blue-400">GOOD</div>
                      <div className="text-[10px] text-blue-700">Remembered</div>
                    </button>
                    <button 
                      onClick={() => submitAnswer(activeQuestion.id, 'hard')}
                      className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all text-left"
                    >
                      <div className="text-xs font-bold text-yellow-400">HARD</div>
                      <div className="text-[10px] text-yellow-700">Struggled</div>
                    </button>
                    <button 
                      onClick={() => submitAnswer(activeQuestion.id, 'again')}
                      className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-left"
                    >
                      <div className="text-xs font-bold text-red-400">AGAIN</div>
                      <div className="text-[10px] text-red-700">Forgot</div>
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                   <button 
                    onClick={() => setActiveQuestion(null)}
                    className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 uppercase"
                   >
                     Skip_Phase
                   </button>
                   <span className="text-[10px] font-mono text-purple-900">NEXUS_RECALL_V1</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MCP Modal */}
      <AnimatePresence>
        {isMCPOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#101114] border border-[#2A2B30] rounded-xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-[#2A2B30] flex justify-between items-center bg-[#1A1C23]">
                <div className="flex items-center gap-2 text-[#F27D26]">
                  <Activity size={18} />
                  <span className="font-mono font-bold tracking-wider">MCP Status</span>
                </div>
                <button onClick={() => setIsMCPOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 font-mono text-sm">
                <div className="flex justify-between items-center mb-4 text-xs opacity-60 uppercase border-b border-[#2A2B30] pb-2">
                  <span>Service</span>
                  <span>Status</span>
                </div>
                <div className="flex flex-col gap-3">
                   <div className="flex justify-between items-center">
                     <span>Nexus Assistant</span>
                     <span className={isConnected ? "text-[#00FF00]" : "text-zinc-500"}>{isConnected ? "ONLINE" : "STANDBY"}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span>Calendar Sync</span>
                     <span className="text-[#00FF00]">ACTIVE</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span>Screen Capture</span>
                     <span className={isScreenSharing ? "text-[#00FF00]" : "text-zinc-500"}>{isScreenSharing ? "ACTIVE" : "STANDBY"}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span>Task Database</span>
                     <span className="text-[#00FF00]">CONNECTED</span>
                   </div>
                </div>
                
                {syncMessage && (
                  <div className="mt-8 p-3 rounded bg-[#1A3835] border border-[#2A4845] text-[#00FF00] text-xs">
                    {syncMessage}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Modal */}
      <AnimatePresence>
        {isCalendarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#101114] border border-[#2A2B30] rounded-xl w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-[#2A2B30] flex justify-between items-center bg-[#1A1C23]">
                <div className="flex items-center gap-2">
                  <Calendar size={18} />
                  <span className="font-mono font-bold tracking-wider">Schedule</span>
                </div>
                <button onClick={() => setIsCalendarOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                 {/* Simple mock calendar view */}
                 <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-mono opacity-50 uppercase">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                 </div>
                 <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 35 }).map((_, i) => {
                       const day = i - 2; // Offset for mock calendar
                       const isToday = day === new Date().getDate();
                       const hasTask = day === 12 || day === 15 || day === 18;
                       
                       return (
                         <div 
                           key={i} 
                           className={`h-16 border rounded ${day > 0 && day <= 31 ? 'border-[#2A2B30] bg-[#1A1C23]' : 'border-transparent opacity-20'} 
                           ${isToday ? 'border-[#F27D26] ring-1 ring-[#F27D26]' : ''}
                           p-1 relative`}
                         >
                           {day > 0 && day <= 31 && (
                             <span className={`text-xs font-mono ${isToday ? 'text-[#F27D26]' : 'opacity-60'}`}>{day}</span>
                           )}
                           {hasTask && day > 0 && day <= 31 && (
                             <div className="absolute bottom-2 left-2 right-2 flex gap-1">
                                <div className="h-1 flex-1 bg-[#F27D26] rounded-full" />
                             </div>
                           )}
                         </div>
                       )
                    })}
                 </div>
                 
                 <div className="mt-6 flex justify-between items-center border-t border-[#2A2B30] pt-4">
                    <span className="text-sm font-mono opacity-60">Upcoming Deadlines</span>
                    <button onClick={handleSyncMCP} className="text-xs font-mono bg-[#1A3835] text-white px-3 py-1.5 rounded hover:bg-[#204541] flex items-center gap-2 border border-[#2A4845]">
                      <Activity size={14} /> SYNC
                    </button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Fullscreen Vision Overlay */}
      <AnimatePresence>
        {isFullscreenVision && (isScreenSharing || remoteFrame) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            <button 
              onClick={() => setIsFullscreenVision(false)}
              className="absolute top-6 right-6 z-[110] p-3 bg-white/10 border border-white/10 rounded-full text-white backdrop-blur-md hover:bg-white/20 transition-all"
            >
              <X size={24} />
            </button>
            
            <div className="absolute top-6 left-6 text-white/40 font-mono text-[10px] flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE_FULL_STREAM
            </div>

            <img 
              src={`data:image/jpeg;base64,${isScreenSharing ? getLastFrame() : remoteFrame}`} 
              className="w-full h-full object-contain"
              alt="Vision Full Feed"
            />

            <div className="absolute bottom-8 px-6 py-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-mono text-zinc-400">
              HINT: ROTATE DEVICE FOR BETTER VIEW
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
