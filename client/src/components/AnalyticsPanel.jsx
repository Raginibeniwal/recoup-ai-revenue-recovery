import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import api from '../services/api';

const PIE_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

export default function AnalyticsPanel() {
  const [reasonData, setReasonData] = useState([]);
  const [actionData, setActionData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reasons, actionsRes, sum] = await Promise.all([
        api.getAnalyticsByReason().catch(() => []),
        api.getAnalyticsByIntervention().catch(() => ({ data: [], isIllustrative: true })),
        api.getAnalyticsSummary().catch(() => null)
      ]);
      setReasonData(reasons);
      // Handle both old (array) and new ({ data, isIllustrative }) formats
      if (Array.isArray(actionsRes)) {
        setActionData({ data: actionsRes, isIllustrative: true });
      } else {
        setActionData(actionsRes);
      }
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  };

  const hasEnoughData = reasonData.length >= 1 && summary && summary.totalInvoices >= 1;

  const formatCurrency = (val) => {
    if (val == null) return '₹0';
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  // Build status breakdown for pie chart
  const statusData = summary?.statusBreakdown
    ? Object.entries(summary.statusBreakdown).map(([k, v]) => ({ name: k, value: v }))
    : [];

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">Recovery Analytics</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          Performance breakdown based on your actual payment records.
          {summary && ` Showing data for ${summary.totalInvoices} invoice${summary.totalInvoices !== 1 ? 's' : ''}.`}
        </p>
      </div>

      {loading && (
        <div className="p-10 text-center text-stone-400 text-sm">Loading analytics...</div>
      )}

      {!loading && !hasEnoughData && (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center space-y-3 shadow-sm">
          <div className="text-3xl">📊</div>
          <h3 className="font-bold text-stone-700">Not enough data yet</h3>
          <p className="text-stone-400 text-sm max-w-md mx-auto">
            Analytics charts will appear once you have added payment records.
            Go to the Overview tab and add payments to see recovery performance data here.
          </p>
        </div>
      )}

      {!loading && hasEnoughData && (
        <>
          {/* Summary Metrics */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Invoices', value: summary.totalInvoices },
                { label: 'Total Invoice Value', value: formatCurrency(summary.totalAmount) },
                { label: 'Revenue at Risk', value: formatCurrency(summary.totalAtRisk), color: 'text-red-600' },
                { label: 'Recovered', value: formatCurrency(summary.totalRecovered), color: 'text-emerald-600' },
              ].map(m => (
                <div key={m.label} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs text-stone-500 mb-1">{m.label}</div>
                  <div className={`text-xl font-black ${m.color || 'text-stone-800'}`}>{m.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Recovery Rate by Failure Reason */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-stone-700">Recovery Rate by Failure Reason</h3>
                <p className="text-xs text-stone-400">Based on your actual invoices</p>
              </div>
              {reasonData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-stone-400 text-sm">Not enough data yet</div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reasonData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#e7e5e4" />
                      <XAxis
                        type="number"
                        stroke="#a8a29e"
                        tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                        domain={[0, 1]}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="failure_reason"
                        type="category"
                        width={130}
                        stroke="#a8a29e"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e7e5e4', borderRadius: '12px', color: '#1c1917' }}
                        formatter={(val, name, props) => [
                          `${(val * 100).toFixed(1)}% recovery rate (${props.payload.count} invoice${props.payload.count !== 1 ? 's' : ''})`,
                          'Recovery Rate'
                        ]}
                      />
                      <Bar dataKey="recovery_rate" fill="#6366f1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                <strong>How to read this:</strong> Higher % = more invoices with this failure reason have been recovered.
                A low rate means these cases need more attention or manual intervention.
              </div>
            </div>

            {/* Payment Status Distribution — Pie */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-stone-700">Payment Status Distribution</h3>
                <p className="text-xs text-stone-400">Breakdown of all your invoice statuses</p>
              </div>
              {statusData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-stone-400 text-sm">Not enough data yet</div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e7e5e4', borderRadius: '12px' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
                <strong>Active</strong> = unpaid/pending · <strong>Recovered</strong> = payment confirmed · <strong>Overdue</strong> = past due date
              </div>
            </div>

            {/* Success Rate by Intervention */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-2">
              <div>
                <h3 className="text-sm font-bold text-stone-700">Recovery Action Effectiveness</h3>
                <p className="text-xs text-stone-400">Success rates by recovery action type</p>
              </div>

              {/* Honesty label when using illustrative data */}
              {actionData?.isIllustrative && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Illustrative benchmarks</span> — these are industry-average rates, not derived from your actual recovery outcomes.
                    Real success rates will appear once you have 5+ recovered invoices.
                    {actionData.recoveredCount > 0 && ` (${actionData.recoveredCount} recovered so far)`}
                  </div>
                </div>
              )}

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionData?.data || actionData || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#e7e5e4" />
                    <XAxis
                      type="number"
                      stroke="#a8a29e"
                      tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="action"
                      type="category"
                      width={170}
                      stroke="#a8a29e"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderColor: '#e7e5e4', borderRadius: '12px' }}
                      formatter={(val) => [`${(val * 100).toFixed(1)}% ${actionData?.isIllustrative ? '(illustrative)' : 'success rate'}`, 'Success Rate']}
                    />
                    <Bar dataKey="success_rate" fill="#14b8a6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!actionData?.isIllustrative && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-700">
                  💡 <strong>Tip:</strong> Recording a payment promise and sending friendly reminders are historically the most effective first-contact recovery actions.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
