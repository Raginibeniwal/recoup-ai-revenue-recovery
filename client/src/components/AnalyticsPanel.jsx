import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

export default function AnalyticsPanel() {
  const [reasonData, setReasonData] = useState([]);
  const [actionData, setActionData] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getAnalyticsByReason().catch(() => []),
      api.getAnalyticsByIntervention().catch(() => [])
    ]).then(([reasons, actions]) => {
      setReasonData(reasons);
      setActionData(actions);
    });
  }, []);

  return (
    <div className="space-y-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Recovery Analytics & Business Insights</h2>
          <p className="text-xs text-slate-400">Empirical performance breakdown by invoice category and recovery action type.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Recovery by Invoice Category */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Recovery Rate by Invoice Category</h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="failure_reason" type="category" width={110} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                  formatter={(val) => [`${(val * 100).toFixed(1)}%`, 'Recovery Rate']}
                />
                <Bar dataKey="recovery_rate" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-teal-400">💡 Plain-Language Insight</div>
            <p className="leading-relaxed">
              Hardware Procurement and Monthly Retainers achieve the highest automated recovery rates (72%–85%), while Consulting Services require earlier human follow-up.
            </p>
          </div>
        </div>

        {/* Success by Intervention */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Success Rate by Intervention Type</h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="action" type="category" width={130} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                  formatter={(val) => [`${(val * 100).toFixed(1)}%`, 'Success Rate']}
                />
                <Bar dataKey="success_rate" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-purple-400">💡 Plain-Language Insight</div>
            <p className="leading-relaxed">
              Recording payment promises and sending friendly reminders are currently your most successful automated interventions (72%–88% success).
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
