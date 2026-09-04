"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardChartsProps {
  data?: Record<string, any[]> | null;
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Helper to extract date safely from any row
  const extractDate = (row: any): Date | null => {
    const dateKey = Object.keys(row).find(k => k.toLowerCase().includes('date'));
    if (!dateKey || !row[dateKey]) return null;
    const d = new Date(row[dateKey]);
    return isNaN(d.getTime()) ? null : d;
  };

  // Compute all available doctors and a chronological list of months
  const { doctors, months } = useMemo(() => {
    if (!data) return { doctors: [], months: [] };
    const docs = Object.keys(data);
    
    let minDate: Date | null = null;
    let maxDate = new Date(); // Up to current date

    docs.forEach(doc => {
      data[doc].forEach(row => {
        const d = extractDate(row);
        if (d) {
          if (!minDate || d < minDate) minDate = new Date(d);
          if (d > maxDate) maxDate = new Date(d);
        }
      });
    });

    // Start from January of the earliest year found, or current year if no data
    if (!minDate) {
      minDate = new Date(new Date().getFullYear(), 0, 1);
    } else {
      minDate = new Date((minDate as Date).getFullYear(), 0, 1);
    }

    const allMonths: string[] = [];
    let curr = new Date(minDate);
    // Generate up to maxDate month
    while (curr.getFullYear() < maxDate.getFullYear() || (curr.getFullYear() === maxDate.getFullYear() && curr.getMonth() <= maxDate.getMonth())) {
      allMonths.push(curr.toLocaleString('default', { month: 'short', year: 'numeric' }));
      curr.setMonth(curr.getMonth() + 1);
    }

    return { doctors: docs, months: allMonths };
  }, [data]);

  useEffect(() => {
    if (!data) return;

    let newChartData: any[] = [];
    
    // 1. Doctor selected, NO month selected -> Show month-wise revenue for this doctor
    if (selectedDoc && !selectedMonth) {
      const docData = data[selectedDoc] || [];
      const monthMap: Record<string, number> = {};
      
      docData.forEach(row => {
        const d = extractDate(row);
        if (d) {
          const mStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
          monthMap[mStr] = (monthMap[mStr] || 0) + (Number(row.Total) || 0);
        }
      });

      newChartData = months.map(m => ({
        name: m,
        revenue: monthMap[m] || 0
      }));
      setChartType('line');
    }
    // 2. Month selected, NO doctor selected -> Show doctor-wise revenue for this month
    else if (!selectedDoc && selectedMonth) {
      const docMap: Record<string, number> = {};
      
      Object.keys(data).forEach(doc => {
        const docRows = data[doc] || [];
        docRows.forEach(row => {
          const d = extractDate(row);
          if (d) {
            const mStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (mStr === selectedMonth) {
              docMap[doc] = (docMap[doc] || 0) + (Number(row.Total) || 0);
            }
          }
        });
      });

      newChartData = Object.keys(docMap).map(d => ({
        name: d,
        revenue: docMap[d]
      }));
      setChartType('bar');
    }
    // 3. Both selected -> Show daily revenue for this doctor in this month
    else if (selectedDoc && selectedMonth) {
      const docData = data[selectedDoc] || [];
      const dayMap: Record<string, number> = {};
      
      docData.forEach(row => {
        const d = extractDate(row);
        if (d) {
          const mStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
          if (mStr === selectedMonth) {
            const dayStr = d.getDate().toString();
            dayMap[dayStr] = (dayMap[dayStr] || 0) + (Number(row.Total) || 0);
          }
        }
      });

      const [monthName, yearStr] = selectedMonth.split(' ');
      const yearNum = parseInt(yearStr);
      // Create a date object for the 1st of the selected month
      // using a safe format so we can determine how many days are in it
      const monthIdx = new Date(Date.parse(monthName + " 1, " + yearNum)).getMonth();
      const daysInMonth = new Date(yearNum, monthIdx + 1, 0).getDate();

      newChartData = Array.from({ length: daysInMonth }, (_, i) => {
        const dayStr = (i + 1).toString();
        return {
          name: `${dayStr} ${monthName}`,
          revenue: dayMap[dayStr] || 0
        };
      });
      setChartType('line');
    }
    // 4. Neither selected -> Show overall revenue month-wise for all doctors
    else {
      const monthMap: Record<string, number> = {};
      Object.keys(data).forEach(doc => {
        data[doc].forEach(row => {
          const d = extractDate(row);
          if (d) {
            const mStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            monthMap[mStr] = (monthMap[mStr] || 0) + (Number(row.Total) || 0);
          }
        });
      });
      newChartData = months.map(m => ({
        name: m,
        revenue: monthMap[m] || 0
      }));
      setChartType('line');
    }

    setChartData(newChartData);
  }, [data, selectedDoc, selectedMonth, months]);

  // Default empty state
  if (!data) {
    return (
      <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg h-[400px] flex items-center justify-center text-foreground/50">
        No analytics data available.
      </div>
    );
  }

  return (
    <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg h-[450px] flex flex-col w-full min-w-0">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-white">Revenue Analytics</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            className="bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent flex-1 md:flex-none max-w-full"
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
          >
            <option value="">All Doctors</option>
            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          
          <select 
            className="bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent flex-1 md:flex-none max-w-full"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 relative w-full overflow-hidden">
        {chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-foreground/50 text-sm">
            No data available for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0d1826', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                  itemStyle={{ color: '#00a8e8' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#00a8e8" 
                  strokeWidth={3}
                  activeDot={{ r: 8, fill: '#00c2ff', stroke: '#0d1826', strokeWidth: 2 }}
                  style={{ filter: 'drop-shadow(0px 0px 8px rgba(0,194,255,0.5))' }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0d1826', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                  itemStyle={{ color: '#4ade80' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#4ade80" 
                  radius={[4, 4, 0, 0]}
                  style={{ filter: 'drop-shadow(0px 0px 8px rgba(74,222,128,0.5))' }}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
