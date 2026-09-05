import React, { useState } from 'react';
import { Search, Filter, ShieldCheck, AlertTriangle, Bot, UserCheck, CheckCircle2, XCircle, ArrowUpDown } from 'lucide-react';

export default function RecoveryQueueEnhanced({ cases, onSelectCase }) {
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('erv');

  if (!cases || cases.length === 0) {
    return (
      <div className="p-8 bg-slate-900 rounded-3xl border border-slate-800 text-center text-slate-400 text-sm">
        No active cases in queue. Generate demo data to populate recovery cases.
      </div>
    );
  }

  // Filter logic
  const filteredCases = cases.filter((c) => {
    // Search
    const matchesSearch = c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Category Filter
    if (filter === 'HIGH_PRIORITY') return c.priority_level === 'HIGH';
    if (filter === 'NEEDS_ACTION') return c.status === 'active';
    if (filter === 'DISPUTED') return c.dispute_flag === 1;
    if (filter === 'OVERDUE') return c.days_overdue > 0 && c.status === 'active';
    if (filter === 'RECOVERED') return c.status === 'recovered';
    if (filter === 'ESCALATED') return c.status === 'escalated' || c.requires_human;
    return true;
  });

  // Sort logic
  const sortedCases = [...filteredCases].sort((a, b) => {
    if (sortField === 'erv') return b.erv - a.erv;
    if (sortField === 'amount') return b.amount - a.amount;
    if (sortField === 'prob') return b.recovery_probability - a.recovery_probability;
    if (sortField === 'overdue') return b.days_overdue - a.days_overdue;
    return 0;
  });

  const getStatusBadge = (status, requiresHuman) => {
    if (status === 'recovered') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Recovered</span>;
    }
    if (status === 'escalated' || requiresHuman) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> Human Review</span>;
    }
    if (status === 'stopped') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Halted</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">Active</span>;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl font-sans">
      
      {/* Header & Controls */}
      <div className="p-6 border-b border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Recovery Queue (ERV Ranked)</h3>
            <p className="text-xs text-slate-400">Prioritized by Expected Recovery Value with Bounded Autonomy protection.</p>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search customer or invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 w-64"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {['ALL', 'HIGH_PRIORITY', 'NEEDS_ACTION', 'DISPUTED', 'OVERDUE', 'RECOVERED', 'ESCALATED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3.5">Customer & Invoice</th>
              <th className="px-6 py-3.5 cursor-pointer hover:text-white" onClick={() => setSortField('amount')}>
                <div className="flex items-center gap-1">Amount <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3.5">Problem Context</th>
              <th className="px-6 py-3.5 cursor-pointer hover:text-white" onClick={() => setSortField('prob')}>
                <div className="flex items-center gap-1">Prob. <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3.5 cursor-pointer hover:text-white" onClick={() => setSortField('erv')}>
                <div className="flex items-center gap-1">ERV <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-3.5">Autonomy</th>
              <th className="px-6 py-3.5">Recommended Action</th>
              <th className="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-xs">
            {sortedCases.slice(0, 100).map((c) => (
              <tr
                key={c.case_id}
                onClick={() => onSelectCase(c.case_id)}
                className="hover:bg-slate-850/60 cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="font-bold text-white group-hover:text-teal-300 transition-colors">{c.customer_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{c.invoice_number}</div>
                </td>

                <td className="px-6 py-4 font-bold text-slate-200">
                  ₹{c.amount.toLocaleString('en-IN')}
                </td>

                <td className="px-6 py-4 text-slate-400">
                  {c.dispute_flag === 1 ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Disputed Invoice
                    </span>
                  ) : (
                    <span>{c.days_overdue} days overdue</span>
                  )}
                </td>

                <td className="px-6 py-4 font-medium text-slate-300">
                  {(c.recovery_probability * 100).toFixed(0)}%
                </td>

                <td className="px-6 py-4 font-extrabold text-teal-400 font-mono">
                  ₹{c.erv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>

                <td className="px-6 py-4">
                  {c.can_automate ? (
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 text-[10px] font-semibold border border-teal-500/20 flex items-center gap-1 w-fit">
                      <Bot className="w-3 h-3 text-teal-400" /> Automated
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-semibold border border-amber-500/20 flex items-center gap-1 w-fit">
                      <UserCheck className="w-3 h-3 text-amber-400" /> Human Review
                    </span>
                  )}
                </td>

                <td className="px-6 py-4 text-slate-300 font-medium">
                  {c.action_label || c.recommended_action}
                </td>

                <td className="px-6 py-4">
                  {getStatusBadge(c.status, c.requires_human)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
