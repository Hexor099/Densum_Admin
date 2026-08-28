import { create } from 'zustand';
import { fetchData } from '@/lib/firebase';

interface AppState {
  doctors: Record<string, any>;
  suppliers: Record<string, any>;
  catalog: Record<string, any>;
  settings: Record<string, any>;
  ledger: Record<string, any>;
  expenses: Record<string, any>;
  bills: Record<string, any>;
  supplier_ledger: Record<string, any>;
  inventory_history: Record<string, any>;
  isInitialized: boolean;
  
  initializeStore: () => Promise<void>;
  refreshDoctors: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshLedger: () => Promise<void>;
  refreshExpenses: () => Promise<void>;
  refreshBills: () => Promise<void>;
  refreshSupplierLedger: () => Promise<void>;
  refreshInventoryHistory: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  doctors: {},
  suppliers: {},
  catalog: {},
  settings: {},
  ledger: {},
  expenses: {},
  bills: {},
  supplier_ledger: {},
  inventory_history: {},
  isInitialized: false,

  initializeStore: async () => {
    if (get().isInitialized) return;
    try {
      const [
        doctorsData, suppliersData, catalogData, settingsData,
        ledgerData, expensesData, billsData, suppLedgerData, invHistData
      ] = await Promise.all([
        fetchData('doctors'),
        fetchData('suppliers'),
        fetchData('lab_catalog'),
        fetchData('settings'),
        fetchData('ledger'),
        fetchData('expenses'),
        fetchData('bills'),
        fetchData('supplier_ledger'),
        fetchData('inventory_history')
      ]);

      set({
        doctors: doctorsData || {},
        suppliers: suppliersData || {},
        catalog: catalogData || {},
        settings: settingsData || {},
        ledger: ledgerData || {},
        expenses: expensesData || {},
        bills: billsData || {},
        supplier_ledger: suppLedgerData || {},
        inventory_history: invHistData || {},
        isInitialized: true
      });
    } catch (error) {
      console.error("Failed to initialize store:", error);
    }
  },

  refreshDoctors: async () => {
    const doctorsData = await fetchData('doctors');
    set({ doctors: doctorsData || {} });
  },

  refreshSuppliers: async () => {
    const suppliersData = await fetchData('suppliers');
    set({ suppliers: suppliersData || {} });
  },

  refreshCatalog: async () => {
    const catalogData = await fetchData('lab_catalog');
    set({ catalog: catalogData || {} });
  },

  refreshSettings: async () => {
    const settingsData = await fetchData('settings');
    set({ settings: settingsData || {} });
  },

  refreshLedger: async () => {
    const ledgerData = await fetchData('ledger');
    set({ ledger: ledgerData || {} });
  },

  refreshExpenses: async () => {
    const expensesData = await fetchData('expenses');
    set({ expenses: expensesData || {} });
  },

  refreshBills: async () => {
    const billsData = await fetchData('bills');
    set({ bills: billsData || {} });
  },

  refreshSupplierLedger: async () => {
    const suppLedgerData = await fetchData('supplier_ledger');
    set({ supplier_ledger: suppLedgerData || {} });
  },

  refreshInventoryHistory: async () => {
    const invHistData = await fetchData('inventory_history');
    set({ inventory_history: invHistData || {} });
  }
}));
