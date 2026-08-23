"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 5000 },
  { name: 'Thu', revenue: 2780 },
  { name: 'Fri', revenue: 6890 },
  { name: 'Sat', revenue: 2390 },
  { name: 'Sun', revenue: 3490 },
];

export function DashboardCharts() {
  return (
    <div className="bg-panel rounded-xl border border-panel-border p-6 shadow-lg h-[400px] flex flex-col">
      <h2 className="text-xl font-bold mb-6 text-white">Live Revenue Analytics</h2>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0d1826', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
              itemStyle={{ color: '#00a8e8' }}
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
        </ResponsiveContainer>
      </div>
    </div>
  );
}
