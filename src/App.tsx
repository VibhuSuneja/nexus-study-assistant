import { useState } from "react";
import { NexusProvider, useNexus } from "./context/NexusContext";
import Dashboard from "./components/Dashboard";
import FocusRoom from "./components/FocusRoom";
import Pomodoro from "./components/Pomodoro";

type View = 'dashboard' | 'pomodoro';

function AppContent() {
  const { isLockedIn, setIsLockedIn } = useNexus();
  const [view, setView] = useState<View>('dashboard');

  if (isLockedIn) {
    return <FocusRoom onBack={() => setIsLockedIn(false)} />;
  }

  if (view === 'pomodoro') {
    return <Pomodoro onBack={() => setView('dashboard')} />;
  }

  return <Dashboard onNavigateToAudio={() => setView('pomodoro')} />;
}

export default function App() {
  return (
    <NexusProvider>
      <AppContent />
    </NexusProvider>
  );
}
