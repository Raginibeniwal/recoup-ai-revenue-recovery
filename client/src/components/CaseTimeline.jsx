import React, { useEffect, useState } from 'react';
import { X, Clock, Target, AlertTriangle, CheckCircle2, XCircle, Search } from 'lucide-react';

export default function CaseTimeline({ caseId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/cases/${caseId}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, [caseId]);

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-end">
      <div className="relative w-full max-w-2xl h-full bg-white shadow-xl animate-slide-in p-6 overflow-y-auto">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>

        <div className="border-b pb-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{data.customer_name}</h2>
          <div className="mt-2 flex space-x-4 text-sm text-gray-500">
            <span>Amount: ₹{data.amount.toLocaleString('en-IN')}</span>
            <span>Reason: {data.failure_reason_code}</span>
            <span>Status: <span className="font-semibold capitalize">{data.status}</span></span>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          Agent Audit Trail
        </h3>

        <div className="relative border-l-2 border-gray-200 ml-3 space-y-8 pb-12">
          {data.audit_log.map((log, idx) => (
            <div key={log.id} className="relative pl-8">
              <div className={`absolute -left-3.5 mt-1.5 w-7 h-7 rounded-full border-4 border-white flex items-center justify-center ${getEventColor(log.event)}`}>
                {getEventIcon(log.event)}
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-900 uppercase text-sm tracking-wider">{log.event.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                
                <p className="text-gray-700 text-sm mb-3">{log.reasoning}</p>

                {log.evidence && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Evidence:</p>
                    <pre className="text-xs bg-gray-100 p-2 rounded text-gray-600 overflow-x-auto">
                      {tryParseJSON(log.evidence)}
                    </pre>
                  </div>
                )}
                
                {log.tool_called && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Tool Called: <span className="text-blue-600 font-mono">{log.tool_called}</span></p>
                    {log.tool_result && (
                      <pre className="text-xs bg-blue-50 p-2 rounded text-blue-800 border border-blue-100 overflow-x-auto mt-1">
                        {tryParseJSON(log.tool_result)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function tryParseJSON(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function getEventColor(event) {
  if (event === 'recovered') return 'bg-green-500';
  if (event === 'escalated') return 'bg-red-500';
  if (event === 'stopped') return 'bg-gray-500';
  if (event === 'execute') return 'bg-purple-500';
  return 'bg-blue-500';
}

function getEventIcon(event) {
  if (event === 'recovered') return <CheckCircle2 className="w-3.5 h-3.5 text-white" />;
  if (event === 'escalated') return <AlertTriangle className="w-3.5 h-3.5 text-white" />;
  if (event === 'stopped') return <XCircle className="w-3.5 h-3.5 text-white" />;
  if (event === 'score') return <Target className="w-3.5 h-3.5 text-white" />;
  return <Clock className="w-3.5 h-3.5 text-white" />;
}
