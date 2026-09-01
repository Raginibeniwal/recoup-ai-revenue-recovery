# Recoup AI Agent

An AI-powered B2B revenue recovery system that detects at-risk invoices and autonomously chases them using a deterministic decision engine and simulated state machine. Built for the **AI Revenue Recovery** track.

## What it does

Recoup identifies overdue invoices and runs an automated, adaptive workflow to recover them without human intervention. Instead of sending generic reminders, it analyzes customer payment behavior, prioritizes high-value cases, selects the best intervention strategy, tracks promises to pay, and knows when to stop or escalate.

## Problem

B2B revenue collection is heavily manual. Outstanding receivables lock up cash flow, but treating every late invoice exactly the same (e.g., sending a generic reminder on day 15) damages relationships with good customers and fails to recover money from chronic late payers.

## Solution

A smart, bounded agent that acts like a tireless AR (Accounts Receivable) clerk. It looks at the invoice context (days overdue, dispute flags) and customer context (payment reliability, average delay, tier) to decide what to do next.

## Architecture

- **Frontend:** React + Vite + Tailwind v4 + Recharts
- **Backend:** Node.js + Express
- **Database:** SQLite (in-memory/file-based for easy demoing)

## Recovery Decision Flow (Phase 2)

The `agent/engine.js` diagnoses the case and calculates:
1. **Diagnosis:** (e.g., `RECENTLY_OVERDUE`, `CHRONIC_LATE_PAYER`, `PROMISE_BROKEN`)
2. **Recovery Probability:** 0–100% based on reliability and penalties.
3. **Expected Recovery Value (ERV):** Probability × Amount.
4. **Action:** Selects the best action (Reminder, Follow-up, Escalate, etc.).

## Action Execution & Orchestration (Phase 3)

The `agent/orchestrator.js` drives the lifecycle:
- Executes actions deterministically.
- Generates a simulated response from the customer (Payment, Promise, Ignore).
- Adapts on failures (up to a max iteration limit).
- Handles the full lifecycle of a "Promise to Pay."
- Maintains a strict, queryable audit timeline.

## Running Locally

**Backend:**
```bash
cd server
npm install
npm run dev
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

## Demo Flow

1. **Generate Batch:** Click "Generate Batch" to populate the database with synthetic B2B data (including specific edge cases like disputes and high-value accounts).
2. **Review At-Risk:** See the total revenue at risk in the dashboard.
3. **Manual Invoice:** (Optional) Add a manual invoice using the "+ Add Invoice" modal to prove persistence.
4. **Run Agent:** Click "Run Agent" to process the entire active queue.
5. **Observe:** The orchestrator will determine actions, simulate outcomes, and adapt.
6. **Results:** Compare the AI recovery metrics versus the baseline performance.
7. **Timeline:** Click on any case ID in the queue to inspect the step-by-step audit trail.

## Important Note

The recovery outcomes are deterministic simulations designed for hackathon demonstration and evaluation. The system operates entirely without an external LLM, using a robust rule-based engine to guarantee reproducibility and offline capabilities.
