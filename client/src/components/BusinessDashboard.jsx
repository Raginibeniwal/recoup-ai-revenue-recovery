import React from 'react';
import { ShieldAlert, IndianRupee, Activity, AlertTriangle, ArrowUpRight, Play, CheckCircle2, ShieldCheck, TrendingUp, Sparkles, Bot, Clock } from 'lucide-react';
import ComparisonChart from './ComparisonChart';

export default function BusinessDashboard({
  summary,
  runningAgent,
  onRunAgent,
  onGenerateBatch,
  onOpenCase,
  onViewQueue
}) {
  const formatCurrency = (val) => {
    if (val == null) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  if (!summary || !summary.hasBatch) {
    return (
      <div className="p-12 bg-slate-900 rounded-3xl border border-slate-800 text-center space-y-6 max-w-2xl mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">No active dataset loaded</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Generate synthetic B2B invoices, customer histories, and payment risks to explore Recoup's Intelligent Revenue Recovery engine.
          </p>
        </div>
        <button
          onClick={() => onGenerateBatch(400)}
          className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-teal-500/20 hover:brightness-110 transition-all inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Generate Demo Data
        </button>
      </div>
    );
  }

  const {
    revenueAtRisk,
    recoverableNow,
    agentRecovered,
    overduePaymentsCount,
    recoveryRate,
    financialHealthScore,
    financialHealthLabel,
    riskBreakdown,
    recommendations
  } = summary;

  return (
    <div className="space-y-8 font-sans">
      
      {/* Executive Assistant Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Good evening 👋
            </h1>
            <p className="text-slate-400 text-base mt-1">
              Here's what needs your financial attention today.
            </p>
          </div>

          {/* Core Action: Run Agent */}
          <div className="flex items-center gap-3">
            <button
              onClick={onRunAgent}
              disabled={runningAgent}
              className="px-6 py-3.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 text-slate-950 font-bold text-sm rounded-2xl shadow-xl shadow-teal-500/25 hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {runningAgent ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Analyzing & Recovering...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Analyse & Run Recovery Agent</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Top 5 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <MetricCard
          title="Revenue at Risk"
          value={formatCurrency(revenueAtRisk)}
          subtext="Total unpaid invoices"
          icon={<ShieldAlert className="w-5 h-5 text-rose-400" />}
          accentColor="rose"
        />

        <MetricCard
          title="Recoverable Now"
          value={formatCurrency(recoverableNow)}
          subtext="High recovery probability"
          icon={<IndianRupee className="w-5 h-5 text-teal-400" />}
          accentColor="teal"
        />

        <MetricCard
          title="Overdue Payments"
          value={overduePaymentsCount}
          subtext="Active overdue invoices"
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          accentColor="amber"
        />

        <MetricCard
          title="Recovery Rate"
          value={`${(recoveryRate * 100).toFixed(1)}%`}
          subtext={`Recovered ${formatCurrency(agentRecovered)}`}
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          accentColor="emerald"
        />

        <MetricCard
          title="Financial Health"
          value={`${financialHealthScore} / 100`}
          subtext={financialHealthLabel}
          icon={<ShieldCheck className="w-5 h-5 text-sky-400" />}
          accentColor="sky"
        />

      </div>

      {/* "WHAT'S HAPPENING?" Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-teal-400 font-semibold mb-1">Risk Factor Breakdown</h2>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Why is <span className="text-rose-400 font-mono">{formatCurrency(revenueAtRisk)}</span> at risk?
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <RiskFactorCard
            color="rose"
            icon="🔴"
            title={`${riskBreakdown?.highRiskInvoices || 0} High-risk Invoices`}
            description="Invoices overdue >60 days or with critically low recovery chance."
          />
          <RiskFactorCard
            color="amber"
            icon="🟠"
            title={`${riskBreakdown?.latePayingCustomers || 0} Late-paying Customers`}
            description="Customers with historical pattern of delayed payments."
          />
          <RiskFactorCard
            color="yellow"
            icon="🟡"
            title={`${riskBreakdown?.paymentFailures || 0} Payment Failures`}
            description="Repeated automated reminder attempts without customer response."
          />
          <RiskFactorCard
            color="sky"
            icon="🔵"
            title={`${riskBreakdown?.customerDisputes || 0} Customer Disputes`}
            description="Active billing disputes requiring human finance intervention."
          />
        </div>
      </div>

      {/* "WHAT SHOULD YOU DO?" Action Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-teal-400 font-semibold mb-1">Recoup Priority Engine</h2>
              <h3 className="text-xl font-bold text-white">What should you do next?</h3>
            </div>
            <button
              onClick={onViewQueue}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
            >
              View All In Queue <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">{rec.companyName} ({rec.invoiceNumber})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      rec.urgency === 'High' ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30' : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    }`}>
                      {rec.urgency} Urgency
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white">₹{Number(rec.amount).toLocaleString('en-IN')}</div>
                  <p className="text-xs text-slate-400">Reason: <span className="text-slate-200">{rec.reason}</span></p>
                </div>

                <div className="pt-2 border-t border-slate-850 flex items-center justify-between">
                  <div className="text-[11px] text-teal-400 font-medium">{rec.suggestedAction}</div>
                  <button
                    onClick={() => onOpenCase(rec.invoiceId)}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-500/30 transition-all"
                  >
                    Inspect & Act
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Chart Component */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <ComparisonChart />
      </div>

    </div>
  );
}

function MetricCard({ title, value, subtext, icon, accentColor }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 shadow-lg hover:border-slate-750 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-black text-white tracking-tight">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{subtext}</div>
      </div>
    </div>
  );
}

function RiskFactorCard({ icon, title, description }) {
  return (
    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
      <div className="text-base">{icon}</div>
      <h4 className="font-bold text-white text-sm">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
