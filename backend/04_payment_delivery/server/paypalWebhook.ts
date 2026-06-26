import type { AutomationConfig, CommerceFixPlan, PaymentPaidEvent, PayPalWebhookHeaders } from "./automationTypes";

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: {
      value?: string;
      currency_code?: string;
    };
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
    custom_id?: string;
    invoice_id?: string;
    payer?: {
      email_address?: string;
    };
    payee?: {
      email_address?: string;
    };
  };
};

export async function verifyPayPalWebhookSignature(args: {
  config: AutomationConfig;
  headers: PayPalWebhookHeaders;
  rawBody: string;
}) {
  const accessToken = await getPayPalAccessToken(args.config);
  const response = await fetch(`${paypalApiBase(args.config)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      auth_algo: args.headers.authAlgo,
      cert_url: args.headers.certUrl,
      transmission_id: args.headers.transmissionId,
      transmission_sig: args.headers.transmissionSig,
      transmission_time: args.headers.transmissionTime,
      webhook_id: args.config.paypalWebhookId,
      webhook_event: JSON.parse(args.rawBody)
    })
  });

  if (!response.ok) {
    throw new Error(`PayPal signature verification request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { verification_status?: string };
  return payload.verification_status === "SUCCESS";
}

export async function createPayPalCheckout(args: {
  config: AutomationConfig;
  orderId: string;
  scanId: string;
  plan: CommerceFixPlan;
  amount: string;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const accessToken = await getPayPalAccessToken(args.config);
  const response = await fetch(`${paypalApiBase(args.config)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: args.orderId,
          custom_id: args.scanId,
          invoice_id: args.orderId,
          description: `CommerceFix ${args.plan} Shopify CSV repair package`,
          amount: {
            currency_code: args.currency,
            value: args.amount
          }
        }
      ],
      application_context: {
        brand_name: "CommerceFix",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: args.returnUrl,
        cancel_url: args.cancelUrl
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal order creation failed: ${response.status} ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    id?: string;
    status?: string;
    links?: Array<{ href: string; rel: string; method?: string }>;
  };
  const approveUrl = payload.links?.find((link) => link.rel === "approve")?.href;
  if (!payload.id || !approveUrl) throw new Error("PayPal order response did not include id and approve link.");

  return {
    providerOrderId: payload.id,
    approveUrl,
    status: payload.status ?? "CREATED"
  };
}

export function paymentPaidEventFromPayPal(rawBody: string): PaymentPaidEvent | null {
  const event = JSON.parse(rawBody) as PayPalWebhookEvent;
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return null;
  if (event.resource?.status !== "COMPLETED") return null;

  const amount = event.resource.amount?.value;
  const currency = event.resource.amount?.currency_code;
  const payerEmail = event.resource.payer?.email_address;
  const providerOrderId = event.resource.supplementary_data?.related_ids?.order_id;
  const orderId = event.resource.invoice_id ?? providerOrderId;
  const captureId = event.resource.id;
  const scanId = event.resource.custom_id;
  const plan = planFromCustomId(scanId);

  if (!amount || !currency || !payerEmail || !orderId || !captureId || !scanId || !plan) {
    throw new Error("PayPal capture event is missing required CommerceFix metadata.");
  }

  return {
    event_type: "payment_paid",
    business_id: "commercefix",
    created_at: event.create_time ?? new Date().toISOString(),
    source: "paypal",
    payload: {
      scan_id: scanId,
      order_id: orderId,
      payer_email: payerEmail,
      plan,
      amount,
      currency,
      payment_status: "paid",
      provider_capture_id: captureId,
      provider_order_id: providerOrderId
    }
  };
}

export function planFromCustomId(customId: string | undefined): CommerceFixPlan | null {
  if (!customId) return null;
  if (customId.includes("repair_lite") || customId.includes("lite")) return "Repair Lite";
  if (customId.includes("repair_pro") || customId.includes("pro")) return "Repair Pro";
  return null;
}

async function getPayPalAccessToken(config: AutomationConfig) {
  const credentials = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString("base64");
  const response = await fetch(`${paypalApiBase(config)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error(`PayPal OAuth request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("PayPal OAuth response did not include access_token.");
  return payload.access_token;
}

function paypalApiBase(config: AutomationConfig) {
  return config.paypalEnv === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}
