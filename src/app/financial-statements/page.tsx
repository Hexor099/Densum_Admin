"use client";

import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Calendar, TrendingUp, TrendingDown, Calculator, FileSpreadsheet, Scale, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

export default function FinancialStatementsPage() {
  const { ledger, expenses, settings, isInitialized, initializeStore } = useStore();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

  const [selectedFY, setSelectedFY] = useState(`${fyStartYear}-${fyStartYear + 1}`);

  useEffect(() => {
    if (!isInitialized) initializeStore();
  }, [isInitialized, initializeStore]);

  // Parse FY from selection
  const fyStart = useMemo(() => {
    const [startYear] = selectedFY.split('-').map(Number);
    return `${startYear}-04-01`;
  }, [selectedFY]);

  const fyEnd = useMemo(() => {
    const [, endYear] = selectedFY.split('-').map(Number);
    return `${endYear}-03-31`;
  }, [selectedFY]);

  // Revenue & Turnover from ledger
  const { totalRevenue, totalTurnover } = useMemo(() => {
    let rev = 0; // Cash-basis (Payments received)
    let turnover = 0; // Accrual-basis (Bills generated) for GST
    
    Object.values(ledger).forEach((txs: any) => {
      (txs || []).forEach((tx: any) => {
        if (tx.date >= fyStart && tx.date <= fyEnd) {
          if (tx.type === 'Payment') {
            rev += Math.abs(Number(tx.amount) || 0);
          }
          if (tx.type === 'Invoice Generated' || tx.type === 'Invoice' || tx.type === 'Charge' || tx.type === 'Bill') {
            turnover += Math.abs(Number(tx.amount) || 0);
          }
        }
      });
    });
    return { totalRevenue: rev, totalTurnover: turnover };
  }, [ledger, fyStart, fyEnd]);

  // Categorized expenses
  const expenseBreakdown = useMemo(() => {
    const expensesArray = Array.isArray(expenses) ? expenses : (expenses ? Object.values(expenses) : []);
    const filtered = expensesArray.filter((e: any) => e.date >= fyStart && e.date <= fyEnd);

    const categories: Record<string, number> = {};
    filtered.forEach((e: any) => {
      const cat = e.category || 'Other';
      categories[cat] = (categories[cat] || 0) + Number(e.amount);
    });

    // Map to ITR Schedule P&L line items
    const itrMapping: Record<string, string> = {
      'Materials': 'Cost of Materials Consumed',
      'Inventory Purchase': 'Cost of Materials Consumed',
      'Salary': 'Employee Benefit Expenses',
      'Rent': 'Rent',
      'Utilities': 'Utilities & Power',
      'Maintenance': 'Repairs & Maintenance',
      'Depreciation': 'Depreciation & Amortization',
      'Insurance': 'Insurance',
      'Professional Fees': 'Professional & Legal Fees',
      'Communication': 'Communication Expenses',
      'Bank Charges': 'Bank Charges & Interest',
      'Rates & Taxes': 'Rates & Taxes',
      'Office Expenses': 'Office & Administrative Expenses',
      'Marketing': 'Marketing & Advertisement',
      'Other': 'Miscellaneous Expenses',
    };

    const itrBreakdown: Record<string, number> = {};
    Object.entries(categories).forEach(([cat, amount]) => {
      const itrLabel = itrMapping[cat] || 'Miscellaneous Expenses';
      itrBreakdown[itrLabel] = (itrBreakdown[itrLabel] || 0) + amount;
    });

    return { raw: categories, itr: itrBreakdown };
  }, [expenses, fyStart, fyEnd]);

  const totalExpenses = Object.values(expenseBreakdown.itr).reduce((sum, v) => sum + v, 0);

  // Composition GST liability (Must be calculated on Turnover, not Cash Received)
  const compositionRate = Number(settings?.compositionRate) || 1.0;
  const gstLiability = totalTurnover * (compositionRate / 100);
  const totalExpensesWithGST = totalExpenses + gstLiability;

  // Net Profit (actual — for ITR-3)
  const netProfitActual = totalRevenue - totalExpensesWithGST;

  // ITR-4 (Presumptive) calculations under Section 44AD
  const presumptiveRate8 = 0.08;
  const presumptiveRate6 = 0.06;
  const presumptiveIncome8 = totalRevenue * presumptiveRate8;
  const presumptiveIncome6 = totalRevenue * presumptiveRate6;

  // Tax computation (simplified — Old Regime for comparison)
  const computeTax = (income: number) => {
    if (income <= 250000) return 0;
    if (income <= 500000) return (income - 250000) * 0.05;
    if (income <= 1000000) return 12500 + (income - 500000) * 0.20;
    return 112500 + (income - 1000000) * 0.30;
  };

  // Tax computation (New Regime)
  const computeTaxNewRegime = (income: number) => {
    if (income <= 300000) return 0;
    if (income <= 700000) return (income - 300000) * 0.05;
    if (income <= 1000000) return 20000 + (income - 700000) * 0.10;
    if (income <= 1200000) return 50000 + (income - 1000000) * 0.15;
    if (income <= 1500000) return 80000 + (income - 1200000) * 0.20;
    return 140000 + (income - 1500000) * 0.30;
  };

  const taxITR3OldRegime = computeTax(netProfitActual);
  const taxITR3NewRegime = computeTaxNewRegime(netProfitActual);
  const taxITR4_8_Old = computeTax(presumptiveIncome8);
  const taxITR4_6_Old = computeTax(presumptiveIncome6);
  const taxITR4_8_New = computeTaxNewRegime(presumptiveIncome8);
  const taxITR4_6_New = computeTaxNewRegime(presumptiveIncome6);

  const bestOption = useMemo(() => {
    const options = [
      { name: 'ITR-3 (Old Regime)', tax: taxITR3OldRegime },
      { name: 'ITR-3 (New Regime)', tax: taxITR3NewRegime },
      { name: 'ITR-4 @ 8% (Old Regime)', tax: taxITR4_8_Old },
      { name: 'ITR-4 @ 6% (Old Regime)', tax: taxITR4_6_Old },
      { name: 'ITR-4 @ 8% (New Regime)', tax: taxITR4_8_New },
      { name: 'ITR-4 @ 6% (New Regime)', tax: taxITR4_6_New },
    ];
    return options.reduce((best, curr) => curr.tax < best.tax ? curr : best, options[0]);
  }, [taxITR3OldRegime, taxITR3NewRegime, taxITR4_8_Old, taxITR4_6_Old, taxITR4_8_New, taxITR4_6_New]);

  // Export P&L
  const handleExport = async () => {
    const plRows = [
      { 'Particulars': 'INCOME', 'Amount (₹)': '' },
      { 'Particulars': 'Revenue from Operations', 'Amount (₹)': totalRevenue },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'EXPENSES', 'Amount (₹)': '' },
    ];

    Object.entries(expenseBreakdown.itr)
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, amount]) => {
        plRows.push({ 'Particulars': label, 'Amount (₹)': amount });
      });

    plRows.push({ 'Particulars': 'GST (Composition @ ' + compositionRate + '%)', 'Amount (₹)': gstLiability });
    plRows.push({ 'Particulars': '', 'Amount (₹)': '' });
    plRows.push({ 'Particulars': 'TOTAL EXPENSES', 'Amount (₹)': totalExpensesWithGST });
    plRows.push({ 'Particulars': 'NET PROFIT / (LOSS)', 'Amount (₹)': netProfitActual });

    const taxRows = [
      { 'Option': 'ITR-3 (Actual Books — Old Regime)', 'Taxable Income (₹)': netProfitActual, 'Tax Payable (₹)': taxITR3OldRegime },
      { 'Option': 'ITR-3 (Actual Books — New Regime)', 'Taxable Income (₹)': netProfitActual, 'Tax Payable (₹)': taxITR3NewRegime },
      { 'Option': 'ITR-4 Presumptive @ 8% (Old Regime)', 'Taxable Income (₹)': presumptiveIncome8, 'Tax Payable (₹)': taxITR4_8_Old },
      { 'Option': 'ITR-4 Presumptive @ 6% (Old Regime)', 'Taxable Income (₹)': presumptiveIncome6, 'Tax Payable (₹)': taxITR4_6_Old },
      { 'Option': 'ITR-4 Presumptive @ 8% (New Regime)', 'Taxable Income (₹)': presumptiveIncome8, 'Tax Payable (₹)': taxITR4_8_New },
      { 'Option': 'ITR-4 Presumptive @ 6% (New Regime)', 'Taxable Income (₹)': presumptiveIncome6, 'Tax Payable (₹)': taxITR4_6_New },
    ];

    const xlsx = await import('xlsx');
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(plRows), "Profit & Loss");
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(taxRows), "Tax Comparison");
    xlsx.writeFile(wb, `Financial_Statements_FY${selectedFY}.xlsx`);
    toast.success('Financial statements exported!');
  };

  if (!isInitialized) {
    return <div className="p-10 text-center text-foreground/50 animate-pulse">Loading Financial Statements...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-sm sm:text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Scale className="text-accent" /> Financial Statements & ITR
          </h1>
          <p className="text-foreground/70">Profit &amp; Loss statement and ITR-3 vs ITR-4 tax comparison.</p>
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
            className="px-5 py-2.5 bg-accent/20 text-accent font-bold rounded-lg hover:bg-accent/30 transition-all border border-accent/30 flex items-center gap-2"
          >
            <FileSpreadsheet size={18} /> Export for CA
          </button>
        </div>
      </header>

      {/* P&L Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-6">
        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-6 shadow-lg flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-accent" />
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm uppercase leading-tight break-words">Revenue</h3>
          </div>
          <div className="text-sm sm:text-3xl font-bold text-white">₹{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-6 shadow-lg flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={18} className="text-red-400" />
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm uppercase leading-tight break-words">Total Expenses (incl. GST)</h3>
          </div>
          <div className="text-sm sm:text-3xl font-bold text-red-400">₹{totalExpensesWithGST.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
        </div>
        <div className={`bg-panel rounded-xl border ${netProfitActual >= 0 ? 'border-green-500/30' : 'border-red-500/30'} p-2 sm:p-6 shadow-lg flex flex-col justify-center`}>
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={18} className={netProfitActual >= 0 ? 'text-green-400' : 'text-red-400'} />
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm uppercase leading-tight break-words">Net Profit</h3>
          </div>
          <div className={`text-sm sm:text-3xl font-bold ${netProfitActual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ₹{netProfitActual.toLocaleString(undefined, {maximumFractionDigits: 0})}
          </div>
          <div className="text-xs text-foreground/50 mt-1">
            {totalRevenue > 0 ? ((netProfitActual / totalRevenue) * 100).toFixed(1) : '0.0'}% margin
          </div>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <FileText size={20} className="text-accent" /> Profit & Loss Statement — FY {selectedFY}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-foreground/60 uppercase bg-black/40">
              <tr>
                <th className="px-6 py-4">Particulars</th>
                <th className="px-6 py-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue Section */}
              <tr className="bg-accent/5 border-b border-panel-border/30">
                <td className="px-6 py-3 font-bold text-accent uppercase tracking-wider text-xs" colSpan={2}>Income</td>
              </tr>
              <tr className="border-b border-panel-border/30">
                <td className="px-6 py-3 pl-10 text-white">Revenue from Operations</td>
                <td className="px-6 py-3 text-right font-bold text-white">{totalRevenue.toLocaleString()}</td>
              </tr>

              {/* Expense Section */}
              <tr className="bg-red-500/5 border-b border-panel-border/30">
                <td className="px-6 py-3 font-bold text-red-400 uppercase tracking-wider text-xs" colSpan={2}>Expenses</td>
              </tr>
              {Object.entries(expenseBreakdown.itr)
                .sort((a, b) => b[1] - a[1])
                .map(([label, amount]) => (
                  <tr key={label} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 pl-10 text-foreground/80">{label}</td>
                    <td className="px-6 py-3 text-right text-red-400">{amount.toLocaleString()}</td>
                  </tr>
                ))
              }
              <tr className="border-b border-panel-border/30 hover:bg-white/5 transition-colors">
                <td className="px-6 py-3 pl-10 text-foreground/80">GST (Composition Scheme @ {compositionRate}%)</td>
                <td className="px-6 py-3 text-right text-red-400">{gstLiability.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
              </tr>

              {/* Total Expenses */}
              <tr className="bg-black/30 border-t border-panel-border">
                <td className="px-6 py-3 font-bold text-white">Total Expenses</td>
                <td className="px-6 py-3 text-right font-bold text-red-400">{totalExpensesWithGST.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
              </tr>

              {/* Net Profit */}
              <tr className="bg-black/40 border-t-2 border-accent/30">
                <td className="px-6 py-4 font-bold text-accent text-lg">Net Profit / (Loss)</td>
                <td className={`px-6 py-4 text-right font-bold text-lg ${netProfitActual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netProfitActual >= 0 ? '' : '('}₹{Math.abs(netProfitActual).toLocaleString(undefined, {maximumFractionDigits: 0})}{netProfitActual >= 0 ? '' : ')'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ITR Comparison */}
      <div className="bg-panel rounded-xl border border-accent/30 overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Calculator size={20} className="text-accent" /> ITR-3 vs ITR-4 Tax Comparison
          </h3>
          <p className="text-xs text-foreground/50 mt-1">Compare actual books (ITR-3) vs presumptive taxation (ITR-4) to choose the most tax-efficient option.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-foreground/60 uppercase bg-black/40">
              <tr>
                <th className="px-6 py-4">Option</th>
                <th className="px-6 py-4 text-right">Taxable Income (₹)</th>
                <th className="px-6 py-4 text-right">Income Tax (₹)</th>
                <th className="px-6 py-4 text-center">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'ITR-3: Actual Books (Old Regime)', income: netProfitActual, tax: taxITR3OldRegime, desc: 'Full P&L books needed' },
                { name: 'ITR-3: Actual Books (New Regime)', income: netProfitActual, tax: taxITR3NewRegime, desc: 'Full P&L books needed' },
                { name: 'ITR-4: Presumptive @ 8% (Old Regime)', income: presumptiveIncome8, tax: taxITR4_8_Old, desc: 'No books needed' },
                { name: 'ITR-4: Presumptive @ 6% (Old Regime)', income: presumptiveIncome6, tax: taxITR4_6_Old, desc: 'If >95% digital payments' },
                { name: 'ITR-4: Presumptive @ 8% (New Regime)', income: presumptiveIncome8, tax: taxITR4_8_New, desc: 'No books needed' },
                { name: 'ITR-4: Presumptive @ 6% (New Regime)', income: presumptiveIncome6, tax: taxITR4_6_New, desc: 'If >95% digital payments' },
              ].map((opt, idx) => {
                const isBest = opt.name.includes(bestOption.name.split('(')[0].trim()) && opt.tax === bestOption.tax;
                return (
                  <tr key={idx} className={`border-b border-panel-border/30 hover:bg-white/5 transition-colors ${isBest ? 'bg-green-500/10' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{opt.name}</div>
                      <div className="text-xs text-foreground/50">{opt.desc}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-foreground/80">{opt.income.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td className="px-6 py-4 text-right font-bold text-white">{opt.tax.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td className="px-6 py-4 text-center">
                      {isBest && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500/30">
                          ✓ LOWEST TAX
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Best Option Banner */}
      <div className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent rounded-xl border border-green-500/30 p-2 sm:p-6 shadow-lg flex flex-col justify-center flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
          <Calculator size={28} className="text-green-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">Best Option: {bestOption.name}</h3>
          <p className="text-foreground/70">
            You save the most by filing under <strong className="text-green-400">{bestOption.name}</strong> with a tax liability of <strong className="text-green-400">₹{bestOption.tax.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>.
            {netProfitActual < presumptiveIncome8 && ' Your actual profit margin is lower than the 8% presumptive rate, so ITR-3 with actual books saves you more.'}
            {netProfitActual > presumptiveIncome8 && ' Your actual profit margin exceeds 8%, so presumptive taxation under ITR-4 is more beneficial.'}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-panel rounded-xl border border-yellow-500/30 p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/70">
            <strong className="text-yellow-400">Disclaimer:</strong> This is an indicative tax computation. Actual tax liability may vary based on deductions (80C, 80D etc.), surcharges, cess, and other income. 
            Please consult your Chartered Accountant before filing. Export the data using the &quot;Export for CA&quot; button above.
          </p>
        </div>
      </div>
    </div>
  );
}
