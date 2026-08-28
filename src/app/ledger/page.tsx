"use client";

import { useState, useEffect, useMemo } from 'react';
import { User, MessageCircle, DollarSign, FileText, Plus, FileSpreadsheet, Calendar } from 'lucide-react';
import { fetchData, writeData, atomicIncrement } from '@/lib/firebase';
import { sendWhatsAppAction } from '@/app/actions/whatsapp';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
import * as xlsx from 'xlsx';

export default function LedgerPage() {
  const [doctors, setDoctors] = useState<any>({});
  const [ledger, setLedger] = useState<any>({});
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [txType, setTxType] = useState<'Payment' | 'Bill' | 'Credit Note' | 'Debit Note'>('Payment');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [refNumber, setRefNumber] = useState('');
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [materialName, setMaterialName] = useState('');
  const [materialRate, setMaterialRate] = useState('');
  const [uniqueMaterials, setUniqueMaterials] = useState<string[]>([]);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const defaultFYStart = currentMonth >= 3 ? `${currentYear}-04-01` : `${currentYear - 1}-04-01`;
  const defaultFYEnd = currentMonth >= 3 ? `${currentYear + 1}-03-31` : `${currentYear}-03-31`;

  const [dateFrom, setDateFrom] = useState(defaultFYStart);
  const [dateTo, setDateTo] = useState(defaultFYEnd);

  useEffect(() => {
    async function loadData() {
      const docs = await fetchData('doctors');
      const ldgr = await fetchData('ledger');
      const excel = await fetchData('excelData');
      
      if (docs) {
        setDoctors(docs);
        if (Object.keys(docs).length > 0) setSelectedDocId(Object.keys(docs)[0]);
      }
      if (ldgr) setLedger(ldgr);

      if (excel) {
        const materials = new Set<string>();
        Object.values(excel).forEach((rows: any) => {
          if (Array.isArray(rows)) {
            rows.forEach(row => {
              const foundKey = Object.keys(row).find(k => k.toLowerCase() === 'work material');
              if (foundKey && row[foundKey]) {
                materials.add(String(row[foundKey]).trim());
              }
            });
          }
        });
        setUniqueMaterials(Array.from(materials).sort());
      }
    }
    loadData();
  }, []);

  const selectedDoc = doctors[selectedDocId] || {};
  const transactions = ledger[selectedDocId] || [];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx: any) => tx.date >= dateFrom && tx.date <= dateTo);
  }, [transactions, dateFrom, dateTo]);

  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions in the selected date range to export.");
      return;
    }
    
    const sortedTxs = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0; 
    
    // Calculate opening balance before dateFrom
    transactions.forEach((tx: any) => {
      if (tx.date < dateFrom) {
        runningBalance += tx.amount;
      }
    });

    const exportData = sortedTxs.map(tx => {
      runningBalance += tx.amount;
      return {
        Date: tx.date,
        Type: tx.type,
        Description: tx.description,
        'Amount (INR)': tx.amount,
        'Running Balance (INR)': runningBalance
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Ledger");
    xlsx.writeFile(workbook, `Ledger_${selectedDocId}_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const handleWhatsApp = async () => {
    if (!selectedDoc.phone) {
      toast.error("No phone number saved for this doctor.");
      return;
    }
    setIsSendingWA(true);
    const text = `Hello ${selectedDocId}, your current outstanding balance is ₹${selectedDoc.balance || 0}. Please clear it at the earliest.`;
    let phone = selectedDoc.phone;
    if (!phone.startsWith('+')) phone = '+91' + phone;
    
    // Launch the URL from the frontend so it reliably opens in the active desktop
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    const popup = window.open(url, '_blank');
    if (!popup) {
      toast.error("Popup blocker prevented opening WhatsApp. Please allow popups for this site.");
      setIsSendingWA(false);
      return;
    }

    try {
      const res = await sendWhatsAppAction(selectedDoc.phone, text);
      if (res.success) {
        toast.success("WhatsApp message sent successfully via automation.");
      } else {
        toast.error("Failed to send WhatsApp message. " + res.error);
      }
    } catch (e) {
      toast.error("Error sending WhatsApp message.");
    } finally {
      setIsSendingWA(false);
    }
  };

  const handleBulkWhatsApp = async () => {
    const docsWithDues = Object.entries(doctors).filter(([docName, doc]: [string, any]) => {
      return (Number(doc.balance) || 0) > 0 && doc.phone;
    });

    if (docsWithDues.length === 0) {
      toast.error("No doctors have both an outstanding balance and a saved phone number.");
      return;
    }

    if (!confirm(`This will automatically send WhatsApp messages to ${docsWithDues.length} doctors. DO NOT touch your mouse or keyboard while it runs. It will take about 20 seconds per message. Continue?`)) return;

    setIsSendingWA(true);
    let successCount = 0;
    
    for (const [docName, doc] of docsWithDues) {
      const text = `Hello ${docName}, your current outstanding balance is ₹${(doc as any).balance || 0}. Please clear it at the earliest.`;
      let phone = (doc as any).phone;
      if (!phone.startsWith('+')) phone = '+91' + phone;
      
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      const popup = window.open(url, '_blank');
      
      if (!popup) {
        toast.error("Popup blocker prevented opening WhatsApp. Please allow popups for this site, then try again.");
        break; // Stop the loop if popups are blocked
      }

      try {
        const res = await sendWhatsAppAction((doc as any).phone, text);
        if (res.success) successCount++;
      } catch (e) {
        console.error("Failed for", docName);
      }
    }
    
    setIsSendingWA(false);
    toast.success(`Finished! Successfully sent ${successCount} out of ${docsWithDues.length} messages.`);
  };

  const recordTransaction = async () => {
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) return;
    
    const amount = Number(paymentAmount);
    const isReducer = txType === 'Payment' || txType === 'Credit Note';
    const txAmount = isReducer ? -amount : amount;
    
    const newTransaction = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      type: txType,
      amount: txAmount,
      description: `Manual ${txType}${refNumber ? ` (Ref: ${refNumber})` : ''}`,
      paymentMode: txType === 'Payment' ? paymentMode : null,
      refNumber: refNumber || null
    };

    const updatedTransactions = [...transactions, newTransaction];
    const newBalance = (Number(selectedDoc.balance) || 0) + txAmount;

    // Optimistic update
    setLedger({ ...ledger, [selectedDocId]: updatedTransactions });
    setDoctors({ ...doctors, [selectedDocId]: { ...selectedDoc, balance: newBalance } });
    
    // Save to Firebase
    await writeData(`ledger/${selectedDocId}`, updatedTransactions);
    await atomicIncrement(`doctors/${selectedDocId}/balance`, txAmount);
    
    toast.success(`Recorded ${txType} of ₹${amount} for ${selectedDocId}`);
    setPaymentAmount('');
    setRefNumber('');
  };

  const savePhone = async () => {
    const updatedDoc = { ...selectedDoc, phone: phoneInput };
    setDoctors({ ...doctors, [selectedDocId]: updatedDoc });
    await writeData(`doctors/${selectedDocId}/phone`, phoneInput);
    setIsEditingPhone(false);
  };

  const savePrice = async () => {
    if (!materialName.trim() || !materialRate || isNaN(Number(materialRate))) return;
    
    const matName = materialName.trim();
    const rate = Number(materialRate);
    
    const updatedPrices = { ...(selectedDoc.prices || {}), [matName]: rate };
    
    // Optimistic
    setDoctors({
      ...doctors,
      [selectedDocId]: { ...selectedDoc, prices: updatedPrices }
    });
    
    await writeData(`doctors/${selectedDocId}/prices`, updatedPrices);
    setMaterialName('');
    setMaterialRate('');
  };

  const deletePrice = async (matName: string) => {
    const updatedPrices = { ...(selectedDoc.prices || {}) };
    delete updatedPrices[matName];
    
    setDoctors({
      ...doctors,
      [selectedDocId]: { ...selectedDoc, prices: updatedPrices }
    });
    
    await writeData(`doctors/${selectedDocId}/prices`, updatedPrices);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Doctor Profiles & Ledger</h1>
          <p className="text-foreground/70">Manage custom pricing, view ledger, and record payments.</p>
        </div>
        <button 
          onClick={handleBulkWhatsApp}
          disabled={isSendingWA}
          className="px-5 py-2.5 bg-[#25D366]/20 text-[#25D366] font-bold rounded-lg hover:bg-[#25D366]/30 transition-all border border-[#25D366]/30 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,211,102,0.2)] disabled:opacity-50"
          title="Auto-send due alerts to all doctors with balances > 0"
        >
          <MessageCircle size={20} className={isSendingWA ? "animate-pulse" : ""} />
          {isSendingWA ? "Sending Auto-Alerts..." : "Auto-Send Due Alerts"}
        </button>
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
                {isEditingPhone ? (
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      value={phoneInput} 
                      onChange={e => setPhoneInput(e.target.value)} 
                      placeholder="Enter phone..."
                      className="bg-black/40 border border-panel-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
                    />
                    <button onClick={savePhone} className="text-accent text-sm font-semibold hover:underline">Save</button>
                    <button onClick={() => setIsEditingPhone(false)} className="text-foreground/50 text-sm hover:underline">Cancel</button>
                  </div>
                ) : (
                  <p className="text-foreground/60 flex items-center gap-3 mt-1">
                    {selectedDoc.phone || 'No phone added'}
                    <button onClick={() => { setIsEditingPhone(true); setPhoneInput(selectedDoc.phone || ''); }} className="text-accent/80 hover:text-accent text-xs font-semibold uppercase tracking-wider">
                      Edit
                    </button>
                  </p>
                )}
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

            {/* Payment and Pricing Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transaction Card */}
              <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-accent" /> Manual Ledger Entry
                </h3>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Type</label>
                    <select 
                      value={txType} 
                      onChange={(e: any) => setTxType(e.target.value)}
                      className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent appearance-none text-sm"
                    >
                      <option value="Payment">Payment Received</option>
                      <option value="Bill">New Bill / Invoice</option>
                      <option value="Credit Note">Credit Note (Refund)</option>
                      <option value="Debit Note">Debit Note (Charge)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 text-sm">₹</span>
                      <input 
                        type="number" 
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-black/40 border border-panel-border rounded-lg pl-7 pr-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">
                      {txType === 'Payment' ? 'Mode' : 'Reference / Details'}
                    </label>
                    {txType === 'Payment' ? (
                      <select 
                        value={paymentMode} 
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent appearance-none text-sm"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI / GPay</option>
                        <option value="NEFT">Bank Transfer (NEFT/RTGS)</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                        className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                        placeholder="e.g. INV-1002"
                      />
                    )}
                  </div>
                  {txType === 'Payment' && (
                    <div>
                      <label className="block text-xs font-medium text-foreground/70 mb-1">Reference (Optional)</label>
                      <input 
                        type="text" 
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                        className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                        placeholder="Txn ID or Cheque No"
                      />
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={recordTransaction}
                  className={`w-full py-2.5 font-bold rounded-lg transition-all shadow-sm border ${
                    txType === 'Payment' || txType === 'Credit Note'
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
                  }`}
                >
                  Record {txType}
                </button>
              </div>

              {/* Custom Pricing Card */}
              <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg h-[280px] flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-accent" /> Custom Pricing
                </h3>
                <div className="flex gap-3 mb-4">
                  <select 
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="flex-1 bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm custom-scrollbar appearance-none"
                  >
                    <option value="" disabled>Select Material...</option>
                    {uniqueMaterials.map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                    {uniqueMaterials.length === 0 && (
                      <option value="" disabled>Upload Excel to load materials</option>
                    )}
                  </select>
                  <div className="relative w-24">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 text-sm">₹</span>
                    <input 
                      type="number" 
                      placeholder="Rate"
                      value={materialRate}
                      onChange={(e) => setMaterialRate(e.target.value)}
                      className="w-full bg-black/40 border border-panel-border rounded-lg pl-7 pr-2 py-2 text-white focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  <button 
                    onClick={savePrice}
                    className="px-4 py-2 bg-accent/20 text-accent font-semibold rounded-lg hover:bg-accent/30 transition-all text-sm whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border border-panel-border rounded-lg bg-black/20 p-2 space-y-1 custom-scrollbar">
                  {Object.entries(selectedDoc.prices || {}).map(([mat, rate]) => (
                    <div key={mat} className="flex items-center justify-between px-3 py-2 bg-black/30 rounded-md">
                      <span className="text-sm font-medium text-white">{mat}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-accent font-bold">₹{String(rate)}</span>
                        <button 
                           onClick={() => deletePrice(mat)}
                           className="text-red-400 hover:text-red-300 text-xs font-bold px-2"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(selectedDoc.prices || {}).length === 0 && (
                    <div className="text-center text-sm text-foreground/50 py-4">No custom prices set</div>
                  )}
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
              <div className="p-5 border-b border-panel-border/50 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="font-bold text-white text-lg">Transaction History</h3>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-black/40 border border-panel-border rounded-lg px-3 py-1">
                    <Calendar size={16} className="text-foreground/50" />
                    <div className="flex items-center gap-2">
                      <input 
                        type="date" 
                        value={dateFrom} 
                        onChange={e => setDateFrom(e.target.value)}
                        className="bg-transparent text-sm text-white focus:outline-none max-w-[120px]"
                      />
                      <span className="text-foreground/50 text-sm">to</span>
                      <input 
                        type="date" 
                        value={dateTo} 
                        onChange={e => setDateTo(e.target.value)}
                        className="bg-transparent text-sm text-white focus:outline-none max-w-[120px]"
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleExportExcel}
                    className="px-4 py-1.5 bg-green-500/20 text-green-400 font-bold rounded-lg hover:bg-green-500/30 transition-all border border-green-500/30 flex items-center gap-2 text-sm"
                    title="Download Excel"
                  >
                    <FileSpreadsheet size={16} />
                    Export
                  </button>
                </div>
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
                    {filteredTransactions.map((tx: any) => {
                      const isReducer = tx.type === 'Payment' || tx.type === 'Credit Note';
                      return (
                      <tr key={tx.id || tx.date} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-foreground/80">{tx.date}</td>
                        <td className="px-6 py-4 font-medium">
                          {tx.description}
                          {tx.paymentMode && (
                            <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] uppercase font-bold tracking-wider">
                              {tx.paymentMode}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap ${isReducer ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold tracking-wide">
                          {tx.amount > 0 ? tx.amount.toLocaleString() : `(${Math.abs(tx.amount).toLocaleString()})`}
                        </td>
                      </tr>
                    )})}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-foreground/50">No transactions recorded in this period.</td>
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
