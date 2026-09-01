import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPanel() {
  const [reasonData, setReasonData] = useState([]);
  const [actionData, setActionData] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/analytics/by-failure-reason')
      .then(res => res.json())
      .then(setReasonData)
      .catch(console.error);
      
    fetch('http://localhost:3001/api/analytics/by-intervention')
      .then(res => res.json())
      .then(setActionData)
      .catch(console.error);
  }, []);

  if (!reasonData.length) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Recovery by Reason</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reasonData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} domain={[0, 1]} />
              <YAxis dataKey="failure_reason" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => `${(val * 100).toFixed(1)}%`} />
              <Bar dataKey="recovery_rate" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Success by Intervention</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={actionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} domain={[0, 1]} />
              <YAxis dataKey="action" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => `${(val * 100).toFixed(1)}%`} />
              <Bar dataKey="success_rate" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
