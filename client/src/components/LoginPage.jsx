import React from 'react';
import { Shield, Building2, User, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-8">
        
        {/* Logo Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-500 p-0.5 shadow-xl shadow-teal-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-teal-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Welcome to RECOUP</h1>
          <p className="text-slate-400 text-sm">Select a mode to continue into the demo platform</p>
        </div>

        {/* Mode Selector Options */}
        <div className="space-y-4">
          
          <button
            onClick={() => onLogin('business')}
            className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-teal-500/80 hover:bg-slate-800 transition-all text-left group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm group-hover:text-teal-300 transition-colors">Continue as Business</h3>
                <p className="text-xs text-slate-400">For managing unpaid invoices & revenue risk</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => onLogin('personal')}
            className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/80 hover:bg-slate-800 transition-all text-left group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">Continue as Individual</h3>
                <p className="text-xs text-slate-400">For personal bills & credit-health guidance</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </button>

        </div>

        {/* Demo Account Quick Access */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <p className="text-xs font-semibold text-slate-500 text-center uppercase tracking-wider">Quick Demo Access</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onLogin('business')}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Demo Business
            </button>

            <button
              onClick={() => onLogin('personal')}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Demo Personal
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 leading-tight">
          Demo session stored locally. No passwords or real authentication required.
        </p>
      </div>
    </div>
  );
}
