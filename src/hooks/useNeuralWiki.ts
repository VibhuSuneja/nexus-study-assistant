import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, setDoc, orderBy, getDocs, where } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export interface WikiEntry {
  id: string;
  title: string;
  content: string;
  relatedConcepts: string[];
  category?: string;
  lastUpdated: any;
  masteryScore: number;
}

export function useNeuralWiki() {
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

    const q = query(collection(db, `users/${user.uid}/wiki`), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entryList: WikiEntry[] = [];
      snapshot.forEach((doc) => {
        entryList.push({ id: doc.id, ...doc.data() } as WikiEntry);
      });
      setEntries(entryList);
    });

    return unsubscribe;
  }, [user]);

  const upsertWikiEntry = async (args: { title: string, content: string, relatedConcepts?: string[], category?: string }) => {
    if (!user) return { error: "Not authenticated" };
    setIsSyncing(true);
    try {
      const wikiColl = collection(db, `users/${user.uid}/wiki`);
      // Check if entry with this title already exists
      const q = query(wikiColl, where("title", "==", args.title));
      const existing = await getDocs(q);

      if (!existing.empty) {
        const entryDoc = existing.docs[0];
        await updateDoc(doc(db, `users/${user.uid}/wiki`, entryDoc.id), {
          content: args.content,
          relatedConcepts: args.relatedConcepts || [],
          category: args.category || 'General',
          lastUpdated: new Date()
        });
      } else {
        await addDoc(wikiColl, {
          title: args.title,
          content: args.content,
          relatedConcepts: args.relatedConcepts || [],
          category: args.category || 'General',
          masteryScore: 0,
          lastUpdated: new Date()
        });
      }
      return { success: true };
    } catch (e) {
      console.error("Wiki Upsert Error:", e);
      return { error: e };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    entries,
    isSyncing,
    upsertWikiEntry
  };
}
