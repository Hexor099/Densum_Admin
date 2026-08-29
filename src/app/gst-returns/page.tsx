"use client";

import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Download, Calendar, TrendingUp, Building2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

export default function GSTReturnsPage() {
  const { ledger, suppliers, bills: billsData, settings, isInitialized, initializeStore } = useStore();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

  const [selectedFY, setSelectedFY] = useState(`${fyStartYear}-${fyStartYear + 1}`);

  useEffect(() => {
    if (!isInitialized) initializeStore();
  }, [isInitialized, initializeStore]);

  const compositionRate = Number(settings?.compositionRate) || 1.0;
  const turnoverLimit = Number(settings?.compositionTurnoverLimit) || 15000000;

  // Parse FY from selection
  const fyStart = useMemo(() => {
    const [startYear] = selectedFY.split('-').map(Number);
    return new Date(startYear, 3, 1); // April 1
  }, [selectedFY]);

  const fyEnd = useMemo(() => {
    const [, endYear] = selectedFY.split('-').map(Number);
    return new Date(endYear, 2, 31); // March 31
  }, [selectedFY]);

  // Calculate quarterly data
  const quarterlyData = useMemo(() => {
    const quarters = [
      { label: 'Q1 (Apr-Jun)', start: new Date(fyStart.getFullYear(), 3, 1), end: new Date(fyStart.getFullYear(), 5, 30) },
      { label: 'Q2 (Jul-Sep)', start: new Date(fyStart.getFullYear(), 6, 1), end: new Date(fyStart.getFullYear(), 8, 30) },
      { label: 'Q3 (Oct-Dec)', start: new Date(fyStart.getFullYear(), 9, 1), end: new Date(fyStart.getFullYear(), 11, 31) },
      { label: 'Q4 (Jan-Mar)', start: new Date(fyStart.getFullYear() + 1, 0, 1), end: new Date(fyStart.getFullYear() + 1, 2, 31) },
    ];

    return quarters.map(q => {
      let outwardSupply = 0;

      Object.values(ledger).forEach((txs: any) => {
        (txs || []).forEach((tx: any) => {
          const txDate = new Date(tx.date);
          if (txDate >= q.start && txDate <= q.end) {
            if (tx.type === 'Invoice Generated' || tx.type === 'Invoice' || tx.type === 'Charge' || tx.type === 'Bill' || tx.type === 'Debit Note') {
              outwardSupply += Math.abs(Number(tx.amount) || 0);
            }
          }
        });
      });

      const taxLiability = outwardSupply * (compositionRate / 100);
      const cgst = taxLiability / 2;
      const sgst = taxLiability / 2;

      return {
        ...q,
        outwardSupply,
        taxLiability,
        cgst,
        sgst,
      };
    });
  }, [ledger, fyStart, compositionRate]);

  // Annual totals
  const annualTotals = useMemo(() => {
    return quarterlyData.reduce((acc, q) => ({
      outwardSupply: acc.outwardSupply + q.outwardSupply,
      taxLiability: acc.taxLiability + q.taxLiability,
      cgst: acc.cgst + q.cgst,
      sgst: acc.sgst + q.sgst,
    }), { outwardSupply: 0, taxLiability: 0, cgst: 0, sgst: 0 });
  }, [quarterlyData]);

  // Inward supplies (purchases from registered suppliers)
  const inwardSupplies = useMemo(() => {
    const billsArray = billsData ? Object.values(billsData) : [];
    const registeredSupplierBills = billsArray.filter((b: any) => {
      const billDate = new Date(b.date);
      if (billDate < fyStart || billDate > fyEnd) return false;
      if (!b.supplierId || !suppliers[b.supplierId]) return false;
      return !!suppliers[b.supplierId]?.gstin;
    });

    const summary: Record<string, { name: string, gstin: string, totalAmount: number, billCount: number }> = {};
    registeredSupplierBills.forEach((b: any) => {
      const suppId = b.supplierId;
      const supp = suppliers[suppId];
      if (!summary[suppId]) {
        summary[suppId] = { name: supp.name, gstin: supp.gstin, totalAmount: 0, billCount: 0 };
      }
      summary[suppId].totalAmount += Number(b.totalAmount) || 0;
      summary[suppId].billCount += 1;
    });

    return Object.values(summary);
  }, [billsData, suppliers, fyStart, fyEnd]);

  const totalInwardSupply = inwardSupplies.reduce((sum, s) => sum + s.totalAmount, 0);

  // Export GSTR-4 data
  const handleExport = async () => {
    const exportData = quarterlyData.map(q => ({
      'Quarter': q.label,
      'Outward Supply (₹)': q.outwardSupply,
      'Tax Rate (%)': compositionRate,
      'CGST (₹)': Number(q.cgst.toFixed(2)),
      'SGST (₹)': Number(q.sgst.toFixed(2)),
      'Total Tax (₹)': Number(q.taxLiability.toFixed(2)),
    }));

    exportData.push({
      'Quarter': 'ANNUAL TOTAL',
      'Outward Supply (₹)': annualTotals.outwardSupply,
      'Tax Rate (%)': compositionRate,
      'CGST (₹)': Number(annualTotals.cgst.toFixed(2)),
      'SGST (₹)': Number(annualTotals.sgst.toFixed(2)),
      'Total Tax (₹)': Number(annualTotals.taxLiability.toFixed(2)),
    });

    const inwardExport = inwardSupplies.map(s => ({
      'Supplier Name': s.name,
      'GSTIN': s.gstin,
      'Total Purchase (₹)': s.totalAmount,
      'Number of Bills': s.billCount,
    }));

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    
    const ws1 = xlsx.utils.json_to_sheet(exportData);
    xlsx.utils.book_append_sheet(workbook, ws1, "Outward Supply & Tax");

    const ws2 = xlsx.utils.json_to_sheet(inwardExport);
    xlsx.utils.book_append_sheet(workbook, ws2, "Inward Supply (Registered)");

    xlsx.writeFile(workbook, `GSTR4_Data_FY${selectedFY}.xlsx`);
    toast.success('GSTR-4 data exported successfully!');
  };

  if (!isInitialized) {
    return <div className="p-10 text-center text-foreground/50 animate-pulse">Loading GST Returns...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <ShieldCheck className="text-green-400" /> GST Returns (GSTR-4)
          </h1>
          <p className="text-foreground/70">Composition Scheme — Annual return data for filing.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/40 border border-panel-border rounded-lg px-3 py-2">
            <Calendar size={16} className="text-foreground/50" />
            <select
              value={selectedFY}
              onChange={e => setSelectedFY(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none"
            >
              {[0, 1, 2].map(offset => {
                const y = fyStartYear - offset;
                return <option key={y} value={`${y}-${y + 1}`}>FY {y}-{String(y + 1).slice(-2)}</option>;
              })}
            </select>
          </div>
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-green-500/20 text-green-400 font-bold rounded-lg hover:bg-green-500/30 transition-all border border-green-500/30 flex items-center gap-2"
          >
            <FileSpreadsheet size={18} /> Export for GST Portal
          </button>
        </div>
      </header>

      {/* Annual Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-accent" />
            <h3 className="text-foreground/70 font-semibold text-sm uppercase tracking-wide">Annual Turnover</h3>
          </div>
          <div className="text-3xl font-bold text-white">₹{annualTotals.outwardSupply.toLocaleString()}</div>
          <div className="mt-2">
            <div className="w-full bg-black/40 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all ${annualTotals.outwardSupply / turnoverLimit > 0.8 ? 'bg-red-400' : 'bg-green-400'}`}
                style={{ width: `${Math.min(100, (annualTotals.outwardSupply / turnoverLimit) * 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-foreground/50 mt-1">{((annualTotals.outwardSupply / turnoverLimit) * 100).toFixed(1)}% of limit</div>
          </div>
        </div>

        <div className="bg-panel rounded-xl border border-green-500/30 p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={18} className="text-green-400" />
            <h3 className="text-foreground/70 font-semibold text-sm uppercase tracking-wide">Total Tax Payable</h3>
          </div>
          <div className="text-3xl font-bold text-green-400">₹{annualTotals.taxLiability.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          <div className="text-xs text-foreground/50 mt-1">@ {compositionRate}% of turnover</div>
        </div>

        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-foreground/70 font-semibold text-sm uppercase tracking-wide">CGST ({compositionRate / 2}%)</h3>
          </div>
          <div className="text-2xl font-bold text-white">₹{annualTotals.cgst.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
        </div>

        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-foreground/70 font-semibold text-sm uppercase tracking-wide">SGST ({compositionRate / 2}%)</h3>
          </div>
          <div className="text-2xl font-bold text-white">₹{annualTotals.sgst.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20">
          <h3 className="font-bold text-white text-lg">Quarterly Outward Supply & Tax Liability</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-foreground/60 uppercase bg-black/40">
              <tr>
                <th className="px-6 py-4">Quarter</th>
                <th className="px-6 py-4 text-right">Outward Supply (₹)</th>
                <th className="px-6 py-4 text-right">CGST ({compositionRate / 2}%)</th>
                <th className="px-6 py-4 text-right">SGST ({compositionRate / 2}%)</th>
                <th className="px-6 py-4 text-right">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody>
              {quarterlyData.map((q, idx) => (
                <tr key={idx} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{q.label}</td>
                  <td className="px-6 py-4 text-right text-foreground/80">{q.outwardSupply.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-foreground/80">{q.cgst.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                  <td className="px-6 py-4 text-right text-foreground/80">{q.sgst.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-400">{q.taxLiability.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                </tr>
              ))}
              <tr className="bg-black/30 border-t-2 border-accent/30">
                <td className="px-6 py-4 font-bold text-accent">ANNUAL TOTAL</td>
                <td className="px-6 py-4 text-right font-bold text-white">{annualTotals.outwardSupply.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-bold text-white">{annualTotals.cgst.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                <td className="px-6 py-4 text-right font-bold text-white">{annualTotals.sgst.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                <td className="px-6 py-4 text-right font-bold text-green-400 text-lg">{annualTotals.taxLiability.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward Supplies */}
      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Building2 size={20} className="text-accent" /> Inward Supplies (from Registered Dealers)
            </h3>
            <p className="text-xs text-foreground/50 mt-1">Required in GSTR-4 Table 4 — purchases from registered persons</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-foreground/50">Total Inward Supply</div>
            <div className="text-xl font-bold text-white">₹{totalInwardSupply.toLocaleString()}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-foreground/60 uppercase bg-black/40">
              <tr>
                <th className="px-6 py-4">Supplier Name</th>
                <th className="px-6 py-4">GSTIN</th>
                <th className="px-6 py-4 text-center">Bills</th>
                <th className="px-6 py-4 text-right">Total Purchase (₹)</th>
              </tr>
            </thead>
            <tbody>
              {inwardSupplies.map((s, idx) => (
                <tr key={idx} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{s.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-foreground/70">{s.gstin}</td>
                  <td className="px-6 py-4 text-center text-foreground/70">{s.billCount}</td>
                  <td className="px-6 py-4 text-right font-bold text-white">{s.totalAmount.toLocaleString()}</td>
                </tr>
              ))}
              {inwardSupplies.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-foreground/50">
                    No purchases from registered suppliers in this FY. Make sure supplier GSTIN is saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-panel rounded-xl border border-yellow-500/30 p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-400" />
          <h3 className="font-bold text-white">Important Notes for GSTR-4 Filing</h3>
        </div>
        <ul className="space-y-2 text-sm text-foreground/70">
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">•</span>
            <span>GSTR-4 must be filed <strong className="text-white">annually</strong> by <strong className="text-white">April 30</strong> of the following financial year.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">•</span>
            <span>Tax payment via <strong className="text-white">CMP-08</strong> challan must be done <strong className="text-white">quarterly</strong> (by 18th of the month following the quarter).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">•</span>
            <span>You <strong className="text-red-400">cannot claim Input Tax Credit (ITC)</strong> on any purchases under the Composition Scheme.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">•</span>
            <span>The tax is paid by you (the business), <strong className="text-white">not collected from customers</strong>.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
