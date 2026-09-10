import React from 'react';
import { Shield, ArrowRight, Activity, Bot, CheckCircle2, AlertTriangle, Wallet, Users, Lock, TrendingUp } from 'lucide-react';

export default function LandingPage({ onStartDemo }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-500 p-0.5 shadow-lg shadow-teal-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">RECOUP</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-mono">PROTOTYPE</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onStartDemo('business')}
              className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5"
            >
              Business Mode
            </button>
            <button
              onClick={() => onStartDemo('personal')}
              className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5"
            >
              Personal Mode
            </button>
            <button
              onClick={() => onStartDemo('business')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold text-sm hover:brightness-110 shadow-lg shadow-teal-500/25 transition-all flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-16 pb-24 w-full">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-800/60 text-teal-300 text-xs font-medium">
            <Activity className="w-3.5 h-3.5" /> Intelligent Revenue Recovery & Financial Health Platform
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Recover revenue before it becomes <span className="bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">lost revenue.</span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed">
            Recoup intelligently identifies payment risks, recommends the right recovery action, and helps businesses recover cash without blindly automating sensitive customer decisions.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onStartDemo('business')}
              className="px-8 py-3.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-base hover:bg-teal-400 shadow-xl shadow-teal-500/20 transition-all flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>

            <a
              href="#how-it-works"
              className="px-6 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-base hover:bg-slate-850 hover:border-slate-700 transition-all"
            >
              See How It Works
            </a>
          </div>

          <p className="text-xs text-slate-500">
            Start with your own data — or explore with sample data after signing in.
          </p>
        </div>

        {/* Demo Guarantee Banner */}
        <div className="mt-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center text-xs text-slate-400 max-w-2xl mx-auto flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 text-teal-400 shrink-0" />
          <span>Prototype environment — simulated recovery actions &amp; educational guidance. No real payments or messages are sent. Your data stays in-session only.</span>
        </div>

        {/* Interactive Visual Workflow graphic */}
        <div id="how-it-works" className="mt-20 space-y-8">
          <div className="text-center">
            <h2 className="text-xs uppercase tracking-widest text-teal-400 font-semibold mb-2">How Recoup Works</h2>
            <p className="text-2xl font-bold text-white">5 Simple Steps from Risk Detection to Recovered Cash</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <WorkflowStep
              step="1"
              title="Unpaid Payments"
              desc="Tracks overdue invoices, failed auto-debits, and disputes."
              icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
            />
            <WorkflowStep
              step="2"
              title="Risk Diagnosis"
              desc="Diagnoses chronic late payers vs temporary cash flow delays."
              icon={<Activity className="w-5 h-5 text-teal-400" />}
            />
            <WorkflowStep
              step="3"
              title="Prob. & ERV Score"
              desc="Calculates recovery probability and Expected Recovery Value."
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            />
            <WorkflowStep
              step="4"
              title="Safe Automation"
              desc="Automates routine reminders; escalates disputes to humans."
              icon={<Bot className="w-5 h-5 text-cyan-400" />}
            />
            <WorkflowStep
              step="5"
              title="Recover Revenue"
              desc="Records payments, promises to pay, and updates audit logs."
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            />
          </div>
        </div>

        {/* Dual Mode Feature Cards */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-6 hover:border-teal-500/50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Business Mode</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Designed for businesses managing unpaid invoices, high-risk accounts, revenue at risk, payment promises, and bounded autonomy safeguards.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-teal-400" /> Revenue at Risk & Recoverable Now KPIs</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-teal-400" /> ERV-ranked Recovery Queue</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-teal-400" /> Bounded Autonomy Human Escalations</li>
            </ul>
            <button
              onClick={() => onStartDemo('business')}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-sm transition-all"
            >
              Launch Business Mode
            </button>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-6 hover:border-emerald-500/50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Personal Mode</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Designed for individuals tracking upcoming bills, failed auto-debits, payment reliability, and educational credit profile guidance.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Upcoming Bills & Subscription Tracker</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Payment Health Indicator (0–100)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Auto-debit Failure Prevention Advice</li>
            </ul>
            <button
              onClick={() => onStartDemo('personal')}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold text-sm transition-all"
            >
              Launch Personal Mode
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        Recoup Revenue Recovery Platform &copy; 2026. Educational Financial Health Prototype.
      </footer>
    </div>
  );
}

function WorkflowStep({ step, title, desc, icon }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors relative">
      <div className="flex items-center justify-between mb-3">
        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center font-mono">
          {step}
        </span>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-white text-sm mb-1">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
