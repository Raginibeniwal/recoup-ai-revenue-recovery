import React, { useEffect, useState } from 'react';
import { IndianRupee, ShieldCheck, ShieldAlert, Activity, TrendingUp } from 'lucide-react';

export default function DashboardHeader() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/dashboard/summary')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data || !data.hasBatch) {
    return <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">No active batch. Generate one to start.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card title="Revenue at Risk" value={formatCurrency(data.revenueAtRisk)} icon={<ShieldAlert className="text-red-500" />} />
      <Card title="Agent Recovered" value={formatCurrency(data.agentRecovered)} icon={<IndianRupee className="text-green-500" />} />
      <Card title="Agent Recovery Rate" value={`${(data.recoveryRate * 100).toFixed(1)}%`} icon={<Activity className="text-blue-500" />} />
      <Card title="Cases Recovered" value={`${data.agentRecoveredCount} / ${data.totalCases}`} icon={<ShieldCheck className="text-green-500" />} />
      <Card title="Agent ROI (vs Cost)" value={`${(data.recoveryROI * 100).toFixed(0)}%`} icon={<TrendingUp className="text-purple-500" />} />
    </div>
  );
}

function Card({ title, value, icon }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
