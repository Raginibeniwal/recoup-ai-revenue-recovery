import React, { useState } from 'react';
import {
  Wallet, ShieldCheck, AlertTriangle, Calendar, CheckCircle2, Clock,
  Lock, PlusCircle, ChevronDown, ChevronUp, Loader2, BarChart3
} from 'lucide-react';
import api from '../services/api';

const PAYMENT_TYPES = [
  'Electricity Bill', 'Gas Bill', 'Water Bill', 'Internet / Broadband',
  'Mobile Recharge', 'Credit Card EMI', 'Loan EMI', 'Insurance Premium',
  'Rent', 'Subscription (OTT)', 'School / College Fee', 'Medical Bill', 'Other'
];

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'overdue', label: 'Overdue' }
];

const FAILURE_REASONS = [
  'Insufficient Balance',
  'Auto-Debit Failed',
  'Expired Card',
  'Bank Decline',
  'Technical Error',
  'Cancelled',
  'Other'
];

function AddPersonalPaymentForm({ onAdded }) {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    payment_name: '',
    amount: '',
    due_date: '',
    payment_date: '',
    payment_type: 'Electricity Bill',
    status: 'pending',
    failure_reason: '',
    monthly_income: '',
    monthly_expenses: ''
  });

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.payment_name.trim()) { setError('Payment name is required.'); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return; }
    if (!form.due_date) { setError('Due date is required.'); return; }

    setLoading(true);
    try {
      await api.addPersonalPayment({
        ...form,
        amount: Number(form.amount),
        monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
        monthly_expenses: form.monthly_expenses ? Number(form.monthly_expenses) : null
      });
      setSuccess(true);
      setForm({
        payment_name: '', amount: '', due_date: '', payment_date: '',
        payment_type: 'Electricity Bill', status: 'pending', failure_reason: '',
        monthly_income: '', monthly_expenses: ''
      });
      if (onAdded) onAdded();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all placeholder-stone-400";
  const selectClass = "w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all";

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-stone-50"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-teal-700" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-stone-800 text-sm">Add Payment / Bill</h2>
            <p className="text-xs text-stone-500">Track an upcoming, failed, or overdue personal payment</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-stone-100 p-5">
          {success && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Payment added successfully. Dashboard is refreshing.
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Payment / Bill Name *</label>
                <input className={inputClass} placeholder="e.g. Electricity Bill" value={form.payment_name} onChange={e => update('payment_name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Amount (₹) *</label>
                <input type="number" min="1" className={inputClass} placeholder="e.g. 2450" value={form.amount} onChange={e => update('amount', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Payment Type</label>
                <select className={selectClass} value={form.payment_type} onChange={e => update('payment_type', e.target.value)}>
                  {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Status</label>
                <select className={selectClass} value={form.status} onChange={e => update('status', e.target.value)}>
                  {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Due Date *</label>
                <input type="date" className={inputClass} value={form.due_date} onChange={e => update('due_date', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Payment Date (if paid)</label>
                <input type="date" className={inputClass} value={form.payment_date} onChange={e => update('payment_date', e.target.value)} />
              </div>
            </div>

            {(form.status === 'failed' || form.status === 'overdue') && (
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Failure Reason</label>
                <select className={selectClass} value={form.failure_reason} onChange={e => update('failure_reason', e.target.value)}>
                  <option value="">Select reason...</option>
                  {FAILURE_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="border-t border-stone-100 pt-4">
              <p className="text-xs font-semibold text-stone-500 mb-3">Monthly Financial Overview (optional — helps calculate health score)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Monthly Income (₹)</label>
                  <input type="number" min="0" className={inputClass} placeholder="e.g. 60000" value={form.monthly_income} onChange={e => update('monthly_income', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Monthly Expenses (₹)</label>
                  <input type="number" min="0" className={inputClass} placeholder="e.g. 35000" value={form.monthly_expenses} onChange={e => update('monthly_expenses', e.target.value)} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><PlusCircle className="w-4 h-4" /> Save Payment</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function PersonalDashboard({ data, onRefresh }) {
  if (!data) return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-stone-900">Personal Finance Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">Track your personal bills, payments, and financial health.</p>
      </div>
      <AddPersonalPaymentForm onAdded={onRefresh} />
    </div>
  );

  const {
    upcomingPayments = [],
    overdueAmount = 0,
    overdueCount = 0,
    failedPaymentsCount = 0,
    paymentHealthScore = 0,
    healthLabel = 'No Data',
    alerts = [],
    suggestions = [],
    disclaimer,
    hasData = false,
    totalPayments = 0
  } = data;

  const scoreColor = paymentHealthScore >= 80 ? 'text-emerald-600' : paymentHealthScore >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6 font-sans">

      {/* Header */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
            Personal Finance Dashboard
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {hasData
              ? `Tracking ${totalPayments} payment${totalPayments !== 1 ? 's' : ''} · ${overdueCount} overdue`
              : 'Add your bills and payments to start tracking financial health.'}
          </p>
        </div>
        {hasData && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-center min-w-[120px]">
            <div className="text-xs text-stone-500 mb-0.5">Payment Health</div>
            <div className={`text-3xl font-black ${scoreColor}`}>{paymentHealthScore}</div>
            <div className="text-xs text-stone-400">out of 100</div>
            <div className={`text-xs font-bold mt-0.5 ${scoreColor}`}>{healthLabel}</div>
          </div>
        )}
      </div>

      {/* Add Payment Form */}
      <AddPersonalPaymentForm onAdded={onRefresh} />

      {hasData && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>Upcoming Dues</span>
                <Calendar className="w-3.5 h-3.5 text-teal-500" />
              </div>
              <div className="text-2xl font-black text-stone-800">
                ₹{upcomingPayments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-stone-400">{upcomingPayments.length} upcoming</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>Overdue Amount</span>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">
                ₹{overdueAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-stone-400">{overdueCount} overdue item{overdueCount !== 1 ? 's' : ''}</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>Failed Payments</span>
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="text-2xl font-black text-red-600">{failedPaymentsCount}</div>
              <div className="text-xs text-stone-400">Payment failures</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>Health Score</span>
                <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
              </div>
              <div className={`text-2xl font-black ${scoreColor}`}>
                {paymentHealthScore} <span className="text-xs font-normal text-stone-400">/ 100</span>
              </div>
              <div className={`text-xs font-bold ${scoreColor}`}>{healthLabel}</div>
            </div>
          </div>

          {/* Alerts */}
          {alerts.map(alt => (
            <div key={alt.id} className={`p-4 rounded-2xl border flex items-start gap-3 ${
              alt.level === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm">{alt.title}</h3>
                <p className="text-xs mt-0.5 leading-relaxed opacity-90">{alt.message}</p>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Bills */}
            {upcomingPayments.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-stone-800 mb-4">Upcoming Payments</h3>
                <div className="space-y-2.5">
                  {upcomingPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center font-bold text-teal-700 text-xs">
                          {p.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-stone-800 text-sm">{p.name}</div>
                          <div className="text-xs text-stone-400">Due {p.date}</div>
                        </div>
                      </div>
                      <div className="font-bold text-stone-800">₹{p.amount.toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credit Health Guidance */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Credit & Payment Health Guidance
              </h3>
              <div className="space-y-2.5">
                {suggestions.slice(0, 4).map((sug, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-stone-600 leading-relaxed">{sug}</span>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Important Disclaimer
                </div>
                <p className="leading-relaxed">
                  This is educational financial health guidance only. It is NOT an official credit score and does not affect your CIBIL, Experian, or any credit bureau rating. {disclaimer}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
