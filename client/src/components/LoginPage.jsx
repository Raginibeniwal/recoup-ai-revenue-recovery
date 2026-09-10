import React, { useState } from 'react';
import { Shield, Building2, User, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('business'); // 'business' | 'personal'
  const [form, setForm] = useState({ businessName: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    if (mode === 'business' && !form.businessName.trim()) e.businessName = 'Business name is required.';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'A valid email address is required.';
    if (!form.password || form.password.length < 4) e.password = 'Password must be at least 4 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Store session info in localStorage
    localStorage.setItem('recoup_user_email', form.email);
    localStorage.setItem('recoup_user_mode', mode);
    if (mode === 'business') localStorage.setItem('recoup_business_name', form.businessName);

    onLogin(mode);
  };

  const inputClass = (field) =>
    `w-full border rounded-xl px-4 py-2.5 text-sm text-stone-800 bg-white focus:outline-none transition-all ${
      errors[field]
        ? 'border-red-400 focus:ring-2 focus:ring-red-100'
        : 'border-stone-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
    }`;

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900">Recoup</h1>
            <p className="text-stone-500 text-sm">AI-powered revenue recovery</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="bg-white border border-stone-200 rounded-2xl p-1 flex shadow-sm">
          <button
            onClick={() => setMode('business')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              mode === 'business'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Building2 className="w-4 h-4" /> Business
          </button>
          <button
            onClick={() => setMode('personal')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              mode === 'personal'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <User className="w-4 h-4" /> Personal
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-bold text-stone-800">
              {mode === 'business' ? 'Business Login / Sign Up' : 'Personal Login / Sign Up'}
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {mode === 'business'
                ? 'Manage invoices, track revenue recovery, and analyze payment failures.'
                : 'Track personal payments, bills, and payment health.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'business' && (
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Business Name *</label>
                <input
                  id="business_name"
                  className={inputClass('businessName')}
                  placeholder="e.g. Acme Technologies Ltd."
                  value={form.businessName}
                  onChange={e => update('businessName', e.target.value)}
                />
                {errors.businessName && <p className="text-xs text-red-600 mt-1">{errors.businessName}</p>}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Email Address *</label>
              <input
                id="login_email"
                type="email"
                className={inputClass('email')}
                placeholder="you@company.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Password *</label>
              <div className="relative">
                <input
                  id="login_password"
                  type={showPwd ? 'text' : 'password'}
                  className={`${inputClass('password')} pr-10`}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>

            <button
              id="login_submit_btn"
              type="submit"
              className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                mode === 'business'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {mode === 'business' ? 'Access Business Dashboard' : 'Access Personal Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-[11px] text-stone-400">
            For this prototype, credentials are stored locally. No real authentication server is required.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-2 shadow-sm">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            {mode === 'business' ? 'Business features' : 'Personal features'}
          </p>
          {mode === 'business' ? [
            'Track failed and overdue invoices',
            'AI-powered recovery probability analysis',
            'CSV bulk import for payment records',
            'Priority recovery queue with recommended actions',
            'Financial health indicators based on your data',
          ] : [
            'Track upcoming bills and payment due dates',
            'Monitor failed and overdue personal payments',
            'Payment health score based on your history',
            'Credit & payment health guidance',
            'Financial behavior tips and insights',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-stone-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
