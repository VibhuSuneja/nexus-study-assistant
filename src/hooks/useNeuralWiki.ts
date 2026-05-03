import { useState, useEffect } from 'react';
import { db, auth, storage } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, setDoc, orderBy, getDocs, where } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
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

  const upsertWikiEntry = async (args: { title: string, content: string, relatedConcepts?: string[], category?: string, frame?: string }) => {
    if (!user) return { error: "Not authenticated" };
    setIsSyncing(true);
    try {
      let imageUrl = "";
      if (args.frame) {
        try {
          const imageRef = ref(storage, `wiki/${user.uid}/${Date.now()}.jpg`);
          // Note: frame is usually base64. Ensure correct format.
          const uploadResult = await uploadString(imageRef, args.frame, 'base64');
          imageUrl = await getDownloadURL(uploadResult.ref);
        } catch (imgErr) {
          console.error("Failed to upload visual snapshot:", imgErr);
        }
      }

      const wikiColl = collection(db, `users/${user.uid}/wiki`);
      // Check if entry with this title already exists
      const q = query(wikiColl, where("title", "==", args.title));
      const existing = await getDocs(q);

      if (!existing.empty) {
        const entryDoc = existing.docs[0];
        const updates: any = {
          content: args.content,
          relatedConcepts: args.relatedConcepts || [],
          category: args.category || 'General',
          lastUpdated: new Date()
        };
        if (imageUrl) updates.imageUrl = imageUrl;
        
        await updateDoc(doc(db, `users/${user.uid}/wiki`, entryDoc.id), updates);
      } else {
        const newData: any = {
          title: args.title,
          content: args.content,
          relatedConcepts: args.relatedConcepts || [],
          category: args.category || 'General',
          masteryScore: 0,
          lastUpdated: new Date()
        };
        if (imageUrl) newData.imageUrl = imageUrl;
        
        await addDoc(wikiColl, newData);
      }
      return { success: true };
    } catch (e) {
      console.error("Wiki Upsert Error:", e);
      return { error: e };
    } finally {
      setIsSyncing(false);
    }
  };

  const updateMastery = async (args: { conceptTitle: string, masteryScore: number, gaps?: string[] }) => {
    if (!user) return { error: "Not authenticated" };
    try {
      const q = query(collection(db, `users/${user.uid}/wiki`), where("title", "==", args.conceptTitle));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        const entryDoc = existing.docs[0];
        const data = entryDoc.data();
        await updateDoc(doc(db, `users/${user.uid}/wiki`, entryDoc.id), {
          masteryScore: args.masteryScore,
          // Append gaps to content or maybe store them in a new field if we want
          content: args.gaps && args.gaps.length > 0 
            ? `${data.content}\n\n### Identified Gaps:\n${args.gaps.map(g => `- ${g}`).join('\n')}`
            : data.content
        });
        return { success: true };
      }
      return { error: "Concept not found" };
    } catch (e) {
      console.error("Mastery Update Error:", e);
      return { error: e };
    }
  };

  return {
    entries,
    isSyncing,
    upsertWikiEntry,
    updateMastery
  };
}
