const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const app = initializeApp({ databaseURL: 'https://dentallabsync-default-rtdb.firebaseio.com/' });
const db = getDatabase(app);

async function fix() {
  const billsSnap = await get(ref(db, 'bills'));
  const bills = billsSnap.val() || {};
  const validBills = Object.values(bills);
  
  const ledgersSnap = await get(ref(db, 'supplier_ledger'));
  const ledgers = ledgersSnap.val() || {};
  
  for (const [suppId, txs] of Object.entries(ledgers)) {
    const validTxs = [];
    let newBalance = 0;
    
    // We only want to match each validBill ONCE
    const matchedBillIds = new Set();
    
    for (const tx of txs) {
      if (tx.type === 'Payment') {
        validTxs.push(tx);
        newBalance -= Number(tx.amount);
      } else if (tx.type === 'Bill') {
        const matchingBill = validBills.find(b => 
          String(b.invoiceNo) === String(tx.refNumber) && 
          Number(b.totalAmount) === Number(tx.amount) &&
          !matchedBillIds.has(b.id || JSON.stringify(b))
        );
        
        if (matchingBill) {
          matchedBillIds.add(matchingBill.id || JSON.stringify(matchingBill));
          validTxs.push(tx);
          newBalance += Number(tx.amount);
        }
      }
    }
    
    await set(ref(db, `supplier_ledger/${suppId}`), validTxs);
    await set(ref(db, `suppliers/${suppId}/balance`), newBalance);
    console.log(`Fixed supplier ${suppId}: balance is now ${newBalance}, valid txs ${validTxs.length}`);
  }
  process.exit(0);
}
fix();
