import React, { useEffect, useState } from 'react';
import CaseTimeline from './CaseTimeline';

export default function RecoveryQueue() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/cases')
      .then(res => res.json())
      .then(setCases)
      .catch(console.error);
  }, []);

  if (!cases.length) return null;

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-yellow-100 text-yellow-800',
      recovered: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800'
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status]}`}>{status}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800">Recovery Queue (ERV Ranked)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failure Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prob.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ERV</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cases.slice(0, 100).map((c) => (
              <tr key={c.case_id} onClick={() => setSelectedCase(c.case_id)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.customer_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{c.amount.toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.failure_reason_code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(c.recovery_probability * 100).toFixed(0)}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">₹{c.erv.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(c.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCase && <CaseTimeline caseId={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}
