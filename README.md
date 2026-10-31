# PayPilot — AI-Powered Invoice & PayPal Payment Management

**PayPilot** is an intelligent financial and payment management platform engineered for freelancers, independent developers, consultants, and small businesses. It connects natural-language invoice creation, structured review, and automated PayPal Sandbox checkout and server-verified settlement.

---

## 1. Product Overview

Freelancers and boutique agencies lose hours creating manual invoices, chasing late payments, and calculating outstanding balances. Traditional billing software is either overly complex or detached from the payment gateway.

**PayPilot solves this with a streamlined 4-step workflow:**
1. **Natural-Language Instruction:** Describe an invoice in plain English (e.g., *"Create an invoice for Rahul Sharma for $450 for React dashboard development and API integration, due in 7 days"*).
2. **Structured AI Extraction:** Google Gemini 3.8 Flash extracts customer details, line items, unit prices, due dates, and currencies into a structured, editable draft.
3. **User Review & Approval:** The user verifies or modifies all fields before anything is saved or sent.
4. **PayPal Sandbox Settlement:** PayPilot creates an official PayPal Sandbox checkout order, directs the customer to the sandbox approval experience, verifies the capture server-side against PayPal APIs, and updates the database and dashboard in real-time.

---

## 2. Key Features

- **Natural-Language Invoice Generator:** Powered by server-side Google Gemini 3.8 Flash with strict JSON schema validation.
- **PayPal Sandbox REST Integration:** Real OAuth 2.0 client-credentials token management, Order creation (`/v2/checkout/orders`), and server-side capture verification (`/v2/checkout/orders/{id}/capture`).
- **Grounded AI Financial Assistant:** Conversational query engine that answers questions about revenue, overdue invoices, and customer balances based exclusively on verified database records.
- **Contextual AI Payment Reminders:** Automatically drafts polite, firm, or urgent payment follow-ups tailored to invoice details and days past due.
- **Relational PostgreSQL Architecture:** Ready for Supabase, equipped with decimal-safe financial calculations (`NUMERIC(12, 2)`), foreign keys, and audit logging. Includes resilient in-memory fallback store if database credentials are not yet configured.
- **Customer CRM & Ledger:** Tracks cumulative invoiced totals, verified payments, and outstanding balances per customer.
- **Activity & Audit Trail:** Chronological log of invoice creations, updates, PayPal checkout events, and payment verifications.
- **Integration Status Monitor:** Real-time diagnostics for PostgreSQL, PayPal Sandbox, and Gemini API connectivity.

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS, Lucide Icons, Motion.
- **Backend:** Node.js Express server (`server.ts`) mounting Vite middleware in development and serving static builds in production.
- **Database:** PostgreSQL (Supabase) via official `pg` driver, with UUIDs, decimal precision, foreign key cascades, and check constraints.
- **AI Engine:** Google Gemini API (`@google/genai` v2.4 TypeScript SDK, model: `gemini-3.8-flash`). All calls executed strictly server-side.
- **Payments:** PayPal Sandbox REST APIs (v2 Checkout Orders & Captures).
- **Validation:** Zod schema validation for all incoming API payloads.
- **Testing:** Automated test suite (`tests/business-logic.test.ts`) executed via Node's native test runner (`tsx --test`).

---

## 4. Architecture & Security Flow

```
[User Browser]
      │
      ▼  (HTTP / JSON)
[Express Server (server.ts / server/routes.ts)]
      ├────────────────────────┬─────────────────────────┬───────────────────────┐
      ▼                        ▼                         ▼                       ▼
[Gemini 3.8 Flash]      [PostgreSQL / Supabase]   [PayPal REST API]       [Zod Schema]
• Natural Lang Draft    • Customers & Invoices    • OAuth Token Cache     • Request Validation
• Grounded Chat Q&A     • Payments & Audit Logs   • Order Creation (v2)   • Financial Checks
• Reminder Drafter      • Decimal Precision       • Capture & Verification
```

