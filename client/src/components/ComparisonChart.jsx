import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

export default function ComparisonChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getComparison()
      .then(setData)
      .catch((err) => console.error('Comparison load error:', err));
  }, []);

  if (!data || !data.hasBatch) return null;

  const chartData = [
    {
      name: 'Revenue Performance',
      Baseline: data.baselineRecovered || 0,
      'Recoup Agent': data.agentRecovered || 0
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white">AI Agent vs Baseline Performance</h3>
        <p className="text-xs text-slate-400">Comparing adaptive AI recovery lift against generic 2-touch baseline strategy.</p>
      </div>

      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#94a3b8"
              tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
              formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
            <Bar dataKey="Baseline" fill="#64748b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Recoup Agent" fill="#14b8a6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
