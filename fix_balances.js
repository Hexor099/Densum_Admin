const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const firebaseConfig = {
  databaseURL: "https://dentallabsync-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function fixBalances() {
  const ledgerSnapshot = await get(ref(db, 'ledger'));
  const doctorsSnapshot = await get(ref(db, 'doctors'));
  
  if (!ledgerSnapshot.exists() || !doctorsSnapshot.exists()) {
    console.log("No data found");
    process.exit(0);
  }
  
  const ledgers = ledgerSnapshot.val();
  const doctors = doctorsSnapshot.val();
  
  let changes = 0;
  
  for (const docId of Object.keys(doctors)) {
    const docLedger = ledgers[docId] || {};
    const transactions = Array.isArray(docLedger) ? docLedger : Object.values(docLedger);
    
    let trueBalance = 0;
    for (const tx of transactions) {
      trueBalance += (Number(tx.amount) || 0);
    }
    
    const currentBalance = Number(doctors[docId].balance) || 0;
    if (Math.abs(trueBalance - currentBalance) > 0.01) {
      console.log(`Fixing ${docId}: ${currentBalance} -> ${trueBalance}`);
      await set(ref(db, `doctors/${docId}/balance`), trueBalance);
      changes++;
    }
  }
  
  console.log(`Fixed ${changes} doctor balances.`);
  process.exit(0);
}

fixBalances();
