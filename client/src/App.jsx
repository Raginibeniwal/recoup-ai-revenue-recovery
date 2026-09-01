import React from 'react';
import BatchControls from './components/BatchControls';
import DashboardHeader from './components/DashboardHeader';
import ComparisonChart from './components/ComparisonChart';
import RecoveryQueue from './components/RecoveryQueue';
import AnalyticsPanel from './components/AnalyticsPanel';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Recoup AI Agent</h1>
          <BatchControls />
        </header>

        <DashboardHeader />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ComparisonChart />
            <RecoveryQueue />
          </div>
          <div className="space-y-6">
            <AnalyticsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
