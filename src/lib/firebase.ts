import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, get, set, child, update } from "firebase/database";

const firebaseConfig = {
  databaseURL: "https://dentallabsync-default-rtdb.firebaseio.com/",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

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

export { app, db };
