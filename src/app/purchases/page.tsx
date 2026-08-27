"use client";

import { useState, useEffect, useMemo } from 'react';
import { Receipt, Search, Image as ImageIcon, ExternalLink, Calendar } from 'lucide-react';
import { fetchData } from '@/lib/firebase';

export default function PurchasesPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedBill, setSelectedBill] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      const billsData = await fetchData('bills');
      if (billsData) {
        // Bills are stored with a timestamp ID, we can sort them newest first
        const sortedBills = Object.entries(billsData).map(([id, data]: [string, any]) => ({
          id,
          ...data
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setBills(sortedBills);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredBills = useMemo(() => {
    return bills.filter(b => 
      (b.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bills, searchTerm]);

  if (loading) {
    return <div className="p-10 text-center text-foreground/50 animate-pulse">Loading Purchase Register...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Receipt className="text-accent" /> Purchase Register
        </h1>
        <p className="text-foreground/70">View all your scanned bills and purchase history.</p>
      </header>

      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-white text-lg">Purchase Invoices</h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={20} />
            <input 
              type="text" 
              placeholder="Search supplier or invoice no..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-panel-border rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors shadow-inner"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-foreground/60 uppercase bg-black/40">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4 text-right">Amount (₹)</th>
                <th className="px-6 py-4 text-center">Items</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((b) => (
                <tr key={b.id} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-foreground/80">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-foreground/50" />
                      {new Date(b.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-white">
                    {b.supplierName || 'Unknown Supplier'}
                  </td>
                  <td className="px-6 py-4 font-mono text-accent/80 text-xs">
                    {b.invoiceNo || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-red-400">
                    {b.totalAmount?.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-center text-foreground/60">
                    {b.items?.length || 0} items
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setSelectedBill(b)}
                        className="p-2 text-accent hover:bg-accent/20 rounded transition-colors"
                        title="View Details"
                      >
                        <ExternalLink size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-foreground/50">No purchases found. Try uploading a bill in the Inventory page.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel border border-panel-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Image Preview Side */}
            <div className="w-full md:w-1/2 bg-black/40 border-r border-panel-border/50 flex flex-col">
              <div className="p-4 border-b border-panel-border/50 flex justify-between items-center bg-black/40">
                <h3 className="font-bold text-white flex items-center gap-2"><ImageIcon size={18} className="text-accent" /> Bill Image</h3>
              </div>
              <div className="flex-1 p-4 overflow-auto custom-scrollbar flex items-center justify-center">
                {selectedBill.image ? (
                  selectedBill.image.startsWith('data:application/pdf') ? (
                    <object data={selectedBill.image} type="application/pdf" className="w-full h-full min-h-[400px] rounded border border-panel-border">
                      <div className="text-center p-4">
                        <p className="text-foreground/70 mb-2">PDF cannot be displayed directly.</p>
                        <a href={selectedBill.image} download={`Bill-${selectedBill.invoiceNo || 'Unknown'}.pdf`} className="text-accent hover:underline">Download PDF</a>
                      </div>
                    </object>
                  ) : (
                    <img src={selectedBill.image} alt="Scanned Bill" className="max-w-full h-auto object-contain rounded border border-panel-border" />
                  )
                ) : (
                  <p className="text-foreground/50">No image available.</p>
                )}
              </div>
            </div>
            
            {/* Data Side */}
            <div className="w-full md:w-1/2 flex flex-col">
              <div className="p-5 border-b border-panel-border/50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Purchase Details</h2>
                  <p className="text-xs text-foreground/50 mt-1">Uploaded on {new Date(selectedBill.date).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedBill(null)} className="text-foreground/50 hover:text-white">✕</button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p className="text-xs text-foreground/50 uppercase tracking-wider mb-1">Supplier</p>
                    <p className="font-bold text-white text-lg">{selectedBill.supplierName || 'Unknown'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p className="text-xs text-foreground/50 uppercase tracking-wider mb-1">Invoice No</p>
                    <p className="font-bold text-accent font-mono">{selectedBill.invoiceNo || 'N/A'}</p>
                  </div>
                  <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 col-span-2">
                    <p className="text-xs text-red-400 uppercase font-bold tracking-wider mb-1">Total Amount</p>
                    <p className="font-bold text-white text-2xl">₹{selectedBill.totalAmount?.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-white mb-3 border-b border-panel-border/50 pb-2">Items Extracted</h3>
                  <div className="space-y-2">
                    {selectedBill.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-black/30 rounded border border-panel-border/30">
                        <div>
                          <p className="font-semibold text-white text-sm">{item.name}</p>
                          <p className="text-xs text-foreground/50 mt-0.5">{item.qty} units @ ₹{item.rate}</p>
                        </div>
                        <div className="font-bold text-accent">
                          ₹{(item.qty * item.rate).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {(!selectedBill.items || selectedBill.items.length === 0) && (
                      <p className="text-sm text-foreground/50 italic">No items found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
