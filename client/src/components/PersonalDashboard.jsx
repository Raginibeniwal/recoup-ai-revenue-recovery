import React from 'react';
import { Wallet, ShieldCheck, AlertTriangle, Calendar, CheckCircle2, Clock, Info, ArrowUpRight, Lock } from 'lucide-react';

export default function PersonalDashboard({ data }) {
  if (!data) return null;

  const {
    upcomingPayments,
    overdueAmount,
    overdueCount,
    failedPaymentsCount,
    paymentHealthScore,
    healthLabel,
    alerts,
    suggestions,
    disclaimer
  } = data;

  return (
    <div className="space-y-8 font-sans">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Your financial health at a glance 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor upcoming payments, auto-debits, and personal credit profile guidance.
        </p>
      </div>

      {/* Top 4 Personal Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Upcoming Dues</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{upcomingPayments.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400">{upcomingPayments.length} upcoming bills</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overdue Amount</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            ₹{overdueAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-400">{overdueCount} overdue item</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Failed Payments</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {failedPaymentsCount}
          </div>
          <div className="text-xs text-slate-400">Recent auto-debit issues</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Payment Health</span>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400">
            {paymentHealthScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <div className="text-xs text-sky-300 font-semibold">{healthLabel} Standing</div>
        </div>

      </div>

      {/* Auto-Debit Failure Warning Banner */}
      {alerts && alerts.map((alt) => (
        <div key={alt.id} className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-4 text-amber-200">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-base text-amber-100">{alt.title}</h3>
            <p className="text-sm text-amber-200/80 leading-relaxed">{alt.message}</p>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upcoming Bills List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <h3 className="text-lg font-bold text-white flex items-center justify-between">
            <span>Upcoming Bills & Recurring Payments</span>
            <span className="text-xs text-slate-400 font-normal">Next 7 Days</span>
          </h3>

          <div className="space-y-3">
            {upcomingPayments.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-teal-400 text-sm">
                    {p.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{p.name}</h4>
                    <p className="text-xs text-slate-400">{p.provider} • Due {p.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white text-base">₹{p.amount.toLocaleString('en-IN')}</div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    Auto-Debit Scheduled
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credit Health Guidance & Suggestions */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            Credit Health Guidance
          </h3>

          <div className="space-y-3 text-xs text-slate-300">
            {suggestions.map((sug, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{sug}</span>
              </div>
            ))}
          </div>

          {/* Mandatory Credit Bureau Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Important Disclaimer
            </div>
            <p className="leading-relaxed">
              {disclaimer} Recoup provides educational health insights and does not issue or alter official lender credit scores.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
