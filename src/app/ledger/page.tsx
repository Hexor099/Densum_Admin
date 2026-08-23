"use client";

import { useState, useEffect } from 'react';
import { User, MessageCircle, DollarSign, FileText, Plus } from 'lucide-react';
import { fetchData, writeData } from '@/lib/firebase';
import { sendWhatsAppAction } from '@/app/actions/whatsapp';

export default function LedgerPage() {
  const [doctors, setDoctors] = useState<any>({});
  const [ledger, setLedger] = useState<any>({});
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSendingWA, setIsSendingWA] = useState(false);

  useEffect(() => {
    async function loadData() {
      const docs = await fetchData('doctors');
      const ldgr = await fetchData('ledger');
      if (docs) {
        setDoctors(docs);
        if (Object.keys(docs).length > 0) setSelectedDocId(Object.keys(docs)[0]);
      }
      if (ldgr) setLedger(ldgr);
    }
    loadData();
  }, []);

  const selectedDoc = doctors[selectedDocId] || {};
  const transactions = ledger[selectedDocId] || [];

  const handleWhatsApp = async () => {
    if (!selectedDoc.phone) {
      alert("No phone number saved for this doctor.");
      return;
    }
    setIsSendingWA(true);
    const text = `Hello ${selectedDocId}, your current outstanding balance is ₹${selectedDoc.balance || 0}. Please clear it at the earliest.`;
    
    try {
      const res = await sendWhatsAppAction(selectedDoc.phone, text);
      if (res.success) {
        alert("WhatsApp message sent successfully via automation.");
      } else {
        alert("Failed to send WhatsApp message. " + res.error);
      }
    } catch (e) {
      alert("Error sending WhatsApp message.");
    } finally {
      setIsSendingWA(false);
    }
  };

  const recordPayment = async () => {
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) return;
    
    const amount = Number(paymentAmount);
    const newTransaction = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'Payment',
      amount: -amount,
      description: 'Manual Payment Received'
    };

    const updatedTransactions = [...transactions, newTransaction];
    const newBalance = (Number(selectedDoc.balance) || 0) - amount;

    // Optimistic update
    setLedger({ ...ledger, [selectedDocId]: updatedTransactions });
    setDoctors({ ...doctors, [selectedDocId]: { ...selectedDoc, balance: newBalance } });
    
    // Save to Firebase
    await writeData(`ledger/${selectedDocId}`, updatedTransactions);
    await writeData(`doctors/${selectedDocId}/balance`, newBalance);
    
    alert(`Recorded payment of ₹${paymentAmount} for ${selectedDocId}`);
    setPaymentAmount('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Doctor Profiles & Ledger</h1>
        <p className="text-foreground/70">Manage custom pricing, view ledger, and record payments.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Doctors List */}
        <div className="bg-panel rounded-xl border border-panel-border p-4 shadow-lg lg:col-span-1 h-[600px] overflow-y-auto custom-scrollbar">
          <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
            <User size={18} className="text-accent" /> Doctors
          </h2>
          <div className="space-y-2">
            {Object.keys(doctors).map(docName => {
              const doc = doctors[docName];
              const balance = Number(doc.balance) || 0;
              return (
                <button 
                  key={docName}
                  onClick={() => setSelectedDocId(docName)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedDocId === docName 
                      ? 'bg-accent/15 border-accent/50 shadow-[0_0_15px_rgba(0,194,255,0.1)]' 
                      : 'bg-black/20 border-transparent hover:border-panel-border'
                  }`}
                >
                  <div className="font-semibold text-white">{docName}</div>
                  <div className={`text-sm font-medium mt-1 ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    ₹{Math.abs(balance)} {balance > 0 ? 'Dr' : 'Cr'}
                  </div>
                </button>
              );
            })}
            {Object.keys(doctors).length === 0 && (
              <p className="text-sm text-foreground/50">No doctors synced yet. Generate an invoice first.</p>
            )}
          </div>
        </div>

        {/* Ledger Details */}
        {selectedDocId && (
          <div className="lg:col-span-3 space-y-6">
            {/* Header Action Card */}
            <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedDocId}</h2>
                <p className="text-foreground/60">{selectedDoc.phone || 'No phone added'}</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-foreground/60 uppercase tracking-wider font-semibold">Balance</div>
                  <div className={`text-2xl font-bold ${(selectedDoc.balance || 0) > 0 ? 'text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]' : 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]'}`}>
                    ₹{Math.abs(selectedDoc.balance || 0)} {(selectedDoc.balance || 0) > 0 ? 'Dr' : 'Cr'}
                  </div>
                </div>
                
                <button 
                  onClick={handleWhatsApp}
                  disabled={isSendingWA}
                  className="p-3 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366]/20 transition-all border border-[#25D366]/30 shadow-[0_0_15px_rgba(37,211,102,0.15)] disabled:opacity-50"
                  title="Send WhatsApp Alert via Automation"
                >
                  <MessageCircle size={24} className={isSendingWA ? "animate-pulse" : ""} />
                </button>
              </div>
            </div>

            {/* Payment row */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-accent" /> Record Payment
                </h3>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">₹</span>
                    <input 
                      type="number" 
                      placeholder="Amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-black/40 border border-panel-border rounded-lg pl-8 pr-4 py-2.5 text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <button 
                    onClick={recordPayment}
                    className="px-6 py-2.5 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)] whitespace-nowrap"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
              <div className="p-5 border-b border-panel-border/50 bg-black/20">
                <h3 className="font-bold text-white text-lg">Transaction History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/60 uppercase bg-black/40">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx: any) => (
                      <tr key={tx.id || tx.date} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-foreground/80">{tx.date}</td>
                        <td className="px-6 py-4 font-medium">{tx.description}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${tx.type === 'Payment' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold tracking-wide">
                          {tx.amount > 0 ? tx.amount.toLocaleString() : `(${Math.abs(tx.amount).toLocaleString()})`}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-foreground/50">No transactions recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
