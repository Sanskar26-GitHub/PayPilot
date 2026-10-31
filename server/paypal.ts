import type { Invoice } from './types.ts';

export interface PayPalStatus {
  isConfigured: boolean;
  reachable: boolean;
  baseUrl: string;
  clientIdMasked: string | null;
  error?: string;
}

export interface PayPalOrderResult {
  orderId: string;
  approvalUrl: string;
  status: string;
}

export interface PayPalCaptureResult {
  orderId: string;
  captureId: string;
  status: string;
  amount: number;
  currency: string;
  payerEmail?: string;
  verifiedAt: string;
}

class PayPalService {
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private baseUrl: string = 'https://api-m.sandbox.paypal.com';
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor() {
    this.refreshConfig();
  }

  public refreshConfig() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || null;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || null;
    this.baseUrl = (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/+$/, '');

    // Reset token if config changed
    this.cachedToken = null;
  }

  public isConfigured(): boolean {
    this.refreshConfig();
    return !!(
      this.clientId &&
      this.clientSecret &&
      !this.clientId.includes('MY_PAYPAL') &&
      !this.clientSecret.includes('MY_PAYPAL')
    );
  }

  public async getStatus(): Promise<PayPalStatus> {
    const configured = this.isConfigured();
    const maskedId = this.clientId
      ? `${this.clientId.substring(0, 6)}...${this.clientId.substring(this.clientId.length - 4)}`
      : null;

    if (!configured) {
      return {
        isConfigured: false,
        reachable: false,
        baseUrl: this.baseUrl,
        clientIdMasked: null,
        error: 'PayPal Sandbox credentials (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET) not configured in Secrets.',
      };
    }

    try {
      await this.getAccessToken();
      return {
        isConfigured: true,
        reachable: true,
        baseUrl: this.baseUrl,
        clientIdMasked: maskedId,
      };
    } catch (err: any) {
      return {
        isConfigured: true,
        reachable: false,
        baseUrl: this.baseUrl,
        clientIdMasked: maskedId,
        error: `Failed to authenticate with PayPal Sandbox: ${err.message}`,
      };
    }
  }

  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'PayPal Sandbox credentials not configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to environment/secrets.'
      );
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.token;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal OAuth failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    return this.cachedToken.token;
  }

  /**
   * Create a real PayPal Sandbox Checkout Order for an invoice.
   * Uses the PayPal Orders v2 API with reference to our invoice.
   */
  public async createOrderForInvoice(
    invoice: Invoice,
    returnUrl: string,
    cancelUrl: string
  ): Promise<PayPalOrderResult> {
    const accessToken = await this.getAccessToken();

    const items = (invoice.items || []).map((it) => ({
      name: it.description.substring(0, 127),
      quantity: Math.max(1, Math.round(it.quantity)).toString(),
      unit_amount: {
        currency_code: invoice.currency,
        value: it.unit_price.toFixed(2),
      },
    }));

    // If no items, provide a default summary line item
    const lineItems =
      items.length > 0
        ? items
        : [
            {
              name: invoice.description.substring(0, 127) || 'Invoice Services',
              quantity: '1',
              unit_amount: {
                currency_code: invoice.currency,
                value: invoice.total_amount.toFixed(2),
              },
            },
          ];

    // Calculate sum of items
    const itemTotalValue = lineItems
      .reduce((sum, item) => sum + parseFloat(item.unit_amount.value) * parseInt(item.quantity, 10), 0)
      .toFixed(2);

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: invoice.id,
          custom_id: invoice.invoice_number,
          invoice_id: `${invoice.invoice_number}-${Date.now().toString().slice(-4)}`,
          description: (invoice.description || `Invoice ${invoice.invoice_number}`).substring(0, 127),
          amount: {
            currency_code: invoice.currency,
            value: itemTotalValue,
            breakdown: {
              item_total: {
                currency_code: invoice.currency,
                value: itemTotalValue,
              },
            },
          },
          items: lineItems,
        },
      ],
      application_context: {
        brand_name: 'PayPilot',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `paypilot-${invoice.id}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`PayPal Order Creation failed (HTTP ${res.status}): ${errBody}`);
    }

    const orderData = await res.json();
    const approveLink = orderData.links?.find(
      (l: { rel: string; href: string }) => l.rel === 'approve' || l.rel === 'payer-action'
    );

    if (!approveLink || !approveLink.href) {
      throw new Error('PayPal did not return an approval URL for this order.');
    }

    return {
      orderId: orderData.id,
      approvalUrl: approveLink.href,
      status: orderData.status,
    };
  }

  /**
   * Verify and Capture a PayPal Order.
   * Checks order status on PayPal servers and captures payment if approved.
   */
  public async verifyAndCaptureOrder(orderId: string): Promise<PayPalCaptureResult> {
    const accessToken = await this.getAccessToken();

    // 1. Fetch current order state from PayPal
    const getRes = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getRes.ok) {
      const err = await getRes.text();
      throw new Error(`Failed to retrieve PayPal Order ${orderId} (HTTP ${getRes.status}): ${err}`);
    }

    const order = await getRes.json();

    // If order is already completed/captured, retrieve the existing capture details
    if (order.status === 'COMPLETED') {
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      if (capture) {
        return {
          orderId,
          captureId: capture.id,
          status: capture.status,
          amount: parseFloat(capture.amount.value),
          currency: capture.amount.currency_code,
          payerEmail: order.payer?.email_address,
          verifiedAt: capture.create_time || new Date().toISOString(),
        };
      }
    }

    // If order is APPROVED, capture the funds
    if (order.status === 'APPROVED') {
      const capRes = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `capture-${orderId}`,
        },
        body: '{}',
      });

      if (!capRes.ok) {
        const err = await capRes.text();
        throw new Error(`Failed to capture PayPal Order ${orderId} (HTTP ${capRes.status}): ${err}`);
      }

      const capData = await capRes.json();
      const capture = capData.purchase_units?.[0]?.payments?.captures?.[0];

      if (!capture || capture.status !== 'COMPLETED') {
        throw new Error(
          `Payment capture incomplete or not confirmed. Current status: ${capture?.status || capData.status}`
        );
      }

      return {
        orderId,
        captureId: capture.id,
        status: capture.status,
        amount: parseFloat(capture.amount.value),
        currency: capture.amount.currency_code,
        payerEmail: capData.payer?.email_address,
        verifiedAt: capture.create_time || new Date().toISOString(),
      };
    }

    throw new Error(
      `PayPal Order ${orderId} has status '${order.status}'. Payment must be approved by the customer in PayPal Sandbox before it can be verified.`
    );
  }
}

export const paypal = new PayPalService();
