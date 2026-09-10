import React, { useState } from 'react';
import { PlusCircle, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Loader2, IndianRupee, TrendingUp, Zap, Info } from 'lucide-react';
import api from '../services/api';

const FAILURE_REASONS = [
  'Insufficient Funds',
  'Expired Card',
  'Bank Decline / Authorization Failed',
  'Customer Dispute',
  'Technical / Gateway Error',
  'Payment Cancelled',
  'Account Closed',
  'Credit Limit Exceeded',
  'Fraud Block',
  'Other'
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const CUSTOMER_TIERS = ['Enterprise', 'Mid-Market', 'SMB', 'Startup', 'Individual'];
const PAYMENT_METHODS = ['Bank Transfer / NEFT', 'UPI', 'Credit Card', 'Debit Card', 'Cheque', 'Auto-Debit', 'Wire Transfer', 'Other'];
const DISPUTE_OPTIONS = ['none', 'disputed', 'under-review'];

const DEFAULT_FORM = {
  customer_name: '',
  invoice_id: '',
  amount: '',
  currency: 'INR',
  payment_date: '',
  due_date: '',
  payment_status: 'failed',
  failure_reason: 'Insufficient Funds',
  customer_tier: 'SMB',
  payment_reliability: '0.75',
  days_overdue: '',
  dispute_status: 'none',
  payment_method: 'Bank Transfer / NEFT',
};

function FieldLabel({ children, tooltip }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-semibold text-stone-600">{children}</label>
      {tooltip && (
        <span className="relative" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
          <Info className="w-3 h-3 text-stone-400 cursor-help" />
          {showTip && (
            <div className="absolute bottom-5 left-0 w-52 bg-stone-800 text-white text-[11px] rounded-lg p-2.5 z-10 shadow-xl">
              {tooltip}
            </div>
          )}
        </span>
      )}
    </div>
  );
}

