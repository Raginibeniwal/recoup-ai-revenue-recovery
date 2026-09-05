import React, { useState } from 'react';
import { Shield, Building2, User, Bot, LogOut, ChevronDown, Sparkles, RefreshCw, Check, AlertCircle } from 'lucide-react';

export default function Navigation({
  mode,
  setMode,
  activeTab,
  setActiveTab,
  onGenerateBatch,
  generatingBatch,
  serverStatus,
  onOpenAssistant,
  onLogout
}) {
  const [showGenDropdown, setShowGenDropdown] = useState(false);

  const navItems = mode === 'business'
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'queue', label: 'Recovery Queue' },
        { id: 'promises', label: 'Promises to Pay' },
        { id: 'health', label: 'Financial Health' },
        { id: 'analytics', label: 'Analytics' }
      ]
    : [
        { id: 'overview', label: 'Overview' },
        { id: 'bills', label: 'Upcoming Bills' },
        { id: 'health', label: 'Payment Health' }
      ];

  const handleGenSelect = (count) => {
    setShowGenDropdown(false);
    onGenerateBatch(count);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Mode Badge */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-500 p-0.5 shadow-md shadow-teal-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-teal-400" />
              </div>
            </div>
            <span className="text-lg font-black tracking-tight text-white">RECOUP</span>
          </div>

          {/* Mode Switcher pill */}
          <button
            onClick={() => setMode(mode === 'business' ? 'personal' : 'business')}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              mode === 'business'
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30 hover:bg-teal-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
            title="Click to toggle Business / Personal mode"
          >
            {mode === 'business' ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{mode === 'business' ? 'Business Mode' : 'Personal Mode'}</span>
            <span className="text-[10px] opacity-70 underline ml-1">Switch</span>
          </button>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-slate-800 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: Server Status, Batch Gen, Assistant, Logout */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Server Status Indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              serverStatus === 'online'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
            }`}
          >
            {serverStatus === 'online' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <AlertCircle className="w-3 h-3 text-rose-400" />
            )}
            <span>{serverStatus === 'online' ? 'Backend Online' : 'Backend Disconnected'}</span>
          </div>

          {/* Generate Demo Data Button (Business Mode only) */}
          {mode === 'business' && (
            <div className="relative">
              <button
                onClick={() => setShowGenDropdown(!showGenDropdown)}
                disabled={generatingBatch}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {generatingBatch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    <span>Generate Demo Data</span>
                    <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                  </>
                )}
              </button>

              {showGenDropdown && (
                <div className="absolute right-0 top-10 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                    Select Demo Case Count
                  </div>
                  <button
                    onClick={() => handleGenSelect(10)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                  >
                    <span>10 Cases (Quick Demo)</span>
                    <Check className="w-3 h-3 text-teal-400" />
                  </button>
                  <button
                    onClick={() => handleGenSelect(50)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200"
                  >
                    50 Cases (Medium Batch)
                  </button>
                  <button
                    onClick={() => handleGenSelect(400)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200"
                  >
                    400 Cases (Full Enterprise)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Assistant Trigger */}
          <button
            onClick={onOpenAssistant}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/30 text-teal-300 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <Bot className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">Recoup Assistant</span>
          </button>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
}