### Security & Correctness Highlights
- **Zero Client-Side Secrets:** Gemini API keys and PayPal client secrets never reach the browser bundle.
- **No Mock Successes:** An invoice is marked `paid` **only** after the backend verifies a completed capture directly with PayPal REST APIs. Frontend redirects or model predictions are never trusted for payment authorization.
- **Idempotency:** Payment verification checks for existing PayPal capture IDs to prevent duplicate capture or double-counting.
- **Draft Isolation:** Draft invoices are strictly excluded from total invoiced figures and outstanding balance metrics.
- **Safe Modifications:** Issued invoices cannot be silently altered; changes require explicit cancellation or re-issuance workflows.

---

## 5. Environment Variables & Setup

See `.env.example` for reference. Configure these in the **Settings > Secrets** panel in AI Studio or in your `.env` file:

| Variable | Description | Default / Example |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API Key | Automatically injected by AI Studio |
| `APP_URL` | Hosted application URL | Auto-injected in AI Studio |
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres` |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox App Client ID | Obtained from PayPal Developer Dashboard |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox App Secret | Obtained from PayPal Developer Dashboard |
| `PAYPAL_BASE_URL` | PayPal API Endpoint | `https://api-m.sandbox.paypal.com` |

---

## 6. Supabase PostgreSQL Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > Database** and copy your **Node.js Connection String (URI)**.
3. In AI Studio **Settings > Secrets**, set `DATABASE_URL` to your connection string.
4. Open the Supabase **SQL Editor** and run the contents of `server/schema.sql`.
5. Tables created:
   - `customers`
   - `invoices`
   - `invoice_items`
   - `payments`
   - `activity_logs`

*Note: If `DATABASE_URL` is omitted, PayPilot automatically runs with an in-memory database store populated with demo records, so all features remain functional out of the box.*

---

## 7. PayPal Sandbox Credentials Setup

1. Log into the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Navigate to **Apps & Credentials > Sandbox**.
3. Create a new Sandbox App or select your Default Application.
4. Copy the **Client ID** and **Secret**.
5. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in **Settings > Secrets**.
6. In PayPilot, navigate to **Settings & Status** and click **Check Connections** to confirm live Sandbox connectivity.

---

## 8. Development & Testing Commands

