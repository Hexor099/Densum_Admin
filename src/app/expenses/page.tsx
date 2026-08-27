"use client";

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Receipt, DollarSign, Plus, Calculator, AlertTriangle, Trash2, X, Download, FileSpreadsheet, Calendar } from 'lucide-react';
import { fetchData, writeData } from '@/lib/firebase';
import * as xlsx from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const COLORS = ['#00a8e8', '#4ade80', '#f472b6', '#fbbf24', '#a78bfa', '#94a3b8', '#38bdf8'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  
  const [viewingBillImage, setViewingBillImage] = useState<string | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const defaultFYStart = currentMonth >= 3 ? `${currentYear}-04-01` : `${currentYear - 1}-04-01`;
  const defaultFYEnd = currentMonth >= 3 ? `${currentYear + 1}-03-31` : `${currentYear}-03-31`;

  const [dateFrom, setDateFrom] = useState(defaultFYStart);
  const [dateTo, setDateTo] = useState(defaultFYEnd);
  
  const [rawLedger, setRawLedger] = useState<any>({});

  useEffect(() => {
    async function loadData() {
      const expData = await fetchData('expenses');
      if (expData) setExpenses(expData);

      const ledger = await fetchData('ledger');
      if (ledger) setRawLedger(ledger);
    }
    loadData();
  }, []);

  // Filter expenses and calculate revenue based on date range
  const { filteredExpenses, taxableRevenue } = useMemo(() => {
    let rev = 0;
    Object.values(rawLedger).forEach((txs: any) => {
      txs.forEach((tx: any) => {
        const txDate = tx.date;
        if (txDate >= dateFrom && txDate <= dateTo) {
          if (tx.type === 'Payment') {
            rev += Math.abs(tx.amount);
          } else if (tx.type === 'Charge' || tx.type === 'Invoice') {
            rev += tx.amount > 0 ? tx.amount : Math.abs(tx.amount);
          }
        }
      });
    });

    const currentExpensesArray = Array.isArray(expenses) ? expenses : (expenses ? Object.values(expenses) : []);
    const fExpenses = currentExpensesArray.filter((e: any) => e.date >= dateFrom && e.date <= dateTo);
    
    return { filteredExpenses: fExpenses, taxableRevenue: rev };
  }, [expenses, rawLedger, dateFrom, dateTo]);

  const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const netProfit = taxableRevenue - totalExpenses;
  const profitMargin = taxableRevenue > 0 ? ((netProfit / taxableRevenue) * 100).toFixed(1) : "0.0";

  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount);
    });
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert("No expenses in the selected date range to export.");
      return;
    }
    const exportData = filteredExpenses.map(e => ({
      Date: e.date,
      Category: e.category,
      Description: e.desc,
      'Amount (INR)': e.amount
    }));

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Expenses");
    xlsx.writeFile(workbook, `Expenses_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const logExpense = async () => {
    if(!amount || !category || isNaN(Number(amount)) || Number(amount) <= 0) return;
    
    const newExpense = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      category,
      amount: Number(amount),
      desc
    };

    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);

    await writeData('expenses', updatedExpenses);
    
    alert(`Logged ${category} expense of ₹${amount}`);
    setCategory(''); setAmount(''); setDesc('');
  };

  const handleDeleteExpense = async (expense: any) => {
    try {
      // Determine if this is a Bill Scan expense (contains Invoice #)
      const billMatch = expense.desc?.match(/\(Invoice #(.*?)\)/);
      
      if (billMatch) {
        const invoiceNo = String(billMatch[1]).trim();
        const confirmDelete = confirm(
          `This expense is linked to an AI Bill Scan (Invoice #${invoiceNo}).\n\n` +
          `Deleting this will ALSO subtract the purchased items from your inventory and delete the bill history.\n\n` +
          `Are you sure you want to proceed?`
        );
        if (!confirmDelete) return;
        
        // Step 1: Find the matching bill
        const allBills = await fetchData('bills');
        if (allBills) {
          const billEntries = Object.entries(allBills);
          const matchedBillEntry = billEntries.find(([_, b]: any) => b && String(b.invoiceNo).trim() === invoiceNo);
          
          if (matchedBillEntry) {
            const [billId, billData] = matchedBillEntry as [string, any];
            
            // Step 2: Revert inventory concurrently
            if (billData && billData.items && Array.isArray(billData.items)) {
              await Promise.all(billData.items.map(async (item: any) => {
                if (!item || !item.name) return;
                const itemId = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const existingData = await fetchData(`lab_catalog/${itemId}`);
                if (existingData) {
                  const currentQty = existingData.qty || 0;
                  const revertedQty = Math.max(0, currentQty - (item.qty || 0));
                  await writeData(`lab_catalog/${itemId}/qty`, revertedQty);
                }
              }));
            }
            
            // Step 3: Delete bill
            await writeData(`bills/${billId}`, null);

            // Step 3.5: Revert Supplier Ledger and Balance
            if (billData && billData.supplierId) {
              const supplierId = billData.supplierId;
              const billAmount = billData.totalAmount || 0;
              
              // Remove the transaction from supplier_ledger
              const suppLedger = await fetchData(`supplier_ledger/${supplierId}`);
              if (suppLedger && Array.isArray(suppLedger)) {
                // Find and remove the matching transaction by refNumber or amount/date
                const updatedLedger = suppLedger.filter(tx => 
                  !(tx.type === 'Bill' && String(tx.refNumber) === String(invoiceNo) && Number(tx.amount) === Number(billAmount))
                );
                await writeData(`supplier_ledger/${supplierId}`, updatedLedger);
              }
              
              // Reduce the supplier balance
              const currentSupplier = await fetchData(`suppliers/${supplierId}`);
              if (currentSupplier) {
                const currentBalance = Number(currentSupplier.balance) || 0;
                await writeData(`suppliers/${supplierId}/balance`, currentBalance - billAmount);
              }
            }
          } else {
            alert(`Note: The original bill for Invoice #${invoiceNo} could not be found. The expense will still be deleted.`);
          }
        }
      } else {
        // Normal expense
        if (!confirm(`Are you sure you want to delete this expense: ${expense.category} - ₹${expense.amount}?`)) return;
      }
      
      // Step 4: Remove expense from expenses array safely
      const currentExpensesArray = Array.isArray(expenses) ? expenses : (expenses ? Object.values(expenses) : []);
      // If the expense doesn't have an ID for some reason, match by date and amount as fallback
      const updatedExpenses = currentExpensesArray.filter((e: any) => {
        if (expense.id && e.id) return String(e.id) !== String(expense.id);
        return !(e.date === expense.date && e.amount === expense.amount && e.desc === expense.desc);
      });
      
      setExpenses(updatedExpenses);
      await writeData('expenses', updatedExpenses);
    } catch (error) {
      console.error("Failed to delete expense:", error);
      alert("An error occurred while deleting the expense. Please try refreshing the page.");
    }
  };

  const handleRowDoubleClick = async (expense: any) => {
    const billMatch = expense.desc?.match(/\(Invoice #(.*?)\)/);
    if (billMatch) {
      const invoiceNo = String(billMatch[1]).trim();
      const allBills = await fetchData('bills');
      if (allBills) {
        const matchedBill = Object.values(allBills).find((b: any) => b && String(b.invoiceNo).trim() === invoiceNo);
        if (matchedBill && (matchedBill as any).image) {
          setViewingBillImage((matchedBill as any).image);
        } else {
          alert('Could not find the original scanned image for this bill.');
        }
      } else {
        alert('Could not find any bill records.');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Expense Tracker & P&L</h1>
          <p className="text-foreground/70">Monitor operational costs and calculate live Net Profit.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
            className="px-4 py-2 bg-green-500/20 text-green-400 font-bold rounded-lg hover:bg-green-500/30 transition-all border border-green-500/30 flex items-center gap-2"
            title="Download Excel"
          >
            <FileSpreadsheet size={18} />
            Export
          </button>
          
          <button 
            onClick={async () => {
              if (confirm('Are you sure you want to completely clear all expenses? This is for testing only.')) {
                await writeData('expenses', null);
                setExpenses([]);
              }
            }}
            className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all border border-red-500/30 flex items-center gap-2"
          >
            <AlertTriangle size={18} />
            Clear
          </button>
        </div>
      </header>

      {/* P&L Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground/70 font-semibold tracking-wide uppercase text-sm">Taxable Revenue (Ledger)</h3>
            <div className="p-2 bg-accent/10 rounded-lg"><TrendingUp size={20} className="text-accent" /></div>
          </div>
          <div className="text-3xl font-bold text-white">₹{taxableRevenue.toLocaleString()}</div>
        </div>
        
        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground/70 font-semibold tracking-wide uppercase text-sm">Total Expenses</h3>
            <div className="p-2 bg-red-500/10 rounded-lg"><TrendingDown size={20} className="text-red-400" /></div>
          </div>
          <div className="text-3xl font-bold text-red-400">₹{totalExpenses.toLocaleString()}</div>
        </div>

        <div className={`bg-panel rounded-xl border ${netProfit >= 0 ? 'border-green-500/50' : 'border-red-500/50'} p-6 shadow-lg relative overflow-hidden`}>
          <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -z-10 ${netProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}></div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground/70 font-semibold tracking-wide uppercase text-sm">Net Profit</h3>
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <Calculator size={20} className={netProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'text-red-400'}`}>
              ₹{netProfit.toLocaleString()}
            </div>
            <div className="mb-1 text-sm font-semibold text-foreground/50">
              {profitMargin}% margin
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Log Expense Form */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
              <Receipt size={20} className="text-accent" /> Log Expense
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Category</label>
                <select 
                  value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent appearance-none"
                >
                  <option value="">Select Category</option>
                  <option value="Materials">Materials & Supplies</option>
                  <option value="Salary">Salaries & Wages</option>
                  <option value="Utilities">Utilities (Rent, Power)</option>
                  <option value="Maintenance">Maintenance & Repairs</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">₹</span>
                  <input 
                    type="number" 
                    value={amount} onChange={e => setAmount(e.target.value)}
                    className="w-full bg-black/40 border border-panel-border rounded-lg pl-8 pr-4 py-2.5 text-white focus:outline-none focus:border-accent"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Description</label>
                <textarea 
                  value={desc} onChange={e => setDesc(e.target.value)}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent resize-none h-24"
                  placeholder="Details of the expense..."
                />
              </div>
              <button 
                onClick={logExpense}
                className="w-full py-3 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)] mt-2 flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add Expense
              </button>
            </div>
          </div>
          
          <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
            <h2 className="text-lg font-bold mb-4 text-white">Expense Breakdown</h2>
            <div className="h-[250px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0d1826', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-foreground/50">
                  No expenses in this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="xl:col-span-2 bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
          <div className="p-5 border-b border-panel-border/50 bg-black/20 flex items-center justify-between">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <DollarSign size={20} className="text-accent" /> Recent Expenses
            </h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar h-[500px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-foreground/60 uppercase bg-black/40 sticky top-0">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Amount (₹)</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredExpenses].reverse().map((expense) => {
                  const isBill = expense.desc?.includes('(Invoice #');
                  return (
                  <tr 
                    key={expense.id || expense.date + expense.amount} 
                    onDoubleClick={() => handleRowDoubleClick(expense)}
                    className={`border-b border-panel-border/30 hover:bg-white/5 transition-colors ${isBill ? 'cursor-pointer' : ''}`}
                    title={isBill ? "Double click to view original bill" : ""}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-foreground/80">{expense.date}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-white/80">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{expense.desc}</td>
                    <td className="px-6 py-4 text-right font-bold text-red-400">
                      ₹{expense.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense); }}
                        className="p-2 text-foreground/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Expense"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                )})}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-foreground/50">No expenses recorded in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bill Image Viewer Modal */}
      {viewingBillImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-panel border border-panel-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-panel-border/50 flex items-center justify-between bg-black/20">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="text-accent" /> Original Scanned Bill
              </h2>
              <button onClick={() => setViewingBillImage(null)} className="p-2 text-foreground/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-black/40 relative">
              {viewingBillImage.startsWith('data:application/pdf') ? (
                <iframe src={viewingBillImage} className="w-full h-[60vh] rounded-lg border border-panel-border" title="PDF Bill Viewer" />
              ) : (
                <img src={viewingBillImage} alt="Original Bill" className="max-w-full max-h-[70vh] object-contain rounded-lg border border-panel-border shadow-lg" />
              )}
            </div>
            <div className="p-4 border-t border-panel-border/50 bg-black/20 flex justify-end">
              <a 
                href={viewingBillImage}
                download="scanned-bill"
                className="px-5 py-2.5 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all flex items-center gap-2"
              >
                <Download size={18} />
                Download Bill
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
