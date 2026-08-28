import { initializeApp } from "firebase/app";
import { getDatabase, ref as dbRef, get, set } from "firebase/database";
import crypto from "crypto";

const firebaseConfig = {
  databaseURL: "https://dentallabsync-default-rtdb.firebaseio.com/",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

async function migrateExpenses() {
  console.log("Starting expenses migration to dictionary...");
  
  const expensesRef = dbRef(db, 'expenses');
  const snapshot = await get(expensesRef);
  
  if (!snapshot.exists()) {
    console.log("No expenses found. Nothing to migrate.");
    process.exit(0);
  }
  
  const rawExpenses = snapshot.val();
  let expensesArray = [];
  
  // Handle if it's already an array or an object
  if (Array.isArray(rawExpenses)) {
    expensesArray = rawExpenses;
  } else {
    // If it's already an object but maybe keys are just indices "0", "1"
    expensesArray = Object.values(rawExpenses);
  }
  
  // Check if they are already using dictionary keys (e.g. long strings instead of indices)
  const isAlreadyDict = !Array.isArray(rawExpenses) && Object.keys(rawExpenses).some(key => isNaN(Number(key)));
  
  if (isAlreadyDict) {
    console.log("Expenses are already stored as a dictionary. No migration needed.");
    process.exit(0);
  }
  
  const newExpensesDict = {};
  let count = 0;
  
  for (const exp of expensesArray) {
    if (!exp) continue;
    // ensure it has an id
    const id = exp.id || generateId();
    exp.id = id;
    newExpensesDict[id] = exp;
    count++;
  }
  
  try {
    await set(dbRef(db, 'expenses'), newExpensesDict);
    console.log(`Successfully migrated ${count} expenses to a dictionary structure.`);
  } catch (err) {
    console.error("Migration failed:", err);
  }
  
  process.exit(0);
}

migrateExpenses();