```bash
# Run automated business logic tests (100% passing)
npm test

# Run TypeScript linter
npm run lint

# Start full-stack development server (Express + Vite on port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 9. Instructions for Judges to Test PayPilot

1. **Dashboard:** Open the application. Review the financial metrics (Total Invoiced, Payments Received, Outstanding Balance, Overdue Count), recent invoices, and activity feed.
2. **AI Invoice Generation:**
   - Click **Create Invoice**.
   - Under the **AI Prompt** tab, enter: *"Create an invoice for Elena Rostova (elena@technovision.io) for 600 US dollars for mobile responsiveness and performance audit, due in 7 days."*
   - Click **Generate Structured Draft**.
   - Review how Gemini extracts the customer name, email, line items, and relative due date into the editable form.
   - Click **Create & Issue**.
3. **PayPal Sandbox Payment Flow:**
   - In the newly created invoice details page, click **Create PayPal Checkout Link**.
   - PayPilot calls PayPal's `/v2/checkout/orders` endpoint and displays the active order ID and payment link.
   - Click **Open PayPal Checkout** to open the real PayPal Sandbox checkout experience.
   - Log into a PayPal Sandbox personal test buyer account to approve the payment.
   - Return to PayPilot and click **Verify PayPal Payment**.
   - PayPilot calls PayPal to verify the capture, records the payment transaction with capture ID in the database, and transitions invoice status to **Paid**.
4. **AI Assistant:**
   - Navigate to **AI Assistant**.
   - Try suggested prompt: *"Which invoices are currently overdue?"* or *"How much money is outstanding right now?"*
   - Notice the answers are grounded directly in the verified database ledger with zero hallucination.
5. **AI Payment Reminder:**
   - Open any unpaid invoice and click **AI Reminder**.
   - Select **Polite**, **Firm**, or **Urgent** to view customized email text generated with Gemini 3.8 Flash, complete with the PayPal payment link.
6. **Integration Health Check:**
   - Navigate to **Settings & Status** to view live diagnostic cards for PostgreSQL, PayPal Sandbox, and Gemini 3.8 Flash.

---

## 10. AI Tool Disclosure

- **Runtime AI Engine:** PayPilot uses Google Gemini 3.8 Flash via the `@google/genai` TypeScript SDK.
- **Capabilities Powered by AI:**
  1. Natural-language extraction of invoice parameters from unstructured text into structured JSON.
  2. Grounded conversational assistance over verified financial records.
  3. Context-aware payment reminder generation.
- **Human Verification:** All AI-extracted invoice drafts are presented in an interactive review form requiring explicit user confirmation before creation. PayPilot does not represent AI outputs as independently human-verified.

---

## 11. Devpost Submission Description

**Project Title:** PayPilot — AI Invoice & PayPal Payment Management

**Short Tagline:** Effortless AI-assisted invoicing and server-verified PayPal Sandbox settlement for freelancers and small businesses.

**Description:**
PayPilot is an AI-powered billing platform built for the PayPal AI Hackathon. Freelancers simply describe what they worked on in natural language; Gemini 3.8 Flash parses the request into a structured invoice draft with line items, dates, and amounts. With one click, PayPilot issues an official PayPal Sandbox checkout order. When the client approves payment, PayPilot verifies the capture server-side against PayPal REST APIs, registers the transaction in PostgreSQL, and updates dashboard metrics in real time. PayPilot also features an AI financial assistant grounded strictly in verified database records and an AI payment reminder drafter.

---

## 12. 3-Minute Video Demo Script Outline

- **0:00 - 0:30 (Problem & Vision):** Brief intro to PayPilot. Explain the friction freelancers face with invoice creation, chasing payments, and manual tracking.
- **0:30 - 1:15 (AI Invoice Creation):** Demonstrate typing a natural language sentence into PayPilot. Watch Gemini 3.8 Flash extract the customer, amounts, and due dates into the structured draft. Save and issue the invoice.
- **1:15 - 2:05 (PayPal Sandbox Checkout & Verification):** Generate a real PayPal Sandbox order link. Open the sandbox approval window, complete the buyer payment, return to PayPilot, and click "Verify PayPal Payment". Show the invoice status flip to Paid and the transaction logged with its capture ID.
- **2:05 - 2:40 (AI Assistant & Reminders):** Query the AI Assistant with "Which invoices are overdue?" and "Summarize my received payments". Show how answers are grounded in real database figures. Demonstrate the 1-click AI payment reminder drafter.
- **2:40 - 3:00 (Architecture & Conclusion):** Highlight the PostgreSQL database with Supabase schema, server-only secret handling, and 100% passing automated test suite.

---

## 13. Submission Checklist

- [x] Functional web application running in Google AI Studio Build mode.
- [x] Persistent sidebar and responsive drawer navigation.
- [x] All 8 screens implemented: Dashboard, Invoices, Create Invoice, Invoice Details, Customers, AI Assistant, Activity, Settings.
- [x] Supabase PostgreSQL relational schema with `server/schema.sql` and automatic resilient in-memory fallback.
- [x] Real PayPal Sandbox REST API integration (OAuth token flow, order creation, capture verification).
- [x] Server-side Google Gemini 3.8 Flash integration with `@google/genai`.
- [x] 100% automated test suite passing (`npm test`).
- [x] Zero TypeScript errors (`npm run lint`).
- [x] Valid MIT open-source license file (`LICENSE`).
- [x] No API keys or secrets exposed to client-side code.
- [x] Full Devpost description and 3-minute video demo outline included.
