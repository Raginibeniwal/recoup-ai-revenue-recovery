import React, { useState } from 'react';
import {
  ShieldAlert, IndianRupee, Activity, AlertTriangle, ArrowUpRight,
  CheckCircle2, ShieldCheck, TrendingUp, Clock, BarChart3,
  Target, PlusCircle, FileSpreadsheet, HelpCircle, Database, Loader2
} from 'lucide-react';
import AddPaymentForm from './AddPaymentForm';
import CSVUploadPanel from './CSVUploadPanel';
import ComparisonChart from './ComparisonChart';
import api from '../services/api';

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-52 bg-stone-800 text-white text-[11px] rounded-lg p-2.5 z-20 shadow-xl text-center">
          {text}
        </div>
      )}
    </span>
  );
}

export default function BusinessDashboard({ summary, dataSource, onPaymentAdded, onOpenCase, onViewQueue, onRefresh }) {
  const [activeView, setActiveView] = useState('data-entry'); // 'data-entry' | 'metrics'
  const [loadingDemo, setLoadingDemo] = useState(false);

  const formatCurrency = (val) => {
    if (val == null) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const hasData = summary && summary.hasData;

  const handleLoadSampleData = async () => {
    setLoadingDemo(true);
    try {
      await api.loadSampleData(15);
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error('Failed to load sample data', e);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">

      {/* Welcome Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
              Revenue Recovery Dashboard
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              {hasData
                ? `Tracking ${summary.totalCases} invoice${summary.totalCases !== 1 ? 's' : ''} · ${formatCurrency(summary.revenueAtRisk)} at risk`
                : 'Add your first payment record to begin recovery analysis.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Data Source Badge (visible when there is data) */}
            {hasData && dataSource && dataSource !== 'empty' && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
                dataSource === 'real'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : dataSource === 'demo'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                <Database className="w-3 h-3" />
                {dataSource === 'real' ? 'Based on your data' : dataSource === 'demo' ? 'Sample dataset' : 'Mixed data'}
              </div>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
              <button
                onClick={() => setActiveView('data-entry')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  activeView === 'data-entry'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <PlusCircle className="w-4 h-4" /> Add Data
              </button>
              <button
                onClick={() => setActiveView('metrics')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  activeView === 'metrics'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Dashboard Metrics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Steps Banner — shown when no data */}
      {!hasData && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-bold text-indigo-800 text-sm mb-3">How Recoup Works — Your Recovery Workflow</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { step: '1', icon: <PlusCircle className="w-4 h-4" />, title: 'Add Payment Data', desc: 'Enter a failed invoice manually or upload a CSV' },
              { step: '2', icon: <Activity className="w-4 h-4" />, title: 'AI Analysis', desc: 'System analyzes failure reason & recovery probability' },
              { step: '3', icon: <BarChart3 className="w-4 h-4" />, title: 'Dashboard Updates', desc: 'Metrics, charts, and priority queue refresh instantly' },
              { step: '4', icon: <Target className="w-4 h-4" />, title: 'Take Action', desc: 'Follow recommended recovery actions per case' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-indigo-100">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">{s.step}</div>
                <div>
                  <div className="text-indigo-800 mb-0.5 flex items-center gap-1">{s.icon}<span className="font-bold text-xs">{s.title}</span></div>
                  <p className="text-[11px] text-indigo-600">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DATA ENTRY VIEW */}
      {activeView === 'data-entry' && (
        <div className="space-y-4">
          <AddPaymentForm onPaymentAdded={onPaymentAdded} />
          <CSVUploadPanel onImportComplete={onPaymentAdded} />
        </div>
      )}

      {/* METRICS VIEW */}
      {activeView === 'metrics' && (
        <>
          {!hasData ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-stone-400" />
              </div>
              <div>
                <h3 className="font-bold text-stone-700 text-lg">Your financial dashboard is waiting for data</h3>
                <p className="text-stone-400 text-sm mt-1">
                  Add your first financial record or upload a CSV to begin.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setActiveView('data-entry')}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" /> Add Manually
                </button>
                <button
                  onClick={() => { setActiveView('data-entry'); }}
                  className="px-6 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Upload CSV
                </button>
              </div>
              <p className="text-xs text-stone-400">
                Need to explore first?{' '}
                <button
                  onClick={handleLoadSampleData}
                  disabled={loadingDemo}
                  className="text-stone-500 underline hover:no-underline hover:text-stone-700 transition-colors disabled:opacity-50"
                >
                  {loadingDemo ? 'Loading…' : 'Load sample data'}
                </button>
                {' '}— clearly labeled as sample data.
              </p>
            </div>
          ) : (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard
                  title="Revenue at Risk"
                  tooltip="Total value of all unpaid or failed invoices — money you haven't collected yet."
                  value={formatCurrency(summary.revenueAtRisk)}
                  subtext="Unpaid invoices"
                  icon={<ShieldAlert className="w-4 h-4 text-red-500" />}
                  valueColor="text-red-700"
                />
                <MetricCard
                  title="Recoverable Revenue"
                  tooltip="Expected Recoverable Revenue (ERR): sum of (invoice amount × recovery probability) for each case."
                  value={formatCurrency(summary.recoverableRevenue || summary.recoverableNow)}
                  subtext="Based on AI probability"
                  icon={<IndianRupee className="w-4 h-4 text-indigo-600" />}
                  valueColor="text-indigo-700"
                />
                <MetricCard
                  title="Recovered Revenue"
                  tooltip="Amount actually recovered (invoices marked as paid/recovered). Starts at ₹0 until payments are confirmed."
                  value={formatCurrency(summary.recoveredRevenue || summary.agentRecovered || 0)}
                  subtext="Confirmed payments"
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  valueColor="text-emerald-700"
                />
                <MetricCard
                  title="Recovery Rate"
                  tooltip="Recovery Rate = Recovered Amount ÷ Total At-Risk Amount. Shows how much of at-risk revenue has been collected."
                  value={`${((summary.recoveryRate || 0) * 100).toFixed(1)}%`}
                  subtext={summary.recoveryRate > 0 ? 'Improving' : 'No recoveries yet'}
                  icon={<TrendingUp className="w-4 h-4 text-teal-600" />}
                  valueColor="text-teal-700"
                />
                <MetricCard
                  title="Failed Invoices"
                  tooltip="Number of invoices that have not been paid (active/overdue/failed status)."
                  value={summary.failedCount || summary.overduePaymentsCount || 0}
                  subtext="Need attention"
                  icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                  valueColor="text-amber-700"
                />
                <MetricCard
                  title="High Priority"
                  tooltip="Cases flagged HIGH priority — large invoice amount, high recovery chance, or reliable customer."
                  value={summary.highPriorityCases || 0}
                  subtext="Priority cases"
                  icon={<Target className="w-4 h-4 text-rose-600" />}
                  valueColor="text-rose-700"
                />
              </div>

              {/* Financial Health Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 shadow-sm">
                  <div>
                    <h3 className="font-bold text-stone-800 text-sm">Financial Health Indicators</h3>
                    <p className="text-xs text-stone-400">Based on your actual payment data</p>
                  </div>
                  <div className="space-y-2">
                    <HealthRow label="Financial Health Score" value={summary.financialHealthScore} badge={summary.financialHealthLabel} />
                    <HealthRow label="Avg Days Overdue" value={summary.avgDaysOverdue || 0} unit=" days" isNumber />
                    <HealthRow label="Customer Disputes" value={summary.riskBreakdown?.customerDisputes || 0} isNumber />
                    <HealthRow label="High-Risk Cases" value={summary.riskBreakdown?.highRiskInvoices || 0} isNumber />
                  </div>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-stone-800 text-sm">Top Priority Cases</h3>
                      <p className="text-xs text-stone-400">Highest expected recovery value first</p>
                    </div>
                    <button
                      onClick={onViewQueue}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      View All <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {summary.recommendations && summary.recommendations.length > 0 ? (
                    <div className="space-y-2.5">
                      {summary.recommendations.slice(0, 3).map((rec, idx) => (
                        <div
                          key={idx}
                          onClick={() => onOpenCase(rec.invoiceId)}
                          className="flex items-center justify-between p-3 rounded-xl border border-stone-100 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-semibold text-stone-800 text-xs truncate group-hover:text-indigo-700">{rec.companyName}</div>
                            <div className="text-[11px] text-stone-400 font-mono">{rec.invoiceNumber}</div>
                            {rec.failureReason && (
                              <div className="text-[11px] text-amber-600">{rec.failureReason}</div>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className="font-bold text-stone-800 text-sm">{formatCurrency(rec.amount)}</div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              rec.urgency === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>{rec.urgency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 text-center py-4">No active cases yet</p>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <ComparisonChart />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ title, tooltip, value, subtext, icon, valueColor = 'text-stone-800' }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm relative group hover:border-stone-300 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-stone-500 leading-tight">{title}</span>
          {tooltip && (
            <span
              className="cursor-help"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
            >
              <HelpCircle className="w-3 h-3 text-stone-300 group-hover:text-stone-400" />
              {showTip && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-1 w-52 bg-stone-800 text-white text-[10px] rounded-lg p-2 z-20 shadow-xl">
                  {tooltip}
                </div>
              )}
            </span>
          )}
        </div>
        {icon}
      </div>
      <div className={`text-xl font-black ${valueColor} tracking-tight`}>{value}</div>
      <div className="text-[11px] text-stone-400 mt-0.5">{subtext}</div>
    </div>
  );
}

function HealthRow({ label, value, badge, unit = '', isNumber = false }) {
  const badgeColor = badge === 'Healthy' ? 'bg-emerald-100 text-emerald-700' : badge === 'Needs Attention' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-xs text-stone-500">{label}</span>
      <div className="flex items-center gap-2">
        {isNumber ? (
          <span className="text-sm font-bold text-stone-800">{value}{unit}</span>
        ) : (
          <span className="text-sm font-bold text-stone-800">{value}{unit}</span>
        )}
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>{badge}</span>
        )}
      </div>
    </div>
  );
}
