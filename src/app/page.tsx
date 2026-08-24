"use client";

import { useState, useMemo } from "react";
import { DashboardCharts } from "@/components/DashboardCharts";
import { ExcelUploader } from "@/components/ExcelUploader";

export default function Home() {
  const [dashboardData, setDashboardData] = useState<Record<string, any[]> | null>(null);

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
    { name: "Upload Excel to see data", cases: 0, revenue: "₹0" }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard & Billing</h1>
        <p className="text-foreground/70">Overview of lab performance and invoice generation.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
