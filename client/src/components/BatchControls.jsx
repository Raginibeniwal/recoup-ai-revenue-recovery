import React, { useState } from 'react';

const API = 'http://localhost:3001/api';

export default function BatchControls() {
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    company_name: 'ABC Technologies',
    contact_name: 'Rahul Sharma',
    email: 'rahul@abctech.com',
    invoice_number: 'INV-MANUAL-001',
    amount: '250000',
    issue_date: '2026-08-01',
    due_date: '2026-08-15',
    category: 'Software License',
    payment_reliability: '0.85',
    average_payment_delay: '5',
    risk_level: 'Medium'
  });

  const updateForm = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const generateBatch = async () => {
    setGenerating(true);
    setMessage('');

    try {
      const response = await fetch(`${API}/batch/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 400 })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();

      setMessage(
        `Generated ${result.totalCases} cases • ₹${Number(
          result.totalAtRisk
        ).toLocaleString('en-IN')} at risk`
      );

      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const addInvoice = async (e) => {
    e.preventDefault();

    setAdding(true);
    setMessage('');

    try {
      const response = await fetch(`${API}/invoice/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          payment_reliability: Number(form.payment_reliability),
          average_payment_delay: Number(form.average_payment_delay)
        })
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(text);
      }

      const result = JSON.parse(text);

      console.log('Manual invoice created:', result);

      setMessage('Manual invoice added successfully.');

      setShowForm(false);

      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error('Add invoice error:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const runAgent = async () => {
    setRunning(true);
    setMessage('');

    try {
      const response = await fetch(`${API}/batch/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ useLLM: false })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();

      console.log('Agent completed:', result);

      setMessage('Recovery agent completed successfully.');

      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error('Run agent error:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative">

      <div className="flex items-center space-x-3">

        <button
          onClick={generateBatch}
          disabled={generating || running || adding}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate Batch'}
        </button>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setMessage('');
          }}
          disabled={generating || running || adding}
          className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          + Add Invoice
        </button>

        <button
          onClick={runAgent}
          disabled={generating || running || adding}
          className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Agent'}
        </button>

      </div>

      {message && (
        <div className="mt-2 text-sm text-gray-600">
          {message}
        </div>
      )}

      {showForm && (
        <div className="absolute right-0 top-14 z-50 w-[420px] bg-white border border-gray-200 rounded-xl shadow-xl p-5">

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Add Manual Invoice
            </h2>

            <button
              onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
          </div>

          <form onSubmit={addInvoice} className="space-y-3">

            <input
              name="company_name"
              value={form.company_name}
              onChange={updateForm}
              placeholder="Company Name"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />

            <input
              name="contact_name"
              value={form.contact_name}
              onChange={updateForm}
              placeholder="Contact Name"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />

            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateForm}
              placeholder="Email"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />

            <input
              name="invoice_number"
              value={form.invoice_number}
              onChange={updateForm}
              placeholder="Invoice Number"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />

            <input
              name="amount"
              type="number"
              value={form.amount}
              onChange={updateForm}
              placeholder="Invoice Amount"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />

            <div className="grid grid-cols-2 gap-2">

              <div>
                <label className="text-xs text-gray-500">
                  Issue Date
                </label>
                <input
                  name="issue_date"
                  type="date"
                  value={form.issue_date}
                  onChange={updateForm}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">
                  Due Date
                </label>
                <input
                  name="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={updateForm}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  required
                />
              </div>

            </div>

            <select
              name="category"
              value={form.category}
              onChange={updateForm}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option>Software License</option>
              <option>Consulting Services</option>
              <option>Hardware</option>
              <option>Subscription</option>
            </select>

            <div className="grid grid-cols-2 gap-2">

              <input
                name="payment_reliability"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.payment_reliability}
                onChange={updateForm}
                placeholder="Payment Reliability"
                className="border rounded-md px-3 py-2 text-sm"
              />

              <input
                name="average_payment_delay"
                type="number"
                value={form.average_payment_delay}
                onChange={updateForm}
                placeholder="Avg Delay"
                className="border rounded-md px-3 py-2 text-sm"
              />

            </div>

            <select
              name="risk_level"
              value={form.risk_level}
              onChange={updateForm}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <button
              type="submit"
              disabled={adding}
              className="w-full bg-green-600 text-white py-2 rounded-md font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {adding ? 'Adding Invoice...' : 'Save Invoice'}
            </button>

          </form>
        </div>
      )}
    </div>
  );
}