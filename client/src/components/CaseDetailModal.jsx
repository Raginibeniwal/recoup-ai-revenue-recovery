import React, { useEffect, useState } from 'react';
import { X, Play, Bot, UserCheck, CheckCircle2, AlertTriangle, Clock, Search, ChevronDown, ChevronUp, FileText, Check } from 'lucide-react';
import api from '../services/api';

export default function CaseDetailModal({ caseId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [updatingPromise, setUpdatingPromise] = useState(false);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    setLoading(true);
    try {
      const res = await api.getCaseDetails(caseId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunRecovery = async () => {
    setSimulating(true);
    setSimStep(1);

    // Simulated progress steps for presentation
    const steps = [
      'Analysing invoice & category risk...',
      'Checking customer historical payment reliability...',
      'Calculating recovery probability & Expected Recovery Value (ERV)...',
      'Applying Bounded Autonomy stopping rules...',
      'Selecting optimal recovery action & executing simulation...',
      'Recording audit log & result...'
    ];

    for (let i = 1; i <= steps.length; i++) {
      setSimStep(i);
      await new Promise((r) => setTimeout(r, 600));
    }

    try {
      await api.runSingleRecovery(caseId);
      await loadCase();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Run recovery error:', err);
    } finally {
      setSimulating(false);
      setSimStep(0);
    }
  };

  const handleUpdatePromise = async (promiseId, status) => {
    setUpdatingPromise(true);
    try {
      await api.updatePromiseStatus(promiseId, status);
      await loadCase();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingPromise(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-300 text-sm">Loading invoice decision data...</p>
        </div>
      </div>
    );
  }

  const { decision, audit_log, recovery_attempts, promises_to_pay } = data;
  const activePromise = promises_to_pay?.find(p => p.status === 'active');

  const simStepMessages = [
    '',
    'Analysing invoice context & overdue age...',
    'Checking customer payment history & delay trends...',
    'Calculating recovery probability & ERV...',
    'Evaluating Bounded Autonomy stopping rules...',
    'Executing simulated action...',
    'Finalizing audit trail & updating status...'
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-end overflow-y-auto font-sans">
      <div className="w-full max-w-3xl min-h-full bg-slate-900 border-l border-slate-800 shadow-2xl p-6 sm:p-8 space-y-8 animate-slide-in relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Case Header */}
        <div className="space-y-3 border-b border-slate-800 pb-6 pr-12">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black text-white">{data.customer_name}</h2>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {data.invoice_number}
            </span>
            {data.failure_reason && (
              <span className="text-xs px-2.5 py-1 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                {data.failure_reason}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>Amount: <strong className="text-white text-base">₹{data.amount.toLocaleString('en-IN')}</strong></span>
            <span>Due Date: <strong className="text-slate-200">{data.due_date}</strong></span>
            <span>Overdue: <strong className="text-amber-400">{data.days_overdue} days</strong></span>
            <span>Status: <strong className="text-teal-400 uppercase">{data.status}</strong></span>
            {data.payment_method && <span>Method: <strong className="text-slate-200">{data.payment_method}</strong></span>}
          </div>
        </div>

        {/* Real-time Interactive Simulation Progress Popup */}
        {simulating && (
          <div className="p-6 rounded-2xl bg-teal-950/80 border border-teal-500/50 space-y-4 shadow-xl animate-pulse">
            <div className="flex items-center gap-3 text-teal-300">
              <Bot className="w-6 h-6 animate-bounce" />
              <h4 className="font-bold text-base">Recoup Recovery Agent Executing...</h4>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-400 h-full transition-all duration-300"
                  style={{ width: `${(simStep / 6) * 100}%` }}
                />
              </div>
              <p className="text-xs font-mono text-teal-200">{simStepMessages[simStep]}</p>
            </div>
          </div>
        )}

        {/* Action Header & Run Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-950 border border-slate-850">
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Recommended Action</div>
            <div className="text-base font-bold text-white mt-0.5">{decision?.actionLabel || decision?.recommendedAction}</div>
          </div>

          {data.status === 'active' && !simulating && (
            <button
              onClick={handleRunRecovery}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" /> Run Recovery
            </button>
          )}
        </div>

        {/* Bounded Autonomy Indicator */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
          decision?.canAutomate
            ? 'bg-teal-950/40 border-teal-800/60 text-teal-200'
            : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
        }`}>
          {decision?.canAutomate ? (
            <Bot className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          ) : (
            <UserCheck className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm">
              {decision?.canAutomate ? '🤖 Automation Allowed' : '👤 Human Review Required'}
            </div>
            <p className="opacity-90 mt-0.5">
              {decision?.stopReason || 'Customer and invoice metrics meet safety criteria for automated recovery.'}
            </p>
          </div>
        </div>

        {/* WHY DID THIS PAYMENT FAIL — Human Reasoning Section */}
        {data.reasoning && (
          <div className="space-y-2 bg-amber-950/40 p-5 rounded-2xl border border-amber-800/50">
            <h3 className="font-bold text-amber-200 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Why This Payment Likely Failed
            </h3>
            <p className="text-xs text-amber-100/90 leading-relaxed">{data.reasoning}</p>
          </div>
        )}

        {/* RECOMMENDED ACTION */}
        {data.recommended_action_text && (
          <div className="space-y-2 bg-teal-950/40 p-5 rounded-2xl border border-teal-800/50">
            <h3 className="font-bold text-teal-200 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              Recommended Recovery Action
            </h3>
            <p className="text-xs text-teal-100/90 leading-relaxed font-medium">{data.recommended_action_text}</p>
          </div>
        )}

        {/* "WHY RECOUP RECOMMENDS THIS" — AI Decision Factors */}
        <div className="space-y-4 bg-slate-950 p-6 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
              AI Recovery Analysis
            </h3>
            <button
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="text-xs text-teal-400 hover:underline flex items-center gap-1 font-mono"
            >
              {showTechDetails ? 'Hide' : 'Show'} Decision Factors {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="space-y-2">
            {decision?.humanReasons?.map((reason, idx) => (
              <div key={idx} className="text-xs text-slate-200 font-medium leading-relaxed">
                {reason}
              </div>
            ))}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Recovery Probability:</span>
              <div className="text-2xl font-black text-teal-400">{decision ? (decision.recoveryProbability * 100).toFixed(0) : 0}%</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Chance of collecting this invoice</div>
            </div>
            <div>
              <span className="text-slate-400">Expected Recoverable Value (ERV):</span>
              <div className="text-2xl font-black text-white">₹{decision ? Math.round(decision.expectedRecoveryValue).toLocaleString('en-IN') : 0}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Invoice Amount × Recovery Probability</div>
            </div>
          </div>

          {/* Expandable Technical Factors */}
          {showTechDetails && (
            <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
              <div className="font-bold text-teal-400 text-[11px] uppercase tracking-wider">AI Decision Factors:</div>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-400">
                {decision?.decisionFactors?.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Promise-to-Pay Lifecycle Widget */}
        {activePromise && (
          <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Clock className="w-4 h-4" /> Active Promise to Pay
              </div>
              <span className="text-xs font-bold text-white font-mono">₹{activePromise.promised_amount.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-xs text-amber-200/80">Customer promised payment due by <strong className="text-amber-100">{activePromise.promised_date}</strong>.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleUpdatePromise(activePromise.promise_id, 'fulfilled')}
                disabled={updatingPromise}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Mark as Paid
              </button>
              <button
                onClick={() => handleUpdatePromise(activePromise.promise_id, 'broken')}
                disabled={updatingPromise}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-200 font-semibold text-xs hover:bg-slate-700 transition-all"
              >
                Promise Broken / Follow Up
              </button>
            </div>
          </div>
        )}

        {/* Audit Trail Timeline */}
        <div className="space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            Activity & Audit Trail
          </h3>

          {(!audit_log || audit_log.length === 0) ? (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500 text-center">
              No recovery actions recorded yet. Click "Run Recovery" to begin automated recovery for this case.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-800 ml-3 space-y-6 pb-4">
              {audit_log.map((log) => (
                <div key={log.id} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-800 border-2 border-teal-400" />
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white uppercase tracking-wider">{log.event.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{log.reasoning}</p>
                    {log.tool_called && (
                      <div className="text-[11px] font-mono text-teal-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                        Tool: {log.tool_called}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
