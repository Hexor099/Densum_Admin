"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Minus, History, PackageOpen, AlertTriangle, Camera, FileSpreadsheet, MessageCircle, TrendingUp, ShoppingCart, Send, ShoppingBag, Trash2 } from 'lucide-react';
import { fetchData, writeData } from '@/lib/firebase';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { BillUploadModal } from '@/components/BillUploadModal';

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { 
    catalog: storeCatalog, 
    suppliers: storeSuppliers, 
    refreshCatalog, 
    inventory_history, 
    refreshInventoryHistory,
    refreshBills,
    refreshExpenses,
    refreshSuppliers,
    refreshSupplierLedger,
    isInitialized, 
    initializeStore 
  } = useStore();
  
  const catalog = useMemo(() => {
    return Object.keys(storeCatalog).map(key => ({
      id: key,
      ...storeCatalog[key]
    }));
  }, [storeCatalog]);
  
  const suppliers = storeSuppliers;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Shopping Cart State
  const [orderCart, setOrderCart] = useState<Record<string, {item: any, orderQty: number}>>({});

  const addToCart = (item: any) => {
    setOrderCart(prev => {
      const current = prev[item.id]?.orderQty || 0;
      return {
        ...prev,
        [item.id]: { item, orderQty: current + 1 }
      };
    });
  };

  const removeFromCart = (itemId: string) => {
    setOrderCart(prev => {
      const newCart = { ...prev };
      delete newCart[itemId];
      return newCart;
    });
  };

  const updateCartQty = (itemId: string, change: number) => {
    setOrderCart(prev => {
      if (!prev[itemId]) return prev;
      const current = prev[itemId].orderQty;
      const newQty = Math.max(1, current + change);
      return {
        ...prev,
        [itemId]: { ...prev[itemId], orderQty: newQty }
      };
    });
  };

  const cartBySupplier = useMemo(() => {
    const grouped: Record<string, {item: any, orderQty: number}[]> = {};
    Object.values(orderCart).forEach(cartItem => {
      const suppId = cartItem.item.supplierId || 'unassigned';
      if (!grouped[suppId]) grouped[suppId] = [];
      grouped[suppId].push(cartItem);
    });
    return grouped;
  }, [orderCart]);

  const updateStock = async (itemId: string, itemName: string, currentQty: number, change: number) => {
    const newQty = Math.max(0, currentQty + change);
    if (newQty === currentQty) return;
    
    const histEntry = {
      item: itemName,
      change: change,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'Admin'
    };
    const histId = generateId();

    try {
      await writeData(`lab_catalog/${itemId}/qty`, newQty);
      await writeData(`inventory_history/${histId}`, histEntry);
      await refreshCatalog(); // refresh global state
      await refreshInventoryHistory();
    } catch (error) {
      console.error("Failed to update stock", error);
    }
  };

  useEffect(() => {
    if (!isInitialized) initializeStore();
  }, [isInitialized, initializeStore]);

  useEffect(() => {
    if (inventory_history) {
      const histArray = Object.keys(inventory_history).map(key => ({
        id: key,
        ...inventory_history[key]
      })).sort((a, b) => b.id.localeCompare(a.id));
      setHistory(histArray);
    } else {
      setHistory([]);
    }
    setLoading(false);
  }, [inventory_history]);

  const refreshData = async () => {
    setLoading(true);
    await refreshCatalog();
    await refreshInventoryHistory();
    await refreshBills();
    await refreshExpenses();
    await refreshSuppliers();
    await refreshSupplierLedger();
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

  const totalInventoryValue = catalog.reduce((sum, item) => {
    return sum + ((Number(item.qty) || 0) * (Number(item.last_purchase_rate) || 0));
  }, 0);

  const handleReorder = (item: any) => {
    const supplierId = item.supplierId;
    if (!supplierId || !suppliers[supplierId]) {
      toast.error("No primary supplier assigned to this item. Please select a supplier when uploading a bill for this item.");
      return;
    }

    const supplier = suppliers[supplierId];
    if (!supplier.phone) {
      toast.error(`Supplier ${supplier.name} does not have a phone number saved.`);
      return;
    }

    const text = `Hello ${supplier.name}, please process an order for ${item.name} for Densum Digital Lab. Our stock is running low. Let us know the current rate and expected delivery.`;
    let phone = supplier.phone;
    if (!phone.startsWith('+')) phone = '+91' + phone;

    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleExportExcel = async () => {
    if (filteredCatalog.length === 0) {
      toast.error("No inventory items to export.");
      return;
    }
    
    const exportData = filteredCatalog.map(item => ({
      'Item ID': item.id,
      'Name': item.name || '-',
      'Stock Qty': item.qty || 0,
      'Min Limit': item.min_limit || 0,
      'Last Purchase Rate (₹)': item.last_purchase_rate || '-'
    }));

    const xlsx = await import('xlsx');
    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Inventory");
    xlsx.writeFile(workbook, `Inventory_Stock_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cloud Inventory</h1>
          <p className="text-foreground/70">Real-time stock management and usage history.</p>
        </div>
        
        <div className="bg-panel border border-accent/30 px-5 py-3 rounded-xl shadow-[0_0_15px_rgba(0,194,255,0.1)] flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-accent uppercase font-bold tracking-wider">Total Value</span>
            <span className="text-2xl font-bold text-white">₹{totalInventoryValue.toLocaleString()}</span>
          </div>
          <TrendingUp className="text-accent/50" size={32} />
        </div>
      </header>
      
      <div className="flex flex-col md:flex-row items-center justify-end gap-4 mb-6">

          <button 
            onClick={handleExportExcel}
            className="w-full md:w-auto px-5 py-3 bg-green-500/20 text-green-400 font-bold rounded-xl hover:bg-green-500/30 transition-all border border-green-500/30 flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={20} />
            Export
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
                            <button
                              onClick={() => addToCart(item)}
                              className={`p-1.5 border rounded-md transition-colors ml-2 flex items-center gap-1 text-xs font-bold ${isLow ? 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30' : 'bg-accent/20 border-accent/30 text-accent hover:bg-accent/30'}`}
                              title="Add to Reorder Cart"
                            >
                              <ShoppingCart size={16} />
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

        {/* Create Order Card */}
        <div className="bg-panel rounded-xl border border-panel-border p-5 shadow-lg lg:col-span-1 h-[600px] flex flex-col">
          <h2 className="text-lg font-bold mb-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-accent" /> Reorder Cart
            </div>
            {Object.keys(orderCart).length > 0 && (
              <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-md">
                {Object.keys(orderCart).length} items
              </span>
            )}
          </h2>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
            {Object.keys(cartBySupplier).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-foreground/50 space-y-3">
                <ShoppingCart size={48} className="opacity-20" />
                <p>Your reorder cart is empty.</p>
                <p className="text-xs">Click the cart icon on any item to add it here.</p>
              </div>
            ) : (
              Object.entries(cartBySupplier).map(([suppId, items]) => {
                const supplier = suppliers[suppId];
                const suppName = supplier?.name || "Unassigned Supplier";
                const suppPhone = supplier?.phone;
                
                return (
                  <div key={suppId} className="bg-black/30 border border-panel-border rounded-lg overflow-hidden">
                    <div className="bg-black/40 px-3 py-2 border-b border-panel-border/50 font-bold text-sm text-white flex justify-between items-center">
                      <span className="truncate pr-2">{suppName}</span>
                      <span className="text-xs text-foreground/50 shrink-0">{items.length} items</span>
                    </div>
                    <div className="p-2 space-y-2">
                      {items.map(cartItem => (
                        <div key={cartItem.item.id} className="flex items-center justify-between gap-2 text-sm bg-panel border border-panel-border/50 p-2 rounded-md">
                          <div className="flex-1 min-w-0">
                            <p className="text-white truncate" title={cartItem.item.name}>{cartItem.item.name}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => updateCartQty(cartItem.item.id, -1)} className="p-1 text-foreground/50 hover:text-white bg-black/40 rounded">
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-accent font-bold">{cartItem.orderQty}</span>
                            <button onClick={() => updateCartQty(cartItem.item.id, 1)} className="p-1 text-foreground/50 hover:text-white bg-black/40 rounded">
                              <Plus size={12} />
                            </button>
                            <button onClick={() => removeFromCart(cartItem.item.id)} className="p-1 ml-1 text-red-400 hover:bg-red-500/20 rounded">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 bg-black/20 border-t border-panel-border/50">
                      <button 
                        onClick={() => {
                          if (suppId === 'unassigned' || !suppPhone) {
                            toast.error(suppId === 'unassigned' 
                              ? "Cannot add unassigned items to reorder list. Assign a supplier first."
                              : `Supplier ${suppName} has no phone number saved.`);
                            return;
                          }
                          
                          let phone = suppPhone;
                          if (!phone.startsWith('+')) phone = '+91' + phone;
                          
                          const itemList = items.map(i => `- ${i.orderQty}x ${i.item.name}`).join('\n');
                          const text = `Hello ${suppName},\n\nPlease process an order for the following items:\n${itemList}\n\nLet us know the current rate and expected delivery.\n\n- Densum Digital Lab`;
                          
                          window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        disabled={suppId === 'unassigned' || !suppPhone}
                        className="w-full py-2 bg-green-500/20 text-green-400 font-bold rounded-lg hover:bg-green-500/30 transition-all border border-green-500/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MessageCircle size={16} /> Order from {suppName}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* History Feed (Moved to Bottom) */}
      <div className="bg-panel rounded-xl border border-panel-border p-5 shadow-lg flex flex-col">
        <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
          <History size={18} className="text-accent" /> Usage History
        </h2>
        <div className="overflow-x-auto">
          {history.length === 0 ? (
            <div className="p-10 text-center text-foreground/50">No recent activity.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {history.slice(0, 20).map(entry => (
                <div key={entry.id} className="p-4 rounded-xl bg-black/20 border border-panel-border/50 hover:border-accent/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-white text-sm line-clamp-1 flex-1 pr-2" title={entry.item}>{entry.item}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md shrink-0 ${entry.change > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {entry.change > 0 ? `+${entry.change}` : entry.change}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-foreground/50">
                    <span>{entry.user}</span>
                    <span>{entry.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {history.length > 20 && (
          <div className="mt-4 text-center text-xs text-foreground/50">
            Showing last 20 activities...
          </div>
        )}
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
