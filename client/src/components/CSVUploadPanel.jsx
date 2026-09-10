import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp, Loader2, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';

const EXPECTED_COLUMNS = [
  { name: 'customer_name', required: true, desc: 'Company or person name' },
  { name: 'invoice_id', required: false, desc: 'Invoice reference number' },
  { name: 'amount', required: true, desc: 'Invoice amount (number)' },
  { name: 'currency', required: false, desc: 'INR, USD, etc. (default: INR)' },
  { name: 'payment_date', required: false, desc: 'YYYY-MM-DD format' },
  { name: 'due_date', required: false, desc: 'YYYY-MM-DD format' },
  { name: 'status', required: false, desc: 'failed / active / overdue / recovered' },
  { name: 'failure_reason', required: false, desc: 'e.g. Insufficient Funds' },
  { name: 'days_overdue', required: false, desc: 'Number of days past due' },
  { name: 'customer_tier', required: false, desc: 'Enterprise / SMB / Startup' },
  { name: 'payment_reliability', required: false, desc: '0 to 1 (e.g. 0.82)' },
  { name: 'dispute_flag', required: false, desc: '0 or 1' },
  { name: 'payment_method', required: false, desc: 'e.g. Bank Transfer' },
];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '') : '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function validateRow(row, idx) {
  const rowNum = idx + 2; // 1-indexed + header row
  const errors = [];

  if (!row.customer_name && !row.company_name) {
    errors.push(`Row ${rowNum}: customer_name is required.`);
  }
  if (!row.amount || row.amount === '') {
    errors.push(`Row ${rowNum}: amount is required.`);
  } else if (isNaN(Number(row.amount))) {
    errors.push(`Row ${rowNum}: Invoice amount must be a number (found: "${row.amount}").`);
  } else if (Number(row.amount) <= 0) {
    errors.push(`Row ${rowNum}: Invoice amount must be greater than 0.`);
  }
  if (row.days_overdue && isNaN(Number(row.days_overdue))) {
    errors.push(`Row ${rowNum}: days_overdue must be a number (found: "${row.days_overdue}").`);
  }
  if (row.payment_reliability && (isNaN(Number(row.payment_reliability)) || Number(row.payment_reliability) < 0 || Number(row.payment_reliability) > 1)) {
    errors.push(`Row ${rowNum}: payment_reliability must be between 0 and 1.`);
  }

  return errors;
}

const SAMPLE_CSV = `customer_name,invoice_id,amount,currency,due_date,status,failure_reason,days_overdue,customer_tier,payment_reliability,dispute_flag
ABC Technologies,INV-1001,85000,INR,2026-08-25,failed,Insufficient Funds,14,Enterprise,0.82,0
XYZ Corp,INV-1002,45000,INR,2026-09-01,failed,Expired Card,7,SMB,0.65,0
Acme Ltd,INV-1003,125000,INR,2026-08-10,failed,Bank Decline,29,Mid-Market,0.70,0
TechStart Inc,INV-1004,22000,INR,2026-09-05,overdue,,,3,Startup,0.55,0
Global Trade,INV-1005,300000,INR,2026-08-01,failed,Customer Dispute,38,Enterprise,0.90,1`;

