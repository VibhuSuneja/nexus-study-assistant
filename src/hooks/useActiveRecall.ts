import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, Timestamp } from 'firebase/firestore';

export interface RecallQuestion {
  id: string;
  question: string;
  answerKey: string;
  conceptId?: string;
  dueDate: Timestamp;
  easeFactor: number;
  interval: number;
  repetitions: number;
  lastPerformance?: string;
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

    // Listen for questions that are due now or in the past from 'flashcards' collection
    const q = query(
      collection(db, `users/${user.uid}/flashcards`), 
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
      await addDoc(collection(db, `users/${user.uid}/flashcards`), {
        ...args,
        dueDate: new Date(), // Due immediately for first review
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        createdAt: new Date()
      });
      return { success: true };
    } catch (e) {
      return { error: e };
    }
  };

  const submitAnswer = async (questionId: string, performance: 'easy' | 'good' | 'hard' | 'again') => {
    if (!user) return;
    
    // Find the question in the current state to get its SR parameters
    const question = questions.find(q => q.id === questionId) || activeQuestion;
    if (!question) return;

    const qRef = doc(db, `users/${user.uid}/flashcards`, questionId);
    
    // SM-2 Algorithm Implementation
    // Quality mapping: easy: 5, good: 4, hard: 2, again: 0
    let quality = 0;
    if (performance === 'easy') quality = 5;
    else if (performance === 'good') quality = 4;
    else if (performance === 'hard') quality = 2;
    else if (performance === 'again') quality = 0;

    let { repetitions, interval, easeFactor } = question;

    if (performance === 'again') {
      repetitions = 0;
      interval = 1;
      // Ease factor stays same or decreases slightly as per some variations
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
      
      // Update Ease Factor based on performance
      // easy: 5, good: 4, hard: 2
      const quality = performance === 'easy' ? 5 : performance === 'good' ? 4 : 3;
      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;
    }

    const nextDue = new Date();
    // Special case for 'again': set due in 10 minutes (0 days but logic needs adjustment)
    // For this prototype, we'll just set it to 1 day minimum or stay at 0.
    if (performance === 'again') {
      nextDue.setMinutes(nextDue.getMinutes() + 10);
    } else {
      nextDue.setDate(nextDue.getDate() + interval);
    }

    await updateDoc(qRef, {
      dueDate: Timestamp.fromDate(nextDue),
      repetitions,
      interval,
      easeFactor,
      lastPerformance: performance
    });
    
    setActiveQuestion(null);
  };

  return {
    questions,
    activeQuestion,
    setActiveQuestion,
    generateRecallQuestion,
    submitAnswer,
    dueCount: questions.length
  };
}
