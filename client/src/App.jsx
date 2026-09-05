import React, { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Navigation from './components/Navigation';
import BusinessDashboard from './components/BusinessDashboard';
import PersonalDashboard from './components/PersonalDashboard';
import RecoveryQueueEnhanced from './components/RecoveryQueueEnhanced';
import PromisesPanel from './components/PromisesPanel';
import FinancialHealthPanel from './components/FinancialHealthPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import CaseDetailModal from './components/CaseDetailModal';
import RecoupAssistant from './components/RecoupAssistant';
import Toast from './components/Toast';
import api from './services/api';
import './index.css';

export default function App() {
  // Session / Navigation state
  const [page, setPage] = useState(() => localStorage.getItem('recoup_page') || 'landing');
  const [mode, setMode] = useState(() => localStorage.getItem('recoup_mode') || 'business');
  const [activeTab, setActiveTab] = useState('overview');

  // Application Data State
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [personalData, setPersonalData] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Status & Loader States
  const [serverStatus, setServerStatus] = useState('online');
  const [runningAgent, setRunningAgent] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [toast, setToast] = useState(null);

  // Persist session choices
  useEffect(() => {
    localStorage.setItem('recoup_page', page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem('recoup_mode', mode);
  }, [mode]);

  // Load data on start & mode change
  useEffect(() => {
    if (page === 'dashboard') {
      refreshData();
    }
  }, [page, mode]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshData = async () => {
    try {
      if (mode === 'business') {
        const [sumRes, casesRes] = await Promise.all([
          api.getDashboardSummary().catch(() => null),
          api.getCases().catch(() => [])
        ]);
        if (sumRes) setSummary(sumRes);
        if (casesRes) setCases(casesRes);
        setServerStatus('online');
      } else {
        const pRes = await api.getPersonalSummary().catch(() => null);
        if (pRes) setPersonalData(pRes);
        setServerStatus('online');
      }
    } catch (err) {
      console.error(err);
      setServerStatus('disconnected');
      showToast('error', err.message);
    }
  };

  const handleStartDemo = (selectedMode = 'business') => {
    setMode(selectedMode);
    setPage('dashboard');
    setActiveTab('overview');
  };

  const handleLogin = (selectedMode) => {
    setMode(selectedMode);
    setPage('dashboard');
    setActiveTab('overview');
    showToast('success', `Logged in as ${selectedMode === 'business' ? 'Enterprise Business' : 'Personal User'}`);
  };

  const handleLogout = () => {
    setPage('landing');
    showToast('info', 'Logged out of Recoup session');
  };

  const handleGenerateBatch = async (count = 400) => {
    setGeneratingBatch(true);
    showToast('info', `Generating ${count} synthetic cases...`);
    try {
      const res = await api.generateBatch(count);
      showToast('success', `Generated ${res.totalCases} cases (₹${(res.totalAtRisk / 100000).toFixed(1)}L at risk)`);
      await refreshData();
    } catch (err) {
      showToast('error', err.message);
      setServerStatus('disconnected');
    } finally {
      setGeneratingBatch(false);
    }
  };

  const handleRunAgent = async () => {
    setRunningAgent(true);
    showToast('info', 'Running Recoup Recovery Decision Engine across batch...');
    try {
      const res = await api.runBatch();
      showToast('success', `Agent completed! Recovered ${res.recovered} cases (₹${(res.recoveredAmount / 100000).toFixed(1)}L)`);
      await refreshData();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setRunningAgent(false);
    }
  };

  // Render Views
  if (page === 'landing') {
    return <LandingPage onStartDemo={handleStartDemo} />;
  }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Navigation Header */}
      <Navigation
        mode={mode}
        setMode={(m) => {
          setMode(m);
          setActiveTab('overview');
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onGenerateBatch={handleGenerateBatch}
        generatingBatch={generatingBatch}
        serverStatus={serverStatus}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onLogout={handleLogout}
      />

      {/* Backend Disconnected Warning Banner */}
      {serverStatus === 'disconnected' && (
        <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 px-6 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <span>Recoup server is not responding. Ensure the backend server is running on port 3001.</span>
          <button onClick={refreshData} className="underline text-white hover:text-rose-100">Retry Connection</button>
        </div>
      )}

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {mode === 'business' ? (
          <>
            {activeTab === 'overview' && (
              <BusinessDashboard
                summary={summary}
                runningAgent={runningAgent}
                onRunAgent={handleRunAgent}
                onGenerateBatch={handleGenerateBatch}
                onOpenCase={(id) => setSelectedCaseId(id)}
                onViewQueue={() => setActiveTab('queue')}
              />
            )}

            {activeTab === 'queue' && (
              <RecoveryQueueEnhanced
                cases={cases}
                onSelectCase={(id) => setSelectedCaseId(id)}
              />
            )}

            {activeTab === 'promises' && (
              <PromisesPanel onOpenCase={(id) => setSelectedCaseId(id)} />
            )}

            {activeTab === 'health' && (
              <FinancialHealthPanel mode="business" />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel />
            )}
          </>
        ) : (
          <>
            {activeTab === 'overview' && (
              <PersonalDashboard data={personalData} />
            )}

            {activeTab === 'bills' && (
              <PersonalDashboard data={personalData} />
            )}

            {activeTab === 'health' && (
              <FinancialHealthPanel mode="personal" />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        RECOUP Revenue Recovery & Financial Health Platform &copy; 2026. Educational Prototype.
      </footer>

      {/* Case Detail Modal */}
      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onRefresh={refreshData}
        />
      )}

      {/* Recoup AI Assistant Slide-over Drawer */}
      <RecoupAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />

      {/* Global Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
