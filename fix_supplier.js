const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');
const app = initializeApp({ databaseURL: 'https://dentallabsync-default-rtdb.firebaseio.com/' });
const db = getDatabase(app);

async function fix() {
  const billsSnap = await get(ref(db, 'bills'));
  const bills = billsSnap.val() || {};
  
  for (const b of Object.values(bills)) {
    if (b.supplierId && b.items) {
      for (const item of b.items) {
        if (!item.name) continue;
        const itemId = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const catSnap = await get(ref(db, `lab_catalog/${itemId}`));
        if (catSnap.exists()) {
          const data = catSnap.val();
          if (!data.supplierId) {
            await set(ref(db, `lab_catalog/${itemId}/supplierId`), b.supplierId);
            console.log('Fixed', item.name);
          }
        }
      }
    }
  }
  process.exit(0);
}
fix();
