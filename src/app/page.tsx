import { DashboardCharts } from "@/components/DashboardCharts";
import { ExcelUploader } from "@/components/ExcelUploader";

export default function Home() {
  const topDoctors = [
    { name: "Dr. Sharma", cases: 45, revenue: "₹45,000" },
    { name: "Dr. Gupta", cases: 38, revenue: "₹38,000" },
    { name: "Dr. Verma", cases: 32, revenue: "₹32,500" },
    { name: "Dr. Singh", cases: 28, revenue: "₹28,000" },
    { name: "Dr. Patel", cases: 25, revenue: "₹25,000" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard & Billing</h1>
        <p className="text-foreground/70">Overview of lab performance and invoice generation.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardCharts />
        </div>
        <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-white">Top Doctors</h2>
          <div className="space-y-4">
            {topDoctors.map((doc, idx) => (
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

      <ExcelUploader />
    </div>
  );
}
