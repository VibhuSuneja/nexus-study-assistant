import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, getDocs, limit } from 'firebase/firestore';

export interface RecallQuestion {
  id: string;
  question: string;
  answerKey: string;
  conceptId?: string;
  dueDate: any;
  difficulty: number;
  attempts: number;
}

export function useActiveRecall() {
  const [questions, setQuestions] = useState<RecallQuestion[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<RecallQuestion | null>(null);
  const [user, setUser] = useState<any>(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for questions that are due now or in the past
    const q = query(
      collection(db, `users/${user.uid}/recall_queue`), 
      where('dueDate', '<=', new Date()),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qList: RecallQuestion[] = [];
      snapshot.forEach((doc) => {
        qList.push({ id: doc.id, ...doc.data() } as RecallQuestion);
      });
      setQuestions(qList);
    });

    return unsubscribe;
  }, [user]);

  const generateRecallQuestion = async (args: { question: string, answerKey: string, conceptId?: string }) => {
    if (!user) return { error: "Not authenticated" };
    try {
      await addDoc(collection(db, `users/${user.uid}/recall_queue`), {
        ...args,
        dueDate: new Date(), // Due immediately for first review
        difficulty: 0,
        attempts: 0,
        createdAt: new Date()
      });
      return { success: true };
    } catch (e) {
      return { error: e };
    }
  };

  const submitAnswer = async (questionId: string, performance: 'easy' | 'good' | 'hard' | 'again') => {
    if (!user) return;
    const qRef = doc(db, `users/${user.uid}/recall_queue`, questionId);
    
    // Simple SM-2 style logic for next due date
    let daysToAdd = 1;
    if (performance === 'easy') daysToAdd = 7;
    else if (performance === 'good') daysToAdd = 3;
    else if (performance === 'hard') daysToAdd = 1;
    else daysToAdd = 0; // Again means review again very soon

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + daysToAdd);

    await updateDoc(qRef, {
      dueDate: nextDue,
      attempts: (activeQuestion?.attempts || 0) + 1,
      lastPerformance: performance
    });
    
    setActiveQuestion(null);
  };

  return {
    questions,
    activeQuestion,
    setActiveQuestion,
    generateRecallQuestion,
    submitAnswer
  };
}
