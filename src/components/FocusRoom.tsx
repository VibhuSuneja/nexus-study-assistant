import { motion } from "motion/react";
import { 
  Play, Pause, RefreshCcw, Lock, Timer, 
  CheckCircle2, Circle, ListTodo, ArrowLeft
} from "lucide-react";
import { useNexus } from "../context/NexusContext";
import { useTasks } from "../hooks/useTasks";

interface FocusRoomProps {
  onBack: () => void;
}

export default function FocusRoom({ onBack }: FocusRoomProps) {
  const { 
    secondsRemaining, isRunning, toggleTimer, formatTime, resetTimer,
    setIsLockedIn
  } = useNexus();

  const { tasks, focusTask, updateTask } = useTasks();
  
  const currentTask = focusTask ? tasks.find(t => t.id === focusTask) : null;

  const handleToggleSubtask = (subtaskId: string) => {
    if (!currentTask || !currentTask.subtasks) return;
    const newSubtasks = currentTask.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTask(currentTask.id, { subtasks: newSubtasks });
  };

  const handleExit = () => {
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
            <div className="space-y-4">
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
          </div>
        </div>

        {/* Center/Main Column: The Timer */}
        <div className="col-span-12 lg:col-span-8 flex flex-col items-center justify-center p-8 relative">
           {/* Focus Glow */}
           <motion.div 
             animate={{ 
               scale: isRunning ? [1, 1.05, 1] : 1,
               opacity: isRunning ? [0.3, 0.5, 0.3] : 0.2
             }}
             transition={{ duration: 4, repeat: Infinity }}
             className="absolute w-[500px] h-[500px] bg-[#F27D26]/10 blur-[100px] rounded-full pointer-events-none"
           />

           <div className="text-center z-10">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onClick={toggleTimer}
                className="font-mono text-8xl md:text-[12rem] font-extralight tracking-tighter tabular-nums text-white mb-8 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {formatTime(secondsRemaining)}
              </motion.div>

             <div className="flex items-center justify-center gap-8 mb-12">
               <button 
                 onClick={() => resetTimer()}
                 className="p-6 rounded-full border border-white/5 text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
               >
                 <RefreshCcw size={28} />
               </button>
               
               <button 
                 onClick={toggleTimer}
                 className={`w-32 h-32 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isRunning ? 'bg-white/5 border border-white/20 text-white' : 'bg-white text-black shadow-[0_0_50px_rgba(255,255,255,0.2)]'}`}
               >
                 {isRunning ? <Pause size={48} fill="currentColor" /> : <Play size={48} className="ml-2" fill="currentColor" />}
               </button>

               <div className="w-16 h-16 opacity-40">
                 <div className="w-full h-full rounded-full bg-gradient-to-br from-[#F27D26]/20 to-transparent animate-pulse" />
               </div>
             </div>

             <div className="grid grid-cols-3 gap-3">
               {[25, 50, 15].map(mins => (
                 <button 
                   key={mins}
                   onClick={() => resetTimer(mins)}
                   className={`px-6 py-2 rounded-lg border text-[10px] font-mono uppercase transition-all ${secondsRemaining === mins * 60 ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10'}`}
                 >
                   {mins}m
                 </button>
               ))}
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
