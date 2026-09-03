"use client";

import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Clock, MessageCircle, Search } from 'lucide-react';
import { sendWhatsAppAction } from '@/app/actions/whatsapp';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';

export default function AgingReportPage() {
  const { ledger, doctors, isInitialized, initializeStore } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSendingWA, setIsSendingWA] = useState(false);

  useEffect(() => {
    if (!isInitialized) initializeStore();
  }, [isInitialized, initializeStore]);

  const agingData = useMemo(() => {
    const report: any[] = [];
    const now = new Date();

    Object.entries(doctors).forEach(([docId, doc]: [string, any]) => {
      const balance = Number(doc.balance) || 0;
      if (balance <= 0) return; // No outstanding debt

      let unallocatedBalance = balance;
      const buckets = {
        '0_30': 0,
        '31_60': 0,
        '61_90': 0,
        '90_plus': 0
      };

      const txs = ledger[docId] || [];
      // Sort NEWEST first
      const sortedTxs = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (const tx of sortedTxs) {
        if (unallocatedBalance <= 0) break;

        // Bills, Invoices, Debit Notes, and Charges increase debt
        if (tx.type === 'Bill' || tx.type === 'Debit Note' || tx.type === 'Invoice Generated' || tx.type === 'Invoice' || tx.type === 'Charge') {
          const amount = tx.amount > 0 ? tx.amount : Math.abs(tx.amount);
          const allocated = Math.min(amount, unallocatedBalance);

          const txDate = new Date(tx.date);
          const diffTime = Math.abs(now.getTime() - txDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 30) buckets['0_30'] += allocated;
          else if (diffDays <= 60) buckets['31_60'] += allocated;
          else if (diffDays <= 90) buckets['61_90'] += allocated;
          else buckets['90_plus'] += allocated;

          unallocatedBalance -= allocated;
        }
      }

      // If there's still balance left (e.g. opening balances), put it in 90+
      if (unallocatedBalance > 0) {
        buckets['90_plus'] += unallocatedBalance;
      }

      report.push({
        docId,
        docName: doc.name || docId,
        phone: doc.phone,
        totalOutstanding: balance,
        buckets
      });
    });

    return report.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [ledger, doctors]);

  const filteredReport = agingData.filter(r =>
    r.docName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBuckets = useMemo(() => {
    const totals = { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0, total: 0 };
    filteredReport.forEach(r => {
      totals['0_30'] += r.buckets['0_30'];
      totals['31_60'] += r.buckets['31_60'];
      totals['61_90'] += r.buckets['61_90'];
      totals['90_plus'] += r.buckets['90_plus'];
      totals.total += r.totalOutstanding;
    });
    return totals;
  }, [filteredReport]);

  const handleBulkEscalation = async () => {
    // Target doctors with debt > 60 days
    const targets = agingData.filter(r => (r.buckets['61_90'] > 0 || r.buckets['90_plus'] > 0) && r.phone);

    if (targets.length === 0) {
      toast.error("No doctors found with 60+ days overdue balance and a saved phone number.");
      return;
    }

    if (!confirm(`This will automatically send URGENT WhatsApp escalations to ${targets.length} doctors. Continue?`)) return;

    setIsSendingWA(true);
    let successCount = 0;

    for (const r of targets) {
      const overdueAmount = r.buckets['61_90'] + r.buckets['90_plus'];
      const text = `URGENT: Hello ${r.docName}, you have an overdue balance of ₹${overdueAmount} pending for more than 60 days. Your total outstanding is ₹${r.totalOutstanding}. Please clear this immediately to avoid service interruption.`;

      let phone = r.phone;
      if (!phone.startsWith('+')) phone = '+91' + phone;

      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      const popup = window.open(url, '_blank');

      if (!popup) {
        toast.error("Popup blocker prevented opening WhatsApp. Please allow popups for this site, then try again.");
        break;
      }

      try {
        const res = await sendWhatsAppAction(r.phone, text);
        if (res.success) successCount++;
      } catch (e) {
        console.error("Failed for", r.docName);
      }
    }

    setIsSendingWA(false);
    toast.success(`Finished! Successfully sent ${successCount} out of ${targets.length} escalation messages.`);
  };

  if (!isInitialized) {
    return <div className="p-10 text-center text-foreground/50 animate-pulse">Loading Aging Report...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-sm sm:text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Clock className="text-accent" /> Receivables Aging Report
          </h1>
          <p className="text-foreground/70">Track overdue balances by age (FIFO method) to prioritize collections.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleBulkEscalation}
            disabled={isSendingWA}
            className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-all border border-red-500/30 flex items-center gap-2 disabled:opacity-50"
          >
            <AlertTriangle size={20} className={isSendingWA ? "animate-pulse" : ""} />
            Escalate 60+ Days
          </button>
        </div>
      </header>

      {/* Summary Row */}
      <div className="grid grid-cols-5 gap-2 sm:gap-6 mb-6">
        <div className="bg-panel border border-panel-border p-4 rounded-xl shadow-lg">
          <div className="text-xs text-foreground/60 uppercase font-bold tracking-wider mb-1">0 - 30 Days</div>
          <div className="text-sm sm:text-xl font-bold text-white">₹{totalBuckets['0_30'].toLocaleString()}</div>
        </div>
        <div className="bg-panel border border-panel-border p-4 rounded-xl shadow-lg">
          <div className="text-xs text-foreground/60 uppercase font-bold tracking-wider mb-1">31 - 60 Days</div>
          <div className="text-sm sm:text-xl font-bold text-yellow-400">₹{totalBuckets['31_60'].toLocaleString()}</div>
        </div>
        <div className="bg-panel border border-panel-border p-4 rounded-xl shadow-lg">
          <div className="text-xs text-foreground/60 uppercase font-bold tracking-wider mb-1">61 - 90 Days</div>
          <div className="text-sm sm:text-xl font-bold text-orange-400">₹{totalBuckets['61_90'].toLocaleString()}</div>
        </div>
        <div className="bg-panel border border-panel-border p-4 rounded-xl shadow-lg">
          <div className="text-xs text-foreground/60 uppercase font-bold tracking-wider mb-1">&gt; 90 Days</div>
          <div className="text-sm sm:text-xl font-bold text-red-400">₹{totalBuckets['90_plus'].toLocaleString()}</div>
        </div>
        <div className="bg-panel border border-accent/30 p-4 rounded-xl shadow-[0_0_15px_rgba(0,194,255,0.1)] col-span-2 md:col-span-1">
          <div className="text-xs text-accent uppercase font-bold tracking-wider mb-1">Total Outstanding</div>
          <div className="text-sm sm:text-xl font-bold text-white">₹{totalBuckets.total.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg mt-6">
        <div className="p-5 border-b border-panel-border/50 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-white text-lg">Doctor Aging Breakdown</h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={20} />
            <input
              type="text"
              placeholder="Search doctor..."
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
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4 text-right">0-30 Days</th>
                <th className="px-6 py-4 text-right">31-60 Days</th>
                <th className="px-6 py-4 text-right">61-90 Days</th>
                <th className="px-6 py-4 text-right">&gt; 90 Days</th>
                <th className="px-6 py-4 text-right">Total O/S (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filteredReport.map((r: any) => {
                const isCritical = r.buckets['61_90'] > 0 || r.buckets['90_plus'] > 0;
                return (
                  <tr key={r.docId} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                      {r.docName}
                      {isCritical && <span title="Critical Overdue"><AlertTriangle size={14} className="text-red-400 ml-2" /></span>}
                    </td>
                    <td className="px-6 py-4 text-right text-foreground/80">{r.buckets['0_30'] > 0 ? r.buckets['0_30'].toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right text-yellow-400/80">{r.buckets['31_60'] > 0 ? r.buckets['31_60'].toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right text-orange-400">{r.buckets['61_90'] > 0 ? r.buckets['61_90'].toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right text-red-400 font-bold">{r.buckets['90_plus'] > 0 ? r.buckets['90_plus'].toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-white bg-black/20 border-l border-panel-border/50">
                      {r.totalOutstanding.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {filteredReport.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-foreground/50">No outstanding balances found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
