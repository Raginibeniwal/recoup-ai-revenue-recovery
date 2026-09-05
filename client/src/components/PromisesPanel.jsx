import React, { useEffect, useState } from 'react';
import { Clock, Check, X, Building2, Calendar, IndianRupee } from 'lucide-react';
import api from '../services/api';

export default function PromisesPanel({ onOpenCase }) {
  const [promises, setPromises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPromises();
  }, []);

  const loadPromises = async () => {
    setLoading(true);
    try {
      const res = await api.getPromises();
      setPromises(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (promiseId, status) => {
    try {
      await api.updatePromiseStatus(promiseId, status);
      await loadPromises();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading promises to pay...</div>;
  }

  if (!promises || promises.length === 0) {
    return (
      <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
        <Clock className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
        <h3 className="text-lg font-bold text-white">No active promises to pay</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Promises to pay are automatically recorded when customers commit to a payment date during recovery simulation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Promises to Pay Tracker</h2>
          <p className="text-xs text-slate-400">Track customer payment commitments and manage fulfillment lifecycle.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promises.map((p) => (
          <div key={p.promise_id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg hover:border-slate-750 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-white text-sm">{p.company_name}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                p.status === 'fulfilled' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : p.status === 'broken' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {p.status}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-850">
              <div>
                <div className="text-xs text-slate-400">Promised Amount</div>
                <div className="text-lg font-bold text-white">₹{p.promised_amount.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Promised Date</div>
                <div className="text-sm font-semibold text-slate-200">{p.promised_date}</div>
              </div>
            </div>

            {p.status === 'active' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleUpdateStatus(p.promise_id, 'fulfilled')}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Mark as Paid
                </button>
                <button
                  onClick={() => handleUpdateStatus(p.promise_id, 'broken')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 font-semibold text-xs transition-all"
                >
                  Promise Broken
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
