import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, Info, TrendingUp, Lock } from 'lucide-react';
import api from '../services/api';

export default function FinancialHealthPanel({ mode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, [mode]);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await api.getFinancialHealth(mode);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading Financial Health analysis...</div>;
  }

  const { score, label, breakdown, suggestions, disclaimer } = data;

  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';
  const badgeColor = score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : score >= 60 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

  return (
    <div className="space-y-8 font-sans">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-800/60 text-sky-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Recoup Health Model
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {mode === 'business' ? 'Business Financial Health' : 'Personal Payment Health'}
          </h1>
          <p className="text-slate-400 text-sm max-w-lg">
            Real-time indicator measuring payment reliability, overdue exposure, cash-flow stability, and dispute friction.
          </p>
        </div>

        {/* Score Gauge Widget */}
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[200px] shadow-2xl">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Recoup Health Rating</div>
          <div className={`text-5xl font-black ${scoreColor}`}>{score} <span className="text-base text-slate-500 font-normal">/ 100</span></div>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
            {label} Standing
          </span>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h3 className="text-lg font-bold text-white">Factor Score Breakdown</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="p-5 rounded-2xl bg-slate-950 border border-slate-850 space-y-3">
              <div className="text-xs font-semibold text-slate-400 capitalize">
                {key.replace(/([A-Z])/g, ' $1')}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{val}</span>
                <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-400 h-full" style={{ width: `${val}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          How to Improve Your Score
        </h3>

        <div className="space-y-3">
          {suggestions.map((sug, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-850 flex items-start gap-3 text-xs text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{sug}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mandatory Credit Bureau Disclaimer */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 space-y-1 max-w-3xl mx-auto shadow-lg">
        <div className="font-semibold text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" /> Educational Guidance Disclaimer
        </div>
        <p className="leading-relaxed">
          {disclaimer} Official credit scores are issued strictly by authorized credit bureaus and financial institutions. Recoup provides analytical guidance to optimize cash flow and payment reliability.
        </p>
      </div>

    </div>
  );
}