function AnalysisResult({ result, onClose }) {
  const { analysis } = result;
  const probColor = analysis.recoveryProbability >= 0.7 ? 'text-emerald-600' : analysis.recoveryProbability >= 0.45 ? 'text-amber-600' : 'text-red-600';
  const probBg = analysis.recoveryProbability >= 0.7 ? 'bg-emerald-50 border-emerald-200' : analysis.recoveryProbability >= 0.45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const priorityBg = analysis.priorityLevel === 'HIGH' ? 'bg-red-100 text-red-700' : analysis.priorityLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600';

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-emerald-800 text-sm">Analysis Complete</h3>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${priorityBg}`}>
          {analysis.priorityLevel} Priority
        </span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3.5 rounded-xl border ${probBg} text-center`}>
          <div className="text-xs text-stone-500 mb-1">Recovery Probability</div>
          <div className={`text-2xl font-black ${probColor}`}>{analysis.recoveryProbabilityPct}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-stone-200 bg-white text-center">
          <div className="text-xs text-stone-500 mb-1">Expected Recoverable</div>
          <div className="text-2xl font-black text-stone-800">
            ₹{Math.round(analysis.expectedRecoverableAmount).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="p-3.5 rounded-xl bg-white border border-stone-200 space-y-1.5">
        <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Why this payment likely failed</div>
        <p className="text-xs text-stone-700 leading-relaxed">{analysis.reasoning}</p>
      </div>

      {/* Recommended Action */}
      <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1.5">
        <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
          <Zap className="w-3 h-3" /> Recommended Action
        </div>
        <p className="text-xs text-indigo-800 font-medium leading-relaxed">{analysis.recommendedAction}</p>
      </div>

      <p className="text-[11px] text-emerald-700 text-center">
        ✓ Payment record saved and dashboard updated. Go to Recovery Queue to view and manage this case.
      </p>
    </div>
  );
}

export default function AddPaymentForm({ onPaymentAdded }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!form.customer_name.trim()) { setError('Customer name is required.'); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Please enter a valid invoice amount greater than 0.'); return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        payment_reliability: Number(form.payment_reliability) || 0.75,
        days_overdue: form.days_overdue !== '' ? Number(form.days_overdue) : undefined
      };
      const res = await api.analyzePayment(payload);
      setResult(res);
      if (onPaymentAdded) onPaymentAdded(res);
      // Reset form but keep it expanded for next entry
      setForm({ ...DEFAULT_FORM });
    } catch (err) {
      setError(err.message || 'Failed to analyze payment. Please ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-stone-400";
  const selectClass = "w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-stone-800 text-sm">Add Payment / Revenue Data</h2>
            <p className="text-xs text-stone-500">Enter a failed or pending payment to analyze and track recovery</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-stone-100 p-5">
          {result && (
            <AnalysisResult result={result} onClose={() => setResult(null)} />
          )}

          {!result && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Row 1: Customer & Invoice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel tooltip="The name of the company or person that owes the payment">Customer / Client Name *</FieldLabel>
                  <input
                    id="customer_name"
                    className={inputClass}
                    placeholder="e.g. ABC Technologies"
                    value={form.customer_name}
                    onChange={e => update('customer_name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <FieldLabel tooltip="Your invoice reference number (optional — auto-generated if blank)">Invoice ID / Reference</FieldLabel>
                  <input
                    id="invoice_id"
                    className={inputClass}
                    placeholder="e.g. INV-1042"
                    value={form.invoice_id}
                    onChange={e => update('invoice_id', e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Amount & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <FieldLabel tooltip="The total invoice amount that was not paid">Invoice Amount *</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm font-semibold">
                      {form.currency === 'INR' ? '₹' : form.currency}
                    </span>
                    <input
                      id="invoice_amount"
                      type="number"
                      min="1"
                      step="0.01"
                      className={`${inputClass} pl-8`}
                      placeholder="e.g. 85000"
                      value={form.amount}
                      onChange={e => update('amount', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <select id="currency" className={selectClass} value={form.currency} onChange={e => update('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3: Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel tooltip="When was the original payment made or attempted?">Payment / Invoice Date</FieldLabel>
                  <input
                    id="payment_date"
                    type="date"
                    className={inputClass}
                    value={form.payment_date}
                    onChange={e => update('payment_date', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel tooltip="When was this invoice due to be paid?">Due Date</FieldLabel>
                  <input
                    id="due_date"
                    type="date"
                    className={inputClass}
                    value={form.due_date}
                    onChange={e => update('due_date', e.target.value)}
                  />
                </div>
              </div>

              {/* Row 4: Status & Failure Reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel tooltip="Current status of this payment">Payment Status</FieldLabel>
                  <select id="payment_status" className={selectClass} value={form.payment_status} onChange={e => update('payment_status', e.target.value)}>
                    <option value="failed">Failed</option>
                    <option value="overdue">Overdue (not yet failed)</option>
                    <option value="active">Active / Pending</option>
                    <option value="recovered">Recovered / Paid</option>
                  </select>
                </div>
                <div>
                  <FieldLabel tooltip="The main reason the payment did not go through">Payment Failure Reason</FieldLabel>
                  <select id="failure_reason" className={selectClass} value={form.failure_reason} onChange={e => update('failure_reason', e.target.value)}>
                    {FAILURE_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 5: Customer Tier & Method */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel tooltip="Enterprise customers typically have higher recovery priority">Customer Tier</FieldLabel>
                  <select id="customer_tier" className={selectClass} value={form.customer_tier} onChange={e => update('customer_tier', e.target.value)}>
                    {CUSTOMER_TIERS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel tooltip="How the customer was expected to pay">Payment Method</FieldLabel>
                  <select id="payment_method" className={selectClass} value={form.payment_method} onChange={e => update('payment_method', e.target.value)}>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 6: Days Overdue & Reliability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel tooltip="How many days past the due date? Leave blank to calculate automatically from due date.">Days Overdue</FieldLabel>
                  <input
                    id="days_overdue"
                    type="number"
                    min="0"
                    className={inputClass}
                    placeholder="e.g. 5 (auto-calculated if blank)"
                    value={form.days_overdue}
                    onChange={e => update('days_overdue', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel tooltip="0 = always late, 1 = always pays on time. E.g. 0.82 = 82% reliability">Customer Payment Reliability (0–1)</FieldLabel>
                  <input
                    id="payment_reliability"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className={inputClass}
                    placeholder="e.g. 0.82"
                    value={form.payment_reliability}
                    onChange={e => update('payment_reliability', e.target.value)}
                  />
                  {form.payment_reliability && (
                    <p className="text-[11px] text-stone-400 mt-1">
                      = {Math.round(Number(form.payment_reliability) * 100)}% reliability
                      {Number(form.payment_reliability) >= 0.8 ? ' — High' : Number(form.payment_reliability) >= 0.5 ? ' — Moderate' : ' — Low'}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 7: Dispute Status */}
              <div>
                <FieldLabel tooltip="Is this invoice currently being disputed by the customer?">Dispute Status</FieldLabel>
                <select id="dispute_status" className={selectClass} value={form.dispute_status} onChange={e => update('dispute_status', e.target.value)}>
                  <option value="none">No Dispute</option>
                  <option value="disputed">Disputed by Customer</option>
                  <option value="under-review">Under Internal Review</option>
                </select>
                {form.dispute_status === 'disputed' && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Disputed invoices require manual review — automated recovery will be paused.
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  id="analyze_payment_btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing Payment...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>Analyze Payment</span>
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-stone-400 mt-2">
                  Payment data is saved and the AI engine calculates recovery probability, expected recovery value, and recommended action.
                </p>
              </div>
            </form>
          )}

          {result && (
            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-all"
            >
              + Add Another Payment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
