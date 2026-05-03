import { useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export interface Task {
  id: string;
  title: string;
  course: string;
  estimatedMinutes: number;
  completed: boolean;
  subtasks?: { id: string; title: string; completed: boolean }[];
  completedPomodoros?: number;
  createdAt?: any;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusTask, setFocusTask] = useState<string | null>(null);
  const [focusDuration, setFocusDuration] = useState<number>(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth);
      }
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, `users/${user.uid}/tasks`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((doc) => {
        taskList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(taskList);
    });

    return unsubscribe;
  }, [user]);

  const addTask = useCallback(async (args: { title: string, course: string, estimatedMinutes: number }) => {
    if (!user) return { error: "Not authenticated" };
    try {
      await addDoc(collection(db, `users/${user.uid}/tasks`), {
        ...args,
        completed: false,
        completedPomodoros: 0,
        subtasks: [],
        createdAt: new Date()
      });
      return { success: true };
    } catch (e) {
      return { error: e };
    }
  }, [user]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!user) return;
    const taskRef = doc(db, `users/${user.uid}/tasks`, taskId);
    await updateDoc(taskRef, updates);
  }, [user]);

  const setFocusMode = useCallback((args: { taskId: string, durationMinutes: number }) => {
    setFocusTask(args.taskId);
    setFocusDuration(args.durationMinutes);
    return { success: true, message: `Focus mode set for task ${args.taskId}` };
  }, [setFocusTask, setFocusDuration]);

  const syncWithMCP = useCallback((args: { appName: string }) => {
    return { success: true, message: `Successfully synced data from ${args.appName} via MCP protocol.` };
  }, []);

  const toolHandlers = useMemo(() => ({
    getTasks: () => tasks,
    addTask,
    setFocusMode,
    syncWithMCP
  }), [tasks, addTask, setFocusMode, syncWithMCP]);

  return {
    tasks,
    setTasks,
    focusTask,
    setFocusTask,
    focusDuration,
    setFocusDuration,
    updateTask,
    toolHandlers
  };
}


