import { motion } from "motion/react";
import { 
  Play, Pause, RefreshCcw, Lock, Timer, 
  CheckCircle2, Circle, ListTodo, ArrowLeft,
  CloudRain, Wind, Music, Volume2, Waves
} from "lucide-react";
import { useNexus } from "../context/NexusContext";
import { useTasks } from "../hooks/useTasks";
import { useState, useEffect } from "react";
import { AmbientNoise, NoiseType } from "../utils/AmbientNoise";
import { useSessionSync } from "../hooks/useSessionSync";
import { Users, Globe, Activity } from "lucide-react";

interface FocusRoomProps {
  onBack: () => void;
}

export default function FocusRoom({ onBack }: FocusRoomProps) {
  const { 
    secondsRemaining, isRunning, toggleTimer, formatTime, resetTimer,
    setIsLockedIn, focusState
  } = useNexus();
  const { nearbyNodes } = useSessionSync();

  const { tasks, focusTask, updateTask } = useTasks();
  const currentTask = focusTask ? tasks.find(t => t.id === focusTask) : null;

  const [activeNoises, setActiveNoises] = useState<NoiseType[]>([]);
  const [volumes, setVolumes] = useState<Record<NoiseType, number>>({
    rain: 0.5,
    white: 0.5,
    lofi: 0.5,
    forest: 0.5
  });

  useEffect(() => {
    return () => {
      AmbientNoise.stop();
    };
  }, []);

  const handleToggleSubtask = (subtaskId: string) => {
    if (!currentTask || !currentTask.subtasks) return;
    const newSubtasks = currentTask.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTask(currentTask.id, { subtasks: newSubtasks });
  };

  const handleToggleNoise = (type: NoiseType) => {
    if (activeNoises.includes(type)) {
      AmbientNoise.stop(type);
      setActiveNoises(prev => prev.filter(n => n !== type));
    } else {
      AmbientNoise.start(type, volumes[type]);
      setActiveNoises(prev => [...prev, type]);
    }
  };

  const handleVolumeChange = (type: NoiseType, newVol: number) => {
    setVolumes(prev => ({ ...prev, [type]: newVol }));
    AmbientNoise.setVolume(newVol, type);
  };

  const handleExit = () => {
    AmbientNoise.stop();
    setIsLockedIn(false);
    onBack();
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-300 flex flex-col font-sans overflow-hidden relative">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,#F27D2615,transparent_50%)]" />
      </div>

      {/* Header */}
      <header className="z-50 h-20 px-8 flex items-center justify-between backdrop-blur-sm bg-black/20 border-b border-white/5">
        <button 
          onClick={handleExit}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all group"
        >
          <div className="p-2 rounded-full border border-white/5 group-hover:border-white/20 bg-white/5">
            <ArrowLeft size={18} />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Abort_Session</span>
        </button>

        <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-[#F27D26]/30 bg-[#F27D26]/5">
           <Lock size={12} className="text-[#F27D26] animate-pulse" />
           <span className="text-[10px] font-mono text-[#F27D26] font-bold uppercase tracking-widest">Deep_Focus_Active</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Nexus_Vision</span>
          <span className="text-[8px] font-mono text-zinc-600 uppercase">Focus_Module_v2.1</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-12 relative z-10 overflow-hidden">
        
        {/* Left Column: Mission Info & Subtasks */}
        <div className="hidden lg:flex lg:col-span-4 flex-col p-8 border-r border-white/5 bg-black/20">
          <div className="mb-12">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Timer size={14} /> Mission_Objective
            </h3>
            <span className="text-[10px] font-mono text-[#F27D26] uppercase mb-2 block">{currentTask?.course || 'GENERAL'}</span>
            <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{currentTask?.title || 'Unspecified Study Session'}</h2>
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < (currentTask?.completedPomodoros || 0) ? 'bg-[#F27D26]' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <ListTodo size={14} /> Subtask_Sequence
            </h3>
            <div className="space-y-4 mb-12">
              {currentTask?.subtasks?.map(st => (
                <motion.div 
                   key={st.id}
                   onClick={() => handleToggleSubtask(st.id)}
                   className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className={`mt-0.5 transition-colors ${st.completed ? 'text-[#00FFDD]' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                    {st.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </div>
                  <span className={`text-sm transition-all ${st.completed ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
                    {st.title}
                  </span>
                </motion.div>
              ))}
              {(!currentTask?.subtasks || currentTask.subtasks.length === 0) && (
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest italic">No_Subtasks_Defined</p>
              )}
            </div>

            {/* Ambient Soundscapes */}
            <div className="pt-8 border-t border-white/5 mb-12">
              <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Volume2 size={14} /> Ambient_Soundscape
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: 'rain', icon: CloudRain, label: 'Heavy Rain' },
                  { id: 'white', icon: Wind, label: 'White Noise' },
                  { id: 'lofi', icon: Music, label: 'Lofi Beats' },
                  { id: 'forest', icon: Waves, label: 'Deep Forest' }
                ].map((noise) => (
                  <div key={noise.id} className="flex flex-col gap-2">
                    <button
                      onClick={() => handleToggleNoise(noise.id as NoiseType)}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${activeNoises.includes(noise.id as NoiseType) ? 'bg-[#F27D26]/10 border-[#F27D26]/40 text-[#F27D26]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'}`}
                    >
                      <noise.icon size={20} className={activeNoises.includes(noise.id as NoiseType) ? 'animate-pulse' : ''} />
                      <span className="text-[9px] font-mono uppercase tracking-wider">{noise.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Presence Grid (New Feature) */}
            <div className="mt-auto pt-8 border-t border-white/5">
              <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><Users size={14} /> Shared_Focus_Grid</span>
                <span className="text-[#00FFDD] text-[8px]">{nearbyNodes.length + 1} Active</span>
              </h3>
              
              <div className="grid grid-cols-4 gap-2">
                {/* Local User Node */}
                <div className="aspect-square rounded-xl bg-[#F27D26]/10 border border-[#F27D26]/20 flex items-center justify-center relative overflow-hidden group">
                  <div className={`w-2 h-2 rounded-full z-10 ${focusState === 'attentive' ? 'bg-[#00FFDD]' : focusState === 'distracted' ? 'bg-[#FF4B2B]' : 'bg-[#8B5CF6]'}`} />
                  <div className={`absolute inset-0 opacity-20 ${focusState === 'attentive' ? 'bg-[#00FFDD]' : focusState === 'distracted' ? 'bg-[#FF4B2B]' : 'bg-[#8B5CF6]'}`} />
                  <span className="absolute bottom-1 text-[6px] font-mono uppercase text-white/40">You</span>
                </div>

                {/* Nearby Nodes */}
                {nearbyNodes.map((node) => (
                  <div key={node.id} className="aspect-square rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden group">
                    <div className={`w-1.5 h-1.5 rounded-full z-10 ${node.focusState === 'attentive' ? 'bg-[#00FFDD]' : node.focusState === 'distracted' ? 'bg-[#FF4B2B]' : 'bg-[#8B5CF6]'}`} />
                    <div className={`absolute inset-0 opacity-10 ${node.focusState === 'attentive' ? 'bg-[#00FFDD]' : node.focusState === 'distracted' ? 'bg-[#FF4B2B]' : 'bg-[#8B5CF6]'}`} />
                    <span className="absolute bottom-1 text-[6px] font-mono uppercase text-white/30 truncate px-1 w-full text-center">
                      {node.name.split(' ')[0]}
                    </span>
                    
                    {/* Hover info */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                      <span className="text-[6px] font-mono text-white text-center px-1 uppercase">{node.name}</span>
                      <span className="text-[5px] font-mono text-zinc-500 uppercase">{node.sessionType}</span>
                    </div>
                  </div>
                ))}

                {/* Empty slots to fill the grid feel */}
                {Array.from({ length: Math.max(0, 7 - nearbyNodes.length) }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl border border-dashed border-white/5 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center/Main Column: The Timer */}
        <div className="col-span-12 lg:col-span-8 flex flex-col items-center justify-center p-8 relative overflow-hidden">
           {/* Scanline Effect Overlay */}
           <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

           {/* Corner Accents */}
           <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/10 pointer-events-none" />
           <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/10 pointer-events-none" />
           <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/10 pointer-events-none" />
           <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/10 pointer-events-none" />

           {/* Focus Glow */}
           <motion.div 
             animate={{ 
               scale: isRunning ? [1, 1.1, 1] : 1,
               opacity: isRunning ? [0.2, 0.4, 0.2] : 0.15
             }}
             transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
             className={`absolute w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none ${focusState === 'distracted' ? 'bg-red-500/20' : 'bg-[#F27D26]/20'}`}
           />

           <div className="text-center z-10">
              <div className="mb-4 flex items-center justify-center gap-4">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Temporal_Synchronization</span>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
              </div>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onClick={toggleTimer}
                className={`font-mono text-8xl md:text-[13rem] font-extralight tracking-tighter tabular-nums mb-8 cursor-pointer hover:opacity-80 transition-all duration-700 ${focusState === 'distracted' ? 'text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.3)]' : 'text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.1)]'}`}
              >
                {formatTime(secondsRemaining)}
              </motion.div>

             <div className="flex items-center justify-center gap-10 mb-12">
               <button 
                 onClick={() => resetTimer()}
                 className="p-6 rounded-full border border-white/5 text-zinc-600 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all group"
                 title="Reset Sequence"
               >
                 <RefreshCcw size={28} className="group-hover:rotate-180 transition-transform duration-500" />
               </button>
               
               <button 
                 onClick={toggleTimer}
                 className={`w-36 h-36 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 group relative overflow-hidden ${isRunning ? 'bg-white/5 border border-white/20 text-white' : 'bg-white text-black shadow-[0_0_60px_rgba(255,255,255,0.25)]'}`}
               >
                 {/* Internal pulse effect */}
                 {isRunning && <div className="absolute inset-0 bg-[#F27D26]/10 animate-pulse" />}
                 {isRunning ? <Pause size={56} fill="currentColor" /> : <Play size={56} className="ml-2" fill="currentColor" />}
               </button>

               <div className="flex flex-col items-center gap-3">
                 <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${isRunning ? 'border-[#00FFDD]/30 text-[#00FFDD]' : 'border-white/5 text-zinc-700'}`}>
                   <Activity size={24} className={isRunning ? 'animate-pulse' : ''} />
                 </div>
                 <span className="text-[7px] font-mono uppercase text-zinc-600 tracking-widest">Pulse</span>
               </div>
             </div>

             <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
               {[25, 50, 15].map(mins => (
                 <button 
                   key={mins}
                   onClick={() => resetTimer(mins)}
                   className={`px-8 py-3 rounded-xl border text-[10px] font-mono uppercase transition-all duration-300 ${secondsRemaining === mins * 60 ? 'bg-white/10 border-[#F27D26]/50 text-white shadow-[0_0_20px_rgba(242,125,38,0.15)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/20'}`}
                 >
                   {mins}m_SEQ
                 </button>
               ))}
             </div>
           </div>

           {/* Telemetry Footer inside main area */}
           <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-12 text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em] whitespace-nowrap">
             <div className="flex items-center gap-2">
               <Globe size={10} className="text-zinc-700" /> 
               <span>Signal_Strength: 100%</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
               <span>Latency: 24ms</span>
             </div>
             <div className="flex items-center gap-2">
               <span>Nodes: {nearbyNodes.length + 1}</span>
             </div>
           </div>
        </div>
      </main>

      <footer className="h-12 flex items-center justify-center opacity-20 border-t border-white/5 px-8">
         <span className="text-[8px] font-mono tracking-[1em] uppercase">Security_Protocol_V_Alpha // Neural_Shield_Active</span>
      </footer>
    </div>
  );
}
