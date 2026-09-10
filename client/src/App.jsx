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
  const [dataSource, setDataSource] = useState('empty'); // 'empty' | 'real' | 'demo' | 'mixed'

  // Status States
  const [serverStatus, setServerStatus] = useState('online');
  const [toast, setToast] = useState(null);

  // Persist session choices
  useEffect(() => {
    localStorage.setItem('recoup_page', page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem('recoup_mode', mode);
  }, [mode]);

  // Load data when entering dashboard
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
        if (sumRes) {
          setSummary(sumRes);
          setDataSource(sumRes.dataSource || (sumRes.hasData ? 'real' : 'empty'));
        }
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
    setPage('login');
  };

  const handleLogin = (selectedMode) => {
    setMode(selectedMode);
    setPage('dashboard');
    setActiveTab('overview');
    showToast('success', `Welcome! You are now in ${selectedMode === 'business' ? 'Business' : 'Personal'} mode.`);
  };

  const handleLogout = () => {
    setPage('landing');
    setSummary(null);
    setCases([]);
    setPersonalData(null);
    showToast('info', 'Logged out of Recoup session.');
  };

  /**
   * Called after a payment is analyzed or CSV is imported.
   * Refreshes dashboard data so metrics update immediately.
   */
  const handlePaymentAdded = async (result) => {
    showToast('success', result?.imported != null
      ? `Imported ${result.imported} records. Dashboard updated.`
      : 'Payment analyzed and saved. Dashboard updated.');
    await refreshData();
    // If on data-entry sub-view, optionally switch to metrics
    // Keep current tab so user can add more payments
  };

  // ── Render Views ─────────────────────────────────────────────────────────────

  if (page === 'landing') {
    return <LandingPage onStartDemo={handleStartDemo} />;
  }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col">

      {/* Navigation Header */}
      <Navigation
        mode={mode}
        setMode={(m) => {
          setMode(m);
          setActiveTab('overview');
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverStatus={serverStatus}
        dataSource={dataSource}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onLogout={handleLogout}
      />

      {/* Backend Disconnected Warning */}
      {serverStatus === 'disconnected' && (
        <div className="bg-red-600 text-white px-6 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <span>Backend server is not responding. Start the server on port 3001.</span>
          <button onClick={refreshData} className="underline font-bold hover:no-underline">Retry</button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-6 w-full">
        {mode === 'business' ? (
          <>
            {activeTab === 'overview' && (
              <BusinessDashboard
                summary={summary}
                dataSource={dataSource}
                onPaymentAdded={handlePaymentAdded}
                onOpenCase={(id) => setSelectedCaseId(id)}
                onViewQueue={() => setActiveTab('queue')}
                onRefresh={refreshData}
              />
            )}

            {activeTab === 'queue' && (
              <RecoveryQueueEnhanced
                cases={cases}
                onSelectCase={(id) => setSelectedCaseId(id)}
                onRefresh={refreshData}
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
              <PersonalDashboard data={personalData} onRefresh={refreshData} />
            )}

            {activeTab === 'bills' && (
              <PersonalDashboard data={personalData} onRefresh={refreshData} />
            )}

            {activeTab === 'health' && (
              <FinancialHealthPanel mode="personal" />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-4 text-center text-xs text-stone-400 bg-white">
        RECOUP Revenue Recovery & Financial Health Platform © 2026 · Educational Prototype
      </footer>

      {/* Case Detail Modal */}
      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onRefresh={refreshData}
        />
      )}

      {/* Recoup AI Assistant */}
      <RecoupAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />

      {/* Global Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
