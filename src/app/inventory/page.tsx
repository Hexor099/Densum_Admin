"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, Minus, History, PackageOpen, AlertTriangle, Camera } from 'lucide-react';
import { fetchData, writeData } from '@/lib/firebase';
import { BillUploadModal } from '@/components/BillUploadModal';

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const updateStock = async (itemId: string, itemName: string, currentQty: number, change: number) => {
    const newQty = Math.max(0, currentQty + change);
    if (newQty === currentQty) return;
    
    setCatalog(prev => prev.map(item => 
      item.id === itemId ? { ...item, qty: newQty } : item
    ));

    const histEntry = {
      item: itemName,
      change: change,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'Admin'
    };
    const histId = Date.now().toString();

    setHistory(prev => [{ id: histId, ...histEntry }, ...prev]);

    try {
      await writeData(`lab_catalog/${itemId}/qty`, newQty);
      await writeData(`inventory_history/${histId}`, histEntry);
    } catch (error) {
      console.error("Failed to update stock", error);
      // Revert on error
      setCatalog(prev => prev.map(item => 
        item.id === itemId ? { ...item, qty: currentQty } : item
      ));
      setHistory(prev => prev.filter(h => h.id !== histId));
    }
  };

  useEffect(() => {
    async function loadInventory() {
      const data = await fetchData('lab_catalog');
      if (data) {
        // Convert object to array for easier filtering
        const catalogArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setCatalog(catalogArray);
      }

      const histData = await fetchData('inventory_history');
      if (histData) {
        const histArray = Object.keys(histData).map(key => ({
          id: key,
          ...histData[key]
        })).sort((a, b) => b.id.localeCompare(a.id));
        setHistory(histArray);
      }
      
      setLoading(false);
    }
    
    loadInventory();
    
    // In a real app we'd setup a listener here for live updates
    // using onValue from firebase/database instead of fetchData (get)
    // but this serves as a good start.
  }, []);

  const refreshData = async () => {
    setLoading(true);
    
    const data = await fetchData('lab_catalog');
    if (data) {
      const catalogArray = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      setCatalog(catalogArray);
    } else {
      setCatalog([]);
    }

    const histData = await fetchData('inventory_history');
    if (histData) {
      const histArray = Object.keys(histData).map(key => ({
        id: key,
        ...histData[key]
      })).sort((a, b) => b.id.localeCompare(a.id));
      setHistory(histArray);
    } else {
      setHistory([]);
    }
    
    setLoading(false);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    refreshData();
  };
  
  const filteredCatalog = catalog.filter(item => 
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cloud Inventory (DentalLabSync)</h1>
          <p className="text-foreground/70">Real-time stock management and usage history.</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <button 
            onClick={async () => {
              if (confirm('Are you sure you want to completely clear the inventory and history? This is for testing only.')) {
                setLoading(true);
                await writeData('lab_catalog', null);
                await writeData('inventory_history', null);
                await refreshData();
              }
            }}
            className="w-full md:w-auto px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-all border border-red-500/30 flex items-center justify-center gap-2"
          >
            <AlertTriangle size={20} />
            Clear Inventory
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto px-5 py-3 bg-accent/20 text-accent font-bold rounded-xl hover:bg-accent/30 transition-all border border-accent/30 flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            Scan Bill
          </button>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={20} />
            <input 
              type="text" 
              placeholder="Barcode or Search Item..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-panel border border-panel-border rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-accent transition-colors shadow-lg"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Inventory Table */}
        <div className="lg:col-span-2 bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg flex flex-col h-[600px]">
          <div className="p-5 border-b border-panel-border/50 bg-black/20 flex items-center justify-between">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <PackageOpen size={20} className="text-accent" /> Lab Catalog
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-10 text-center text-foreground/50 animate-pulse">Loading Live Stock...</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-foreground/60 uppercase bg-black/40 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Item ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4 text-center">Stock Qty</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((item) => {
                    const isLow = (item.qty || 0) <= (item.min_limit || 0);
                    return (
                      <tr key={item.id} className={`border-b border-panel-border/30 hover:bg-white/5 transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-foreground/70">{item.id}</td>
                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                          {item.name || '-'}
                          {isLow && <span title="Low Stock!"><AlertTriangle size={14} className="text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]" /></span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-lg font-bold ${isLow ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-accent/10 text-accent-glow border border-accent/20'}`}>
                            {item.qty || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => updateStock(item.id, item.name || 'Unknown Item', item.qty || 0, -1)}
                              className="p-1.5 bg-black/40 border border-panel-border rounded-md hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                            <button 
                              onClick={() => updateStock(item.id, item.name || 'Unknown Item', item.qty || 0, 1)}
                              className="p-1.5 bg-black/40 border border-panel-border rounded-md hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50 transition-colors"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCatalog.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-6 py-10 text-center text-foreground/50">No items found in catalog.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* History Feed */}
        <div className="bg-panel rounded-xl border border-panel-border p-5 shadow-lg lg:col-span-1 h-[600px] flex flex-col">
          <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
            <History size={18} className="text-accent" /> Usage History
          </h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
            {history.length === 0 ? (
              <div className="p-10 text-center text-foreground/50">No recent activity.</div>
            ) : (
              history.map(entry => (
                <div key={entry.id} className="p-4 rounded-xl bg-black/20 border border-panel-border/50 hover:border-accent/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-white text-sm">{entry.item}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${entry.change > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {entry.change > 0 ? `+${entry.change}` : entry.change}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-foreground/50">
                    <span>{entry.user}</span>
                    <span>{entry.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <BillUploadModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleModalSuccess} 
        />
      )}
    </div>
  );
}
