"use client";

import { useState, useMemo, useEffect } from "react";
import { DashboardCharts } from "@/components/DashboardCharts";
import { ExcelUploader } from "@/components/ExcelUploader";
import { writeData } from '@/lib/firebase';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { TrendingUp, AlertTriangle, AlertCircle, Banknote } from "lucide-react";
import { useStore } from '@/store/useStore';

export default function Home() {
  const [dashboardData, setDashboardData] = useState<Record<string, any[]> | null>(null);
  const [kpis, setKpis] = useState({
    totalOutstanding: 0,
    thisMonthRevenue: 0,
    lastMonthRevenue: 0,
    lowStockCount: 0,
    overdueCount: 0,
  });

  const { doctors, ledger, catalog, settings, expenses, isInitialized, initializeStore, refreshExpenses } = useStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeStore();
    }
  }, [isInitialized, initializeStore]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      let outstanding = 0;
      let overdue = 0;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      Object.keys(doctors).forEach(docId => {
        const bal = Number(doctors[docId]?.balance) || 0;
        if (bal > 0) {
          outstanding += bal;
          const txs = ledger[docId] || [];
          const hasRecentPayment = txs.some((tx: any) => {
            if (tx.type === 'Payment') {
              const txDate = new Date(tx.date);
              return txDate >= thirtyDaysAgo;
            }
            return false;
          });
          if (!hasRecentPayment) overdue++;
        }
      });

      let revThisMonth = 0;
      let revLastMonth = 0;
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      Object.keys(ledger).forEach(docId => {
        (ledger[docId] || []).forEach((tx: any) => {
          if (tx.type === 'Charge' || tx.type === 'Invoice' || tx.type === 'Invoice Generated' || tx.type === 'Bill') {
            const txDate = new Date(tx.date);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
              revThisMonth += Number(tx.amount) || 0;
            } else if (txDate.getMonth() === lastMonth && txDate.getFullYear() === lastMonthYear) {
              revLastMonth += Number(tx.amount) || 0;
            }
          }
        });
      });

      let lowStock = 0;
      Object.keys(catalog).forEach(itemId => {
        const item = catalog[itemId];
        if ((Number(item.qty) || 0) <= (Number(item.min_limit) || 5)) {
          lowStock++;
        }
      });

      setKpis({
        totalOutstanding: outstanding,
        thisMonthRevenue: revThisMonth,
        lastMonthRevenue: revLastMonth,
        lowStockCount: lowStock,
        overdueCount: overdue
      });

      // Lazy evaluation of recurring expenses
      const recurring = settings?.recurring_expenses;
      if (recurring) {
        const expensesArray = Array.isArray(expenses) ? expenses : Object.values(expenses);
        let expensesChanged = false;

        Object.values(recurring).forEach((rec: any) => {
          const dayOfMonth = Number(rec.dayOfMonth) || 1;
          if (now.getDate() >= dayOfMonth) {
            const currentMonthPrefix = now.toISOString().substring(0, 7); // YYYY-MM
            
            // Check if already logged this month
            const alreadyLogged = expensesArray.some(exp => 
              exp.desc === `[Auto] ${rec.desc}` && exp.date.startsWith(currentMonthPrefix)
            );

            if (!alreadyLogged) {
              const safeId = `auto_${currentMonthPrefix}_${generateId().substring(0, 5)}_${dayOfMonth}`; 
              // To make it truly deterministic and prevent race conditions across tabs:
              const deterministicId = `auto_${currentMonthPrefix}_${rec.category.replace(/[^a-zA-Z0-9]/g, '')}_${dayOfMonth}`;
              
              const newExp = {
                id: deterministicId,
                date: `${currentMonthPrefix}-${String(dayOfMonth).padStart(2, '0')}`,
                category: rec.category,
                amount: Number(rec.amount) || 0,
                desc: `[Auto] ${rec.desc}`
              };
              writeData(`expenses/${deterministicId}`, newExp);
              expensesChanged = true;
            }
          }
        });

        if (expensesChanged) {
          console.log("Logged automated recurring expenses");
          refreshExpenses();
        }
      }

    } catch (err) {
      console.error("Failed to calculate KPIs or process recurring expenses", err);
    }
  }, [isInitialized, doctors, ledger, catalog, settings, expenses, refreshExpenses]);

  const topDoctors = useMemo(() => {
    if (!dashboardData) return [];
    
    const docs = Object.keys(dashboardData).map(docName => {
      const cases = dashboardData[docName].length;
      const revenue = dashboardData[docName].reduce((sum, row) => sum + (Number(row.Total) || 0), 0);
      return { name: docName, cases, revenue, rawRevenue: revenue };
    });

    // Sort by revenue descending, take top 5
    return docs.sort((a, b) => b.rawRevenue - a.rawRevenue).slice(0, 5).map(doc => ({
      ...doc,
      revenue: `₹${doc.revenue.toLocaleString()}`
    }));
  }, [dashboardData]);

  // Fallback UI if no data is present yet
  const displayDoctors = topDoctors.length > 0 ? topDoctors : [
    { name: "No doctor data available", cases: 0, revenue: "₹0" }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard & Billing</h1>
        <p className="text-foreground/70">Overview of lab performance and invoice generation.</p>
      </header>

      {/* KPI Widgets */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-5 shadow-lg flex flex-col justify-center">
          <div className="flex items-center justify-between mb-1 sm:mb-3">
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm leading-tight break-words">Outstanding</h3>
            <Banknote size={16} className="text-red-400 hidden sm:block sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="text-sm sm:text-2xl font-bold text-red-400">₹{kpis.totalOutstanding.toLocaleString()}</div>
        </div>

        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-5 shadow-lg flex flex-col justify-center">
          <div className="flex items-center justify-between mb-1 sm:mb-3">
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm leading-tight break-words">Revenue</h3>
            <TrendingUp size={16} className="text-green-400 hidden sm:block sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="text-sm sm:text-2xl font-bold text-green-400">₹{kpis.thisMonthRevenue.toLocaleString()}</div>
          <div className="text-[8px] sm:text-xs text-foreground/50 mt-0.5 sm:mt-1 truncate">
            {kpis.lastMonthRevenue > 0 ? (
              <span className={kpis.thisMonthRevenue >= kpis.lastMonthRevenue ? 'text-green-400' : 'text-red-400'}>
                {(((kpis.thisMonthRevenue - kpis.lastMonthRevenue) / kpis.lastMonthRevenue) * 100).toFixed(0)}%
                <span className="hidden sm:inline"> vs last month</span>
              </span>
            ) : "N/A"}
          </div>
        </div>

        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-5 shadow-lg flex flex-col justify-center">
          <div className="flex items-center justify-between mb-1 sm:mb-3">
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm leading-tight break-words">Low Stock</h3>
            <AlertTriangle size={16} className="text-orange-400 hidden sm:block sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="text-sm sm:text-2xl font-bold text-orange-400">{kpis.lowStockCount}</div>
        </div>

        <div className="bg-panel rounded-xl border border-panel-border p-2 sm:p-5 shadow-lg flex flex-col justify-center">
          <div className="flex items-center justify-between mb-1 sm:mb-3">
            <h3 className="text-foreground/70 font-semibold text-[9px] sm:text-sm leading-tight break-words">Overdue</h3>
            <AlertCircle size={16} className="text-purple-400 hidden sm:block sm:w-[18px] sm:h-[18px] shrink-0" />
          </div>
          <div className="text-sm sm:text-2xl font-bold text-purple-400">{kpis.overdueCount} <span className="hidden sm:inline text-sm font-normal text-foreground/50">docs</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="lg:col-span-2 min-w-0 w-full">
          <DashboardCharts data={dashboardData} />
        </div>
        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-white">Top Doctors</h2>
          <div className="space-y-4">
            {displayDoctors.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-panel-border/50 hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{doc.name}</p>
                    <p className="text-xs text-foreground/60">{doc.cases} Cases this month</p>
                  </div>
                </div>
                <div className="font-bold text-accent-glow">{doc.revenue}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExcelUploader onDataProcessed={setDashboardData} />
    </div>
  );
}
