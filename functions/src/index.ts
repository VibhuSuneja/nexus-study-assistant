import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const { helpers, v1 } = require('@google-cloud/aiplatform');

admin.initializeApp();

const clientOptions = {
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
};
const predictionServiceClient = new v1.PredictionServiceClient(clientOptions);

async function getEmbeddingVector(text: string) {
  const project = process.env.GCLOUD_PROJECT;
  const location = 'us-central1';
  const publisher = 'google';
  const model = 'text-embedding-004';
  const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${model}`;

  const instance = helpers.toValue({ content: text, task_type: 'RETRIEVAL_DOCUMENT' });
  const instances = [instance];
  const parameters = helpers.toValue({});

  const request = { endpoint, instances, parameters };
  const [response] = await predictionServiceClient.predict(request);
  
  const embeddings = response.predictions[0].structValue.fields.embeddings.structValue.fields.values.listValue.values;
  return embeddings.map((v: any) => v.numberValue);
}

/**
 * Triggered when a wiki entry is created or updated.
 * Generates and stores a vector embedding for semantic search.
 */
export const onWikiEntryWritten = functions.firestore
  .document("users/{userId}/wiki/{entryId}")
  .onWrite(async (change, context) => {
    const data = change.after.data();
    if (!data || !data.content) return null;

    const previousData = change.before.data();
    if (previousData && previousData.content === data.content && previousData.embedding) {
      return null; // No change in content, no need to re-embed
    }

    try {
      const vector = await getEmbeddingVector(data.content);
      // Store as VectorValue for Firestore Vector Search
      return change.after.ref.update({
        embedding: admin.firestore.FieldValue.vector(vector),
        lastEmbedded: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Embedding Generation Error:", error);
      return null;
    }
  });

/**
 * HTTPS Function to get embedding for a query string (called by frontend).
 */
export const getEmbedding = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const text = data.text;
  if (!text) {
    throw new functions.https.HttpsError('invalid-argument', 'Text is required.');
  }

  try {
    const embedding = await getEmbeddingVector(text);
    return { embedding };
  } catch (error) {
    console.error("Query Embedding Error:", error);
    throw new functions.https.HttpsError('internal', 'Failed to generate embedding.');
  }
});

/**
 * HTTPS Function to perform semantic search on wiki entries.
 */
export const semanticWikiSearch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const queryText = data.queryText;
  const limit = data.limit || 10;
  if (!queryText) {
    throw new functions.https.HttpsError('invalid-argument', 'queryText is required.');
  }

  const userId = context.auth.uid;

  try {
    // 1. Generate embedding for the query
    const embedding = await getEmbeddingVector(queryText);

    // 2. Perform Vector Search using findNearest
    const wikiColl = admin.firestore().collection(`users/${userId}/wiki`);
    
    // Note: findNearest is available on CollectionReference and Query in Admin SDK
    const vectorQuery = wikiColl.findNearest({
      vectorField: 'embedding',
      queryVector: admin.firestore.FieldValue.vector(embedding),
      limit: limit,
      distanceMeasure: 'COSINE'
    });

    const snapshot = await vectorQuery.get();
    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { results };
  } catch (error) {
    console.error("Semantic Search Function Error:", error);
    throw new functions.https.HttpsError('internal', 'Failed to perform semantic search.');
  }
});

/**
 * Triggered when a task is marked as completed.
 * Awards study credits based on focus performance.
 */
export const onTaskCompleted = functions.firestore
  .document("users/{userId}/tasks/{taskId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    // Check if task was just marked as completed
    if (newData && newData.completed && oldData && !oldData.completed) {
      const userId = context.params.userId;
      
      // Award 100 credits per completed pomodoro, minimum 100
      const pomodoros = newData.completedPomodoros || 1;
      const creditsToAward = pomodoros * 100;

      const userRef = admin.firestore().doc(`users/${userId}`);
      
      try {
        await admin.firestore().runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const currentCredits = userDoc.data()?.studyCredits || 0;
          transaction.set(userRef, { 
            studyCredits: currentCredits + creditsToAward,
            lastCreditAward: admin.firestore.FieldValue.serverTimestamp(),
            totalPomodoros: (userDoc.data()?.totalPomodoros || 0) + pomodoros
          }, { merge: true });
        });
        console.log(`Awarded ${creditsToAward} credits to user ${userId}`);
      } catch (e) {
        console.error("Error awarding credits:", e);
      }
    }
    return null;
  });
