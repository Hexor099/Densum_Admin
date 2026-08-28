import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, get, set, child, update, runTransaction } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  databaseURL: "https://dentallabsync-default-rtdb.firebaseio.com/",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy_api_key_for_build",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Helper functions for Firebase
export const fetchData = async (path: string) => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, path));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error("Error fetching data from Firebase:", error);
    return null;
  }
};

export const writeData = async (path: string, data: any) => {
  try {
    await set(ref(db, path), data);
    return { success: true };
  } catch (error) {
    console.error("Error writing data to Firebase:", error);
    return { success: false, error };
  }
};

export const updateData = async (path: string, data: any) => {
  try {
    await update(ref(db, path), data);
    return { success: true };
  } catch (error) {
    console.error("Error updating data in Firebase:", error);
    return { success: false, error };
  }
};

export { app, db, auth, storage };

/**
 * Atomically increment a numeric value at a Firebase path.
 * Uses runTransaction to prevent race conditions on balance updates.
 */
export const atomicIncrement = async (path: string, delta: number) => {
  try {
    const dbRef = ref(db, path);
    await runTransaction(dbRef, (currentValue) => {
      return (Number(currentValue) || 0) + delta;
    });
    return { success: true };
  } catch (error) {
    console.error("Error in atomic increment:", error);
    return { success: false, error };
  }
};

/**
 * Atomically append an item to a list at a Firebase path.
 * Uses runTransaction to prevent concurrent overwrites.
 */
export const appendToList = async (path: string, newItem: any) => {
  try {
    const dbRef = ref(db, path);
    await runTransaction(dbRef, (currentList) => {
      const list = Array.isArray(currentList) ? currentList : (currentList ? Object.values(currentList) : []);
      return [...list, newItem];
    });
    return { success: true };
  } catch (error) {
    console.error("Error appending to list:", error);
    return { success: false, error };
  }
};
