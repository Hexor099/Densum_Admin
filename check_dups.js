const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get } = require("firebase/database");

const firebaseConfig = {
  databaseURL: "https://dentallabsync-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function checkDuplicates() {
  const expensesRef = ref(db, 'expenses');
  const expensesSnap = await get(expensesRef);
  const expenses = expensesSnap.val() || {};

  const billsRef = ref(db, 'bills');
  const billsSnap = await get(billsRef);
  const bills = billsSnap.val() || {};

  console.log("Expenses related to Invoice #1176:");
  Object.values(expenses).forEach(exp => {
    if (exp.desc && exp.desc.includes('1176')) {
      console.log(exp);
    }
  });

  console.log("\nBills related to Invoice #1176:");
  Object.values(bills).forEach(bill => {
    if (bill.invoiceNo === '1176') {
      console.log({id: bill.id, invoiceNo: bill.invoiceNo, amount: bill.totalAmount});
    }
  });

  process.exit(0);
}

checkDuplicates().catch(console.error);
