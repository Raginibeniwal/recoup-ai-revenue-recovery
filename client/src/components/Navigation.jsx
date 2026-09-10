import React, { useState } from 'react';
import { Shield, Building2, User, Bot, LogOut, AlertCircle } from 'lucide-react';

export default function Navigation({
  mode,
  setMode,
  activeTab,
  setActiveTab,
  serverStatus,
  dataSource,
  onOpenAssistant,
  onLogout
}) {
  const businessName = localStorage.getItem('recoup_business_name') || 'Business';
  const userEmail = localStorage.getItem('recoup_user_email') || '';

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
        { id: 'bills', label: 'My Payments' },
        { id: 'health', label: 'Payment Health' }
      ];

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        {/* Left: Brand + Mode Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-black tracking-tight text-stone-900">RECOUP</span>
          </button>

          {/* Mode badge */}
          <button
            onClick={() => {
              setMode(mode === 'business' ? 'personal' : 'business');
              setActiveTab('overview');
            }}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-all ${
              mode === 'business'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
            }`}
            title="Click to switch mode"
          >
            {mode === 'business' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {mode === 'business' ? businessName : 'Personal'}
            <span className="opacity-60 underline">switch</span>
          </button>
        </div>

        {/* Center: Nav Links */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: Data Source + Status + Assistant + Logout */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Data Source Pill */}
          {dataSource && dataSource !== 'empty' && (
            <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
              dataSource === 'real'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : dataSource === 'demo'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                dataSource === 'real' ? 'bg-emerald-500'
                : dataSource === 'demo' ? 'bg-amber-500'
                : 'bg-blue-500'
              }`} />
              {dataSource === 'real' ? 'Based on your data' : dataSource === 'demo' ? 'Sample dataset' : 'Mixed data'}
            </div>
          )}

          {/* Server Status */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
            serverStatus === 'online'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {serverStatus === 'online' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            <span>{serverStatus === 'online' ? 'Online' : 'Offline'}</span>
          </div>

          {/* AI Assistant */}
          <button
            id="open_assistant_btn"
            onClick={onOpenAssistant}
            className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Assistant</span>
          </button>

          {/* Logout */}
          <button
            id="logout_btn"
            onClick={onLogout}
            className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
