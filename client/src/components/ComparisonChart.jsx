import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ComparisonChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/dashboard/comparison')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data || !data.hasBatch) return null;

  const chartData = [
    {
      name: 'Recovered Revenue',
      Baseline: data.baselineRecovered,
      'AI Agent': data.agentRecovered,
      TotalAtRisk: data.totalAtRisk
    }
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">AI Agent vs. Baseline Strategy (Revenue)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)} />
          <Legend />
          <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="AI Agent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
