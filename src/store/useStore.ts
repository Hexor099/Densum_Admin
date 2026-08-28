import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

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
  
  initializeStore: () => void;
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

  initializeStore: () => {
    if (get().isInitialized) return;
    
    const paths = [
      { key: 'doctors', path: 'doctors' },
      { key: 'suppliers', path: 'suppliers' },
      { key: 'catalog', path: 'lab_catalog' },
      { key: 'settings', path: 'settings' },
      { key: 'ledger', path: 'ledger' },
      { key: 'expenses', path: 'expenses' },
      { key: 'bills', path: 'bills' },
      { key: 'supplier_ledger', path: 'supplier_ledger' },
      { key: 'inventory_history', path: 'inventory_history' },
    ];

    paths.forEach(({ key, path }) => {
      const dbRef = ref(db, path);
      onValue(dbRef, (snapshot) => {
        set({ [key]: snapshot.exists() ? snapshot.val() : {} });
      }, (error) => {
        console.error(`Error syncing ${path}:`, error);
      });
    });

    set({ isInitialized: true });
  },

  // Refresh functions are now no-ops because Firebase onValue keeps the store perfectly synced in real-time
  refreshDoctors: async () => {},
  refreshSuppliers: async () => {},
  refreshCatalog: async () => {},
  refreshSettings: async () => {},
  refreshLedger: async () => {},
  refreshExpenses: async () => {},
  refreshBills: async () => {},
  refreshSupplierLedger: async () => {},
  refreshInventoryHistory: async () => {}
}));
