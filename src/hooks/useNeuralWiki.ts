import { useState, useEffect } from 'react';
import { db, auth, storage, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  orderBy, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export interface WikiEntry {
  id: string;
  title: string;
  content: string;
  relatedConcepts: string[];
  category?: string;
  lastUpdated: any;
  masteryScore: number;
  imageUrl?: string;
  embedding?: number[];
}

export function useNeuralWiki() {
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setEntries([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, `users/${userId}/wiki`),
      orderBy('lastUpdated', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const wikiEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WikiEntry[];
      setEntries(wikiEntries);
    });

    return () => unsub();
  }, [userId]);

  const upsertWikiEntry = async (entry: Partial<WikiEntry>, imageBlob?: string) => {
    if (!userId) return;
    setIsSyncing(true);
    try {
      let imageUrl = entry.imageUrl;
      if (imageBlob) {
        const storageRef = ref(storage, `wiki/${userId}/${Date.now()}.jpg`);
        await uploadString(storageRef, imageBlob, 'data_url');
        imageUrl = await getDownloadURL(storageRef);
      }

      const wikiRef = collection(db, `users/${userId}/wiki`);
      const q = query(wikiRef, where('title', '==', entry.title));
      const existing = await getDocs(q);

      const entryData = {
        title: entry.title,
        content: entry.content,
        relatedConcepts: entry.relatedConcepts || [],
        category: entry.category || 'General',
        lastUpdated: new Date(),
        masteryScore: entry.masteryScore || 0,
        imageUrl
      };

      if (!existing.empty) {
        await updateDoc(doc(db, `users/${userId}/wiki`, existing.docs[0].id), entryData);
      } else {
        await addDoc(wikiRef, entryData);
      }
    } catch (e) {
      console.error("Error upserting wiki entry:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateMastery = async (conceptTitle: string, score: number) => {
    if (!userId) return;
    try {
      const q = query(collection(db, `users/${userId}/wiki`), where('title', '==', conceptTitle));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, `users/${userId}/wiki`, snap.docs[0].id), {
          masteryScore: score,
          lastUpdated: new Date()
        });
      }
    } catch (e) {
      console.error("Error updating mastery:", e);
    }
  };

  const semanticSearch = async (queryText: string, nexusContext?: { course?: string, activeTask?: string }) => {
    if (!userId) return [];
    try {
      const searchFn = httpsCallable(functions, 'semanticWikiSearch');
      const response = await searchFn({ queryText, limit: 10 });
      
      let results = (response.data as any).results as WikiEntry[];
      if (!results) return [];

      if (nexusContext) {
        results = results.sort((a, b) => {
          const aMatch = (nexusContext.course && a.category === nexusContext.course) || 
                         (nexusContext.activeTask && a.title.includes(nexusContext.activeTask));
          const bMatch = (nexusContext.course && b.category === nexusContext.course) || 
                         (nexusContext.activeTask && b.title.includes(nexusContext.activeTask));
          
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }

      return results;
    } catch (e) {
      console.error("Semantic Search Error:", e);
      return [];
    }
  };

  return {
    entries,
    isSyncing,
    upsertWikiEntry,
    updateMastery,
    semanticSearch
  };
}
