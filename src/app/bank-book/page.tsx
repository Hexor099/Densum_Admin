"use client";

import { useState, useEffect, useMemo } from 'react';
import { Building2, CheckCircle, Circle, Search, Wallet } from 'lucide-react';
import { writeData } from '@/lib/firebase';
import { useStore } from '@/store/useStore';

export default function BankBookPage() {
  const { ledger, doctors, isInitialized, initializeStore, refreshLedger } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isInitialized) initializeStore();
  }, [isInitialized, initializeStore]);

  const allPayments = useMemo(() => {
    const payments: any[] = [];
    Object.entries(ledger).forEach(([docId, txs]: [string, any]) => {
      txs.forEach((tx: any, index: number) => {
        if (tx.type === 'Payment') {
          payments.push({
            ...tx,
            docId,
            docName: doctors[docId]?.name || docId,
            originalIndex: index // we need this to update the specific transaction
          });
        }
      });
    });
    // Sort newest first
    return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledger, doctors]);

  const filteredPayments = allPayments.filter(p => 
    p.docName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.paymentMode || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    let cash = 0;
    let bankCleared = 0;
    let bankUncleared = 0;

    allPayments.forEach(p => {
      const amt = Math.abs(p.amount);
      if (p.paymentMode === 'Cash' || !p.paymentMode) {
        cash += amt;
      } else {
        if (p.cleared) bankCleared += amt;
        else bankUncleared += amt;
      }
    });

    return { cash, bankCleared, bankUncleared };
  }, [allPayments]);

  const toggleCleared = async (payment: any) => {
    // Only non-cash can be reconciled
    if (payment.paymentMode === 'Cash' || !payment.paymentMode) return;

    const docTxs = [...(ledger[payment.docId] || [])];
    const newClearedStatus = !payment.cleared;
    
    // Update the transaction
    docTxs[payment.originalIndex] = {
      ...docTxs[payment.originalIndex],
      cleared: newClearedStatus
    };

    await writeData(`ledger/${payment.docId}`, docTxs);
    await refreshLedger();
  };

  if (!isInitialized) {
    return <div className="p-10 text-center text-foreground/50 animate-pulse">Loading Bank Book...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-sm sm:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Building2 className="text-accent" /> Bank & Cash Book
        </h1>
        <p className="text-foreground/70">Reconcile payments and track your cash vs bank balances.</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-6">
        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-6 shadow-lg flex flex-col justify-center flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-green-400" size={24} />
            <h3 className="font-semibold text-foreground/80">Cash on Hand</h3>
          </div>
          <p className="text-sm sm:text-3xl font-bold text-white">₹{stats.cash.toLocaleString()}</p>
        </div>
        
        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-6 shadow-lg flex flex-col justify-center flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="text-accent" size={24} />
            <h3 className="font-semibold text-foreground/80">Bank (Cleared)</h3>
          </div>
          <p className="text-sm sm:text-3xl font-bold text-white">₹{stats.bankCleared.toLocaleString()}</p>
        </div>

        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-6 shadow-lg flex flex-col justify-center flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Circle className="text-yellow-400" size={24} />
            <h3 className="font-semibold text-foreground/80">Bank (Uncleared)</h3>
          </div>
          <p className="text-sm sm:text-3xl font-bold text-white">₹{stats.bankUncleared.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-white text-lg">All Payments Received</h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={20} />
            <input 
              type="text" 
              placeholder="Search doctor or mode..."
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
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Amount (₹)</th>
                <th className="px-6 py-4">Mode / Ref</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p: any) => {
                const isBank = p.paymentMode && p.paymentMode !== 'Cash';
                return (
                  <tr key={`${p.docId}-${p.id}`} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-foreground/80">{p.date}</td>
                    <td className="px-6 py-4 font-semibold text-white">{p.docName}</td>
                    <td className="px-6 py-4 font-bold text-green-400">
                      {Math.abs(p.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-bold tracking-wider mr-2">
                        {p.paymentMode || 'Cash'}
                      </span>
                      {p.refNumber && <span className="text-foreground/50 text-xs">{p.refNumber}</span>}
                    </td>
                    <td className="px-6 py-4 flex justify-center">
                      {!isBank ? (
                        <span className="text-foreground/40 text-xs italic">Cash</span>
                      ) : (
                        <button 
                          onClick={() => toggleCleared(p)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                            p.cleared 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30'
                          }`}
                        >
                          {p.cleared ? <CheckCircle size={14} /> : <Circle size={14} />}
                          {p.cleared ? 'Cleared' : 'Pending'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-foreground/50">No payments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