export default function CSVUploadPanel({ onImportComplete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setValidationErrors(['Please upload a .csv file.']);
      return;
    }
    setFileName(file.name);
    setImportResult(null);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, rows } = parseCSV(text);

      if (rows.length === 0) {
        setValidationErrors(['The CSV file appears to be empty or has no data rows.']);
        return;
      }

      // Validate all rows
      const allErrors = [];
      rows.forEach((row, idx) => {
        allErrors.push(...validateRow(row, idx));
      });

      setParsed({ headers, rows, validRows: rows.filter((_, idx) => validateRow(rows[idx], idx).length === 0) });
      setValidationErrors(allErrors);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setLoading(true);
    try {
      const result = await api.importCSV(parsed.rows);
      setImportResult(result);
      setParsed(null);
      setFileName('');
      if (onImportComplete) onImportComplete(result);
    } catch (err) {
      setValidationErrors([err.message || 'Import failed. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recoup_sample_payments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-teal-700" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-stone-800 text-sm">Upload CSV</h2>
            <p className="text-xs text-stone-500">Bulk-import payment records from a spreadsheet file</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-stone-100 p-5 space-y-4">

          {/* Import Result */}
          {importResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-emerald-800 text-sm">Import Complete</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-center">
                  <div className="text-xl font-black text-emerald-700">{importResult.imported}</div>
                  <div className="text-stone-500">Records imported</div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-stone-200 text-center">
                  <div className={`text-xl font-black ${importResult.failed > 0 ? 'text-red-600' : 'text-stone-400'}`}>{importResult.failed}</div>
                  <div className="text-stone-500">Rows with errors</div>
                </div>
              </div>
              {importResult.totalAmount > 0 && (
                <p className="text-xs text-emerald-700">
                  ₹{Math.round(importResult.totalAmount).toLocaleString('en-IN')} total invoice value added to dashboard.
                </p>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-red-700">Rows with errors (not imported):</p>
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-[11px] text-red-600 font-mono bg-red-50 px-2 py-1 rounded">{e}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => setImportResult(null)}
                className="text-xs text-emerald-700 underline hover:no-underline"
              >
                Upload another file
              </button>
            </div>
          )}

          {!importResult && (
            <>
              {/* Column Spec Toggle */}
              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <button
                  onClick={() => setShowSpec(!showSpec)}
                  className="w-full flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100 transition-colors"
                >
                  <span className="text-xs font-semibold text-stone-600 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Expected CSV Column Format
                  </span>
                  {showSpec ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </button>
                {showSpec && (
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wider px-1">
                      <span>Column Name</span>
                      <span>Required?</span>
                      <span>Description</span>
                    </div>
                    {EXPECTED_COLUMNS.map(col => (
                      <div key={col.name} className="grid grid-cols-3 gap-2 text-xs px-1 py-1 rounded hover:bg-stone-50">
                        <code className="font-mono text-indigo-700 text-[11px]">{col.name}</code>
                        <span className={col.required ? 'text-red-600 font-semibold' : 'text-stone-400'}>
                          {col.required ? 'Required' : 'Optional'}
                        </span>
                        <span className="text-stone-500 text-[11px]">{col.desc}</span>
                      </div>
                    ))}
                    <button
                      onClick={downloadSample}
                      className="mt-2 px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-xs font-semibold hover:bg-teal-50 transition-all flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Download Sample CSV (5 rows)
                    </button>
                  </div>
                )}
              </div>

              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragOver ? 'border-teal-400 bg-teal-50' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
                <Upload className="w-8 h-8 text-stone-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-stone-600">Drag & drop your CSV here</p>
                <p className="text-xs text-stone-400 mt-1">or click to select a file</p>
                {fileName && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs text-stone-700 font-medium">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    {fileName}
                  </div>
                )}
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">{validationErrors.length} validation issue{validationErrors.length > 1 ? 's' : ''} found</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {validationErrors.map((e, i) => (
                      <p key={i} className="text-[11px] text-red-600 font-mono">{e}</p>
                    ))}
                  </div>
                  <p className="text-[11px] text-red-500">Rows with errors will be skipped. Valid rows will still be imported.</p>
                </div>
              )}

              {/* Preview & Confirm */}
              {parsed && parsed.rows.length > 0 && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700">{parsed.rows.length} rows found · {parsed.validRows.length} valid · {parsed.rows.length - parsed.validRows.length} with errors</span>
                    <button onClick={() => { setParsed(null); setFileName(''); setValidationErrors([]); }} className="text-stone-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mini preview table */}
                  <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                    <table className="text-[11px] w-full">
                      <thead>
                        <tr className="bg-stone-100 border-b border-stone-200">
                          {parsed.headers.slice(0, 5).map(h => (
                            <th key={h} className="px-2.5 py-1.5 text-left font-semibold text-stone-500">{h}</th>
                          ))}
                          {parsed.headers.length > 5 && <th className="px-2.5 py-1.5 text-stone-400">+{parsed.headers.length - 5} more</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-stone-100 last:border-0">
                            {parsed.headers.slice(0, 5).map(h => (
                              <td key={h} className="px-2.5 py-1.5 text-stone-700">{row[h] || '—'}</td>
                            ))}
                            {parsed.headers.length > 5 && <td className="px-2.5 py-1.5 text-stone-400">…</td>}
                          </tr>
                        ))}
                        {parsed.rows.length > 3 && (
                          <tr><td colSpan={6} className="px-2.5 py-1.5 text-stone-400 text-center">… and {parsed.rows.length - 3} more rows</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <button
                    id="confirm_import_btn"
                    onClick={handleImport}
                    disabled={loading || parsed.validRows.length === 0}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing {parsed.validRows.length} records...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Import {parsed.validRows.length} Valid Records</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
