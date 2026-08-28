import { create } from 'zustand';
import { fetchData } from '@/lib/firebase';

interface AppState {
  doctors: Record<string, any>;
  suppliers: Record<string, any>;
  catalog: Record<string, any>;
  settings: Record<string, any>;
  isInitialized: boolean;
  
  initializeStore: () => Promise<void>;
  refreshDoctors: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  doctors: {},
  suppliers: {},
  catalog: {},
  settings: {},
  isInitialized: false,

  initializeStore: async () => {
    if (get().isInitialized) return;
    try {
      const [doctorsData, suppliersData, catalogData, settingsData] = await Promise.all([
        fetchData('doctors'),
        fetchData('suppliers'),
        fetchData('lab_catalog'),
        fetchData('settings')
      ]);

      set({
        doctors: doctorsData || {},
        suppliers: suppliersData || {},
        catalog: catalogData || {},
        settings: settingsData || {},
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
  }
}));
