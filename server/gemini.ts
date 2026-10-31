import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db.ts';

export interface ExtractedInvoiceDraft {
  customer_name: string;
  customer_email: string | null;
  description: string;
  currency: string;
  issue_date: string;
  due_date: string;
  notes: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  clarifications_needed: string[];
}

export interface GeminiStatus {
  isConfigured: boolean;
  model: string;
  error?: string;
}

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private readonly model = 'gemini-3.8-flash';

  constructor() {
    this.init();
  }

  private init() {
    const key = process.env.GEMINI_API_KEY;
    if (key && !key.includes('MY_GEMINI')) {
      this.ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!(key && !key.includes('MY_GEMINI'));
  }

  public getStatus(): GeminiStatus {
    const configured = this.isConfigured();
    return {
      isConfigured: configured,
      model: this.model,
      error: configured ? undefined : 'GEMINI_API_KEY is not configured in Secrets.',
    };
  }

  /**
   * Parse natural-language invoice instruction into structured invoice draft.
   */
  public async parseInvoicePrompt(prompt: string): Promise<ExtractedInvoiceDraft> {
    const today = new Date().toISOString().split('T')[0];

    // Fallback rule-based parsing if Gemini API key is not yet configured
    if (!this.ai) {
      return this.fallbackParseInvoicePrompt(prompt, today);
    }

    const systemInstruction = `You are a financial invoice extraction parser for PayPilot.
Your task is to extract structured invoice data from the user's natural language request.
Today's date is ${today}.
Strict rules:
1. Extract customer_name. If an email or parenthetical email is next to the name (e.g. "Priya Sharma (priya.sharma@example.com)"), strip out the email/parentheses so customer_name is just the person's or company's clean name (e.g. "Priya Sharma"). If no customer name is provided, set to "Client".
2. If the user provided a customer email address anywhere in the prompt (including inside parentheses like "(priya.sharma@example.com)" or inline), extract it into customer_email. If NO email was provided in the prompt, customer_email MUST be null. NEVER invent or fabricate an email address.
3. Determine issue_date (defaults to ${today}) and due_date. If relative (e.g. "in 7 days", "due in 14 days", "due 14 days from today", "due next Friday", "due two weeks from today"), calculate the exact YYYY-MM-DD date based on ${today}. The due_date MUST NOT be earlier than issue_date. If earlier, set due_date equal to issue_date.
4. CURRENCY RULES (CRITICAL):
   - Extract the currency explicitly requested in the prompt.
   - Supported currencies in PayPilot: USD, EUR, GBP, CAD, AUD, JPY, CHF.
   - Recognize currency names (Euro, Euros, US Dollar, Dollars, British Pound, Pounds, Canadian Dollar, Australian Dollar, Japanese Yen, Swiss Franc), symbols (€, $, £, ¥, CA$, A$, CHF), and codes (EUR, USD, GBP, CAD, AUD, JPY, CHF).
   - If the user specifies "Euro" or "€", currency MUST be "EUR".
   - If the user specifies "Pound" or "GBP" or "£", currency MUST be "GBP".
   - If the user specifies "Canadian Dollar" or "CAD" or "C$", currency MUST be "CAD".
   - If the user specifies "Australian Dollar" or "AUD" or "A$", currency MUST be "AUD".
   - If the user specifies "Japanese Yen" or "JPY" or "¥" or "Yen", currency MUST be "JPY".
   - If the user specifies "Swiss Franc" or "CHF", currency MUST be "CHF".
   - Default to "USD" ONLY if NO currency symbol, name, or code was mentioned in the prompt.
   - If a supported currency is explicitly mentioned, NEVER default to or override it with USD.
   - Preserve the exact numeric amount without unauthorized conversion (e.g. 450 Euro must be 450 EUR, not converted to USD).
5. SPECIFIC SCOPE & DESCRIPTION:
   - Extract the user's specific invoice description (e.g. "mobile application development services", "React dashboard development and API integration", "website development services").
   - NEVER replace a specific user description with generic placeholder text like "Consulting & Development Services" or "Professional Services".
6. MULTI-ITEM BREAKDOWN (CRITICAL):
   - When the user specifies multiple line items, services, or units (e.g. "Charge 2 units of iOS development at $250 per unit, 1 unit of Android development at $175, and 1 unit of QA testing at $75"), extract EVERY SINGLE individual line item separately in the items array.
   - Each item must have:
     - description: specific line item name (e.g. "iOS development", "Android development", "QA testing")
     - quantity: number of units (e.g. 2, 1, 1)
     - unit_price: rate per unit (e.g. 250, 175, 75)
     - line_total: quantity * unit_price (e.g. 500, 175, 75)
   - NEVER collapse multiple itemized deliverables into a single generic item.
7. If the request is ambiguous or missing critical information, list questions in 'clarifications_needed'.
8. Return strictly valid JSON adhering to the schema.`;

    try {
      const generatePromise = this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING },
              customer_email: { type: Type.STRING, nullable: true },
              description: { type: Type.STRING },
              currency: { type: Type.STRING },
              issue_date: { type: Type.STRING },
              due_date: { type: Type.STRING },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit_price: { type: Type.NUMBER },
                    line_total: { type: Type.NUMBER },
                  },
                  required: ['description', 'quantity', 'unit_price', 'line_total'],
                },
              },
              clarifications_needed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'customer_name',
              'description',
              'currency',
              'issue_date',
              'due_date',
              'items',
              'clarifications_needed',
            ],
          },
        },
      });

      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Gemini API call timed out')), 8000);
      });

      let response: any;
      try {
        response = await Promise.race([generatePromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
      const text = response.text || '{}';
      const parsed = JSON.parse(text);

      // Extract email from prompt if model missed it
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const emailMatch = prompt.match(emailRegex);
      const customerEmail = parsed.customer_email || (emailMatch ? emailMatch[1].trim() : null);

      // Clean customer name
      let customerName = (parsed.customer_name || 'Client')
        .replace(/\s*\([^)]*@[^)]*\)/g, '')
        .replace(/\s*<[^>]*@[^>]*>/g, '')
        .trim();
      if (!customerName || customerName.toLowerCase() === 'client') {
        const extractedName = this.extractCustomerNameFromPrompt(prompt);
        if (extractedName) customerName = extractedName;
      }
      if (!customerName) customerName = 'Client';

      // Specific description preservation
      let invoiceDescription = parsed.description || '';
      const isGeneric =
        !invoiceDescription ||
        ['professional services', 'consulting & development services', 'services rendered', 'service item', 'consulting'].includes(
          invoiceDescription.toLowerCase().trim()
        );
      if (isGeneric) {
        const extracted = this.extractDescriptionFromPrompt(prompt);
        if (extracted) {
          invoiceDescription = extracted;
        } else if (!invoiceDescription) {
          invoiceDescription = 'Professional Services';
        }
      }

      // Validate & clean line items
      const cleanedItems = (parsed.items || []).map((it: any) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.unit_price) || 0;
        let itemDesc = String(it.description || '').trim();
        if (
          !itemDesc ||
          ['service item', 'services rendered', 'consulting & development services', 'professional services'].includes(
            itemDesc.toLowerCase()
          )
        ) {
          itemDesc = invoiceDescription;
        }
        return {
          description: itemDesc,
          quantity: Math.max(0.01, qty),
          unit_price: Math.max(0, price),
          line_total: Math.round(qty * price * 100) / 100,
        };
      });

      if (cleanedItems.length === 0) {
        cleanedItems.push({
          description: invoiceDescription,
          quantity: 1,
          unit_price: 100,
          line_total: 100,
        });
      }

      const issueDate = parsed.issue_date || today;
      let dueDate = parsed.due_date || this.addDays(today, 14);
      if (dueDate < issueDate) {
        dueDate = issueDate;
      }

      // Detect explicit currency from prompt to prevent defaulting to USD when another currency was requested
      const explicitCurrency = this.detectCurrencyFromPrompt(prompt);
      const rawParsedCurrency = parsed.currency ? parsed.currency.toUpperCase().substring(0, 3) : null;
      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];
      let finalCurrency = explicitCurrency || (rawParsedCurrency && validCurrencies.includes(rawParsedCurrency) ? rawParsedCurrency : 'USD');

      return {
        customer_name: customerName,
        customer_email: customerEmail,
        description: invoiceDescription,
        currency: finalCurrency,
        issue_date: issueDate,
        due_date: dueDate,
        notes: parsed.notes || 'Payment terms: Due upon receipt. Powered by PayPal Sandbox.',
        items: cleanedItems,
        clarifications_needed: Array.isArray(parsed.clarifications_needed) ? parsed.clarifications_needed : [],
      };
    } catch (_err) {
      return this.fallbackParseInvoicePrompt(prompt, today);
    }
  }

  public detectCurrencyFromPrompt(text: string): string | null {
    if (!text) return null;
    // Check symbols
    if (text.includes('€')) return 'EUR';
    if (text.includes('£')) return 'GBP';
    if (text.includes('¥')) return 'JPY';
    if (/C\$/i.test(text)) return 'CAD';
    if (/A\$/i.test(text)) return 'AUD';

    // Check words / codes with word boundaries
    if (/\b(euros?|eur)\b/i.test(text)) return 'EUR';
    if (/\b(pounds?|gbp|quid)\b/i.test(text)) return 'GBP';
    if (/\b(yens?|jpy)\b/i.test(text)) return 'JPY';
    if (/\b(canadian dollars?|cad)\b/i.test(text)) return 'CAD';
    if (/\b(australian dollars?|aud)\b/i.test(text)) return 'AUD';
    if (/\b(swiss francs?|chf)\b/i.test(text)) return 'CHF';
    if (/\b(us dollars?|usd)\b/i.test(text)) return 'USD';
    if (text.includes('$') || /\b(dollars?)\b/i.test(text)) return 'USD';

    return null;
  }

  private extractCustomerNameFromPrompt(prompt: string): string | null {
    // 1. Look for "...for <Name> (<email>)..."
    const withEmail = prompt.match(/(?:for|to|client)\s+([A-Z][a-zA-Z0-9\s.]+?)(?:\s*\([^)]*@|\s+<[^>]*@)/i);
    if (withEmail && withEmail[1]) {
      const cand = withEmail[1].trim();
      if (cand && !cand.toLowerCase().startsWith('the') && !cand.toLowerCase().startsWith('create')) {
        return cand;
      }
    }

    // 2. Look for "...for <Name> for <service>..."
    const withService = prompt.match(/(?:for|to|client)\s+([A-Z][a-zA-Z0-9\s.]+?)(?:\s+for\s+|\s+with\s+|\s+due|\s*,\s*due|\.|$)/i);
    if (withService && withService[1]) {
      const cand = withService[1].replace(/\s*\([^)]*\)/g, '').trim();
      if (cand && !cand.toLowerCase().startsWith('the') && !cand.toLowerCase().startsWith('create') && cand.split(/\s+/).length <= 4) {
        return cand;
      }
    }

    return null;
  }

  private extractDescriptionFromPrompt(prompt: string): string | null {
    // 1. Look for: for <Customer> (...) for <description>[. or Include or Charge or due]
    const customerServiceMatch = prompt.match(
      /(?:for|to)\s+[A-Z][a-zA-Z0-9\s.]+?(?:\s*\([^)]*\))?\s+for\s+([^,.;\n]+?)(?:\.|\bInclude\b|\bCharge\b|,\s*due|\s+due|\s+with\s+due|\.$|$)/i
    );
    if (customerServiceMatch && customerServiceMatch[1]) {
      let cand = customerServiceMatch[1].trim();
      // Remove any leading amount/currency prefix like "450 Euro for "
      cand = cand.replace(/^[0-9]+(?:\.[0-9]{1,2})?\s*(?:usd|dollars?|euro|euros?|eur|gbp|pounds?|cad|aud|jpy|chf)?\s+for\s+/i, '');
      if (cand && !/^\$?[0-9]+/i.test(cand) && cand.split(/\s+/).length >= 2) {
        return cand;
      }
    }

    // 2. Look for "...for <amount> for <description>, due..."
    const amountThenForMatch = prompt.match(
      /(?:for|totaling|\$|€|£|¥)\s*[0-9]+(?:\.[0-9]{1,2})?\s*(?:usd|dollars?|euro|euros?|eur|gbp|pounds?|cad|aud|jpy|chf)?\s+(?:for|regarding)\s+([^,.;]+?)(?:,\s*due|\s+due|\.$|$)/i
    );
    if (amountThenForMatch && amountThenForMatch[1].trim()) {
      return amountThenForMatch[1].trim();
    }

    // 3. Look for "...for <description>, due <date>..."
    const forDueMatch = prompt.match(
      /(?:for|regarding)\s+([^,.;]+?)(?:,\s*due|\s+due|\s+with\s+due|\.$|$)/i
    );
    if (forDueMatch && forDueMatch[1].trim()) {
      const descCandidate = forDueMatch[1].trim();
      if (!/^\$?[0-9]+/i.test(descCandidate) && descCandidate.split(/\s+/).length >= 2) {
        return descCandidate;
      }
    }

    // 4. Known specific phrases or technical descriptors
    const techPatterns = [
      /mobile application development services/i,
      /react dashboard development and api integration/i,
      /website development services/i,
      /mobile application development and testing/i,
      /website redesign and performance optimization/i,
      /database migration and api maintenance/i,
    ];
    for (const pattern of techPatterns) {
      const match = prompt.match(pattern);
      if (match) return match[0];
    }

    return null;
  }

  private fallbackParseInvoicePrompt(prompt: string, today: string): ExtractedInvoiceDraft {
    // 1. Extract email address
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = prompt.match(emailRegex);
    const customerEmail = emailMatch ? emailMatch[1].trim() : null;

    // 2. Extract customer name
    const customerName = this.extractCustomerNameFromPrompt(prompt) || 'Client';

    // 3. Extract description
    const specificDesc = this.extractDescriptionFromPrompt(prompt) || 'Professional Services';

    // 4. Extract currency
    const detectedCurrency = this.detectCurrencyFromPrompt(prompt) || 'USD';

    // 5. Extract due date
    let dueDate = this.addDays(today, 14);
    const daysMatch = prompt.match(/(\d+)\s*days?(?:\s+from\s+today)?/i);
    const weeksMatch = prompt.match(/(\d+)\s*weeks?(?:\s+from\s+today)?/i);
    const monthsMatch = prompt.match(/(\d+)\s*months?(?:\s+from\s+today)?/i);

    if (daysMatch) {
      dueDate = this.addDays(today, parseInt(daysMatch[1], 10));
    } else if (weeksMatch) {
      dueDate = this.addDays(today, parseInt(weeksMatch[1], 10) * 7);
    } else if (monthsMatch) {
      dueDate = this.addDays(today, parseInt(monthsMatch[1], 10) * 30);
    } else if (/same day|today/i.test(prompt)) {
      dueDate = today;
    }
    if (dueDate < today) {
      dueDate = today;
    }

    // 6. Extract line items (multi-item parsing)
    // Matches patterns like: "Charge 2 units of iOS development at $250 per unit, 1 unit of Android development at $175, and 1 unit of QA testing at $75"
    const items: { description: string; quantity: number; unit_price: number; line_total: number }[] = [];
    const itemRegex = /(?:charge|include|,|and)?\s*(\d+(?:\.\d+)?)\s*(?:units?|hours?|hrs?|items?|days?|x)?\s*(?:of\s+)?([^,.;@\n]+?)\s*(?:at|@)\s*[\$€£¥A-Z]{0,3}\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s*(?:per\s*(?:unit|hour|hr|item)|[\/](?:unit|hour|hr|item)))?/gi;

    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(prompt)) !== null) {
      const qty = parseFloat(itemMatch[1]) || 1;
      let itemDesc = itemMatch[2].trim();
      // Clean leading conjunctions or verbs
      itemDesc = itemDesc.replace(/^(?:charge|and|include|also)\s+/i, '').trim();

      // Refine with full deliverable name if specifically mentioned in prompt
      if (/ios\s+app\s+development/i.test(prompt) && /ios\s+development/i.test(itemDesc)) {
        itemDesc = 'iOS app development';
      } else if (/android\s+app\s+development/i.test(prompt) && /android\s+development/i.test(itemDesc)) {
        itemDesc = 'Android app development';
      } else if (/qa\s+testing/i.test(prompt) && /qa\s+testing/i.test(itemDesc)) {
        itemDesc = 'QA testing';
      } else if (/frontend\s+website\s+development/i.test(prompt) && /frontend\s+development/i.test(itemDesc)) {
        itemDesc = 'frontend website development';
      } else if (/backend\s+api\s+integration/i.test(prompt) && /backend\s+api\s+integration/i.test(itemDesc)) {
        itemDesc = 'backend API integration';
      } else if (/website\s+testing/i.test(prompt) && /website\s+testing/i.test(itemDesc)) {
        itemDesc = 'website testing';
      }

      const price = parseFloat(itemMatch[3]) || 0;

      if (itemDesc && price > 0) {
        items.push({
          description: itemDesc,
          quantity: qty,
          unit_price: price,
          line_total: Math.round(qty * price * 100) / 100,
        });
      }
    }

    // If no multi-item breakdown found, extract single lump-sum amount
    if (items.length === 0) {
      const amountMatch = prompt.match(/(?:for|totaling|amount\s+of|[\$€£¥])\s*([0-9]+(?:\.[0-9]{1,2})?)/i)
        || prompt.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:euro|euros?|eur|usd|dollars?|gbp|pounds?|cad|aud|jpy|yen|chf)/i)
        || prompt.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 150.0;

      items.push({
        description: specificDesc,
        quantity: 1,
        unit_price: amount,
        line_total: amount,
      });
    }

    const clarifications: string[] = [];
    if (!customerEmail) {
      clarifications.push('Customer email address was not specified. Please verify recipient email before sending.');
    }

    return {
      customer_name: customerName,
      customer_email: customerEmail,
      description: specificDesc,
      currency: detectedCurrency,
      issue_date: today,
      due_date: dueDate,
      notes: 'Payment requested via PayPal Sandbox.',
      items,
      clarifications_needed: clarifications,
    };
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  /**
   * Conversational Assistant: Answers financial questions using grounded database records.
   */
  public async answerFinancialChat(userMessage: string): Promise<string> {
    // 1. Gather database records and metrics deterministically
    const metrics = await db.getDashboardMetrics();
    const invoices = await db.getInvoices();
    const customers = await db.getCustomers();
    const today = new Date().toISOString().split('T')[0];

    const recordsContext = {
      today,
      metrics: {
        total_invoiced_usd: metrics.totalInvoiced,
        amount_received_usd: metrics.amountReceived,
        outstanding_balance_usd: metrics.outstandingBalance,
        overdue_invoices_count: metrics.overdueCount,
        total_invoices_count: metrics.totalInvoicesCount,
        paid_invoices_count: metrics.paidInvoicesCount,
      },
      recent_invoices: invoices.slice(0, 15).map((i) => ({
        invoice_number: i.invoice_number,
        customer_name: i.customer_name,
        total_amount: i.total_amount,
        currency: i.currency,
        status: i.status,
        due_date: i.due_date,
        issue_date: i.issue_date,
        description: i.description,
        paypal_order_id: i.paypal_order_id,
      })),
      customers: customers.map((c) => ({
        name: c.name,
        email: c.email,
        total_invoiced: c.total_invoiced,
        paid_amount: c.paid_amount,
        outstanding: c.outstanding,
      })),
    };

    if (!this.ai) {
      // Deterministic rule-based assistant fallback if Gemini API key is missing
      return this.deterministicChatFallback(userMessage, recordsContext);
    }

    const systemInstruction = `You are PayPilot's intelligent financial assistant for invoices and PayPal payments.
You are provided with real, verified database records below in JSON.
Current date: ${today}

DATABASE RECORDS:
${JSON.stringify(recordsContext, null, 2)}

Strict Guidelines:
1. Base your answer strictly on the provided verified database records.
2. NEVER fabricate invoices, customers, payment IDs, or amounts not present in the data.
3. If the user asks about an invoice or customer that does not exist, clearly say so.
4. Calculate figures using the deterministic numbers provided in the metrics.
5. Provide concise, clear, and actionable answers. Use markdown formatting with bullet points where appropriate.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.2, // Low temperature for high factual accuracy
        },
      });

      return response.text || 'I checked your records, but could not produce a response.';
    } catch (_err) {
      return this.deterministicChatFallback(userMessage, recordsContext);
    }
  }

  private deterministicChatFallback(query: string, ctx: any): string {
    const q = query.toLowerCase();
    const m = ctx.metrics;

    if (q.includes('outstanding') || q.includes('balance') || q.includes('due')) {
      return `According to your current database records, your outstanding balance is **$${m.outstanding_balance_usd.toFixed(2)} USD** across unpaid invoices. There are **${m.overdue_invoices_count}** overdue invoice(s).`;
    }
    if (q.includes('overdue')) {
      const overdueList = ctx.recent_invoices.filter((i: any) => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'draft' && i.due_date < ctx.today));
      if (overdueList.length === 0) {
        return `You have **0 overdue invoices** at this time! All active invoices are currently up to date.`;
      }
      return `You have **${overdueList.length} overdue invoice(s)**:\n` +
        overdueList.map((i: any) => `• **${i.invoice_number}** for **${i.customer_name}**: $${i.total_amount.toFixed(2)} ${i.currency} (Due: ${i.due_date})`).join('\n');
    }
    if (q.includes('received') || q.includes('paid') || q.includes('revenue')) {
      return `Total verified payments received to date: **$${m.amount_received_usd.toFixed(2)} USD** across **${m.paid_invoices_count}** paid invoice(s).`;
    }
    if (q.includes('total') || q.includes('summary')) {
      return `**Financial Summary:**\n• Total Invoiced: $${m.total_invoiced_usd.toFixed(2)} USD\n• Payments Received: $${m.amount_received_usd.toFixed(2)} USD\n• Outstanding: $${m.outstanding_balance_usd.toFixed(2)} USD\n• Overdue Invoices: ${m.overdue_invoices_count}\n• Total Invoices: ${m.total_invoices_count}`;
    }
    return `Here is a summary of your records: Total invoiced is **$${m.total_invoiced_usd.toFixed(2)} USD**, with **$${m.amount_received_usd.toFixed(2)} USD** verified received, and **$${m.outstanding_balance_usd.toFixed(2)} USD** outstanding. Ask me about specific customers or overdue invoices!`;
  }

  /**
   * Draft a polite or firm payment reminder message for an invoice.
   */
  public async draftReminder(invoiceId: string, tone: 'polite' | 'firm' | 'urgent'): Promise<{ subject: string; message: string }> {
    const invoice = await db.getInvoiceById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const today = new Date().toISOString().split('T')[0];
    const isPastDue = invoice.due_date < today;

    if (!this.ai) {
      return this.fallbackReminder(invoice, tone, isPastDue);
    }

    const systemInstruction = `You are a professional business billing specialist for PayPilot.
Draft a ${tone} payment reminder message for an invoice.
Details:
- Invoice Number: ${invoice.invoice_number}
- Customer Name: ${invoice.customer_name || 'Valued Customer'}
- Total Amount: $${invoice.total_amount.toFixed(2)} ${invoice.currency}
- Due Date: ${invoice.due_date} (Today: ${today})
- Status: ${invoice.status} (Is past due: ${isPastDue})
- Payment Link: ${invoice.payment_url || 'Link provided upon request'}

Return strictly JSON with:
{
  "subject": "email subject line",
  "message": "complete formatted reminder message"
}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: `Draft a ${tone} reminder.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              message: { type: Type.STRING },
            },
            required: ['subject', 'message'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        subject: parsed.subject || `Payment Reminder: Invoice ${invoice.invoice_number}`,
        message: parsed.message || this.fallbackReminder(invoice, tone, isPastDue).message,
      };
    } catch (err: any) {
      return this.fallbackReminder(invoice, tone, isPastDue);
    }
  }

  private fallbackReminder(invoice: any, tone: string, isPastDue: boolean) {
    const name = invoice.customer_name || 'Customer';
    const amount = `$${invoice.total_amount.toFixed(2)} ${invoice.currency}`;
    const payLinkText = invoice.payment_url
      ? `You can complete payment directly via PayPal Sandbox here:\n${invoice.payment_url}\n\n`
      : '';

    if (tone === 'urgent' || isPastDue) {
      return {
        subject: `Urgent: Payment Overdue for Invoice ${invoice.invoice_number}`,
        message: `Dear ${name},\n\nThis is an urgent notice regarding Invoice ${invoice.invoice_number} for the amount of ${amount}, which was due on ${invoice.due_date}.\n\n${payLinkText}Please arrange payment promptly or reply if you have questions regarding this invoice.\n\nThank you,\nPayPilot Billing Team`,
      };
    }
    if (tone === 'firm') {
      return {
        subject: `Reminder: Payment Due for Invoice ${invoice.invoice_number}`,
        message: `Hi ${name},\n\nWe are following up on Invoice ${invoice.invoice_number} in the amount of ${amount}, due on ${invoice.due_date}.\n\n${payLinkText}If you have already processed this payment, please disregard this note. Otherwise, we appreciate your prompt remittance.\n\nBest regards,\nPayPilot Billing Team`,
      };
    }
    return {
      subject: `Friendly Reminder: Invoice ${invoice.invoice_number} from PayPilot`,
      message: `Hi ${name},\n\nHope you are having a wonderful week! Just a friendly reminder that Invoice ${invoice.invoice_number} for ${amount} is due on ${invoice.due_date}.\n\n${payLinkText}Please feel free to reach out if you have any questions.\n\nWarm regards,\nPayPilot Billing Team`,
    };
  }
}

export const gemini = new GeminiService();
