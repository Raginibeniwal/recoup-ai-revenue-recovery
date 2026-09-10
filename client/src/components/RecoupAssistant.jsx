import React, { useState } from 'react';
import { X, Bot, Send, Sparkles, User, Database, TrendingUp, HelpCircle } from 'lucide-react';
import api from '../services/api';

export default function RecoupAssistant({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am Recoup Assistant. I only use information actually stored in your database — I will clearly tell you what I know, what I infer, and what I cannot determine.',
      actionTip: 'Select a question below or type your query.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickQuestions = [
    'What should I recover first?',
    'How much revenue is at risk?',
    'Why is my score changing?',
    'Do I have any disputed invoices?'
  ];

  const handleSend = async (questionText) => {
    const query = questionText || input;
    if (!query.trim() || loading) return;

    const userMsg = { sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askAssistant(query);
      const botMsg = {
        sender: 'bot',
        text: res.reply,
        actionTip: res.actionTip,
        knownFacts: res.knownFacts || [],
        inferences: res.inferences || [],
        unknowns: res.unknowns || []
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: 'Sorry, I had trouble retrieving live advice. Please verify the backend server is running.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end font-sans">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between animate-slide-in relative">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Recoup Assistant</h3>
              <p className="text-[11px] text-slate-400">Rule-based · only uses your actual data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                m.sender === 'user' ? 'bg-teal-500 text-slate-950 font-bold text-xs' : 'bg-slate-800 text-teal-400'
              }`}>
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`rounded-2xl max-w-[85%] text-xs leading-relaxed overflow-hidden ${
                m.sender === 'user'
                  ? 'bg-teal-500 text-slate-950 font-medium rounded-tr-none p-4'
                  : 'bg-slate-950 border border-slate-800/80 text-slate-200 rounded-tl-none'
              }`}>
                {m.sender === 'user' ? (
                  <div>{m.text}</div>
                ) : (
                  <>
                    {/* Main reply text */}
                    <div className="p-4 pb-2">{m.text}</div>

                    {/* Structured sections — only shown on bot messages that have them */}
                    {(m.knownFacts?.length > 0 || m.inferences?.length > 0 || m.unknowns?.length > 0) && (
                      <div className="border-t border-slate-800/80 divide-y divide-slate-800/60">

                        {/* KNOWN DATA */}
                        {m.knownFacts?.length > 0 && (
                          <div className="px-4 py-2.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              <Database className="w-3 h-3" /> Known Data
                            </div>
                            {m.knownFacts.map((f, i) => (
                              <div key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                <span className="text-emerald-500 mt-0.5">✓</span> {f}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* INFERRED ANALYSIS */}
                        {m.inferences?.length > 0 && (
                          <div className="px-4 py-2.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                              <TrendingUp className="w-3 h-3" /> Inferred Analysis
                            </div>
                            {m.inferences.map((f, i) => (
                              <div key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                <span className="text-teal-500 mt-0.5">→</span> {f}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* UNKNOWN */}
                        {m.unknowns?.length > 0 && (
                          <div className="px-4 py-2.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <HelpCircle className="w-3 h-3" /> Cannot Determine
                            </div>
                            {m.unknowns.map((f, i) => (
                              <div key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                                <span className="mt-0.5">–</span> {f}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action tip */}
                    {m.actionTip && (
                      <div className="px-4 py-2.5 border-t border-slate-800/80 text-[11px] text-teal-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {m.actionTip}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pl-10">
              <Bot className="w-4 h-4 animate-spin text-teal-400" /> Analyzing your data…
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips & Input */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
          
          <div className="flex flex-wrap gap-1.5">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-500/50 text-slate-300 text-[11px] transition-all"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask Recoup Assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-teal-500 text-slate-950 rounded-xl hover:bg-teal-400 disabled:opacity-50 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
