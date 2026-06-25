export type CommerceFixPlan = "Repair Lite" | "Repair Pro";

export type PaymentProvider = "paypal";

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

export type PaymentPaidEvent = {
  event_type: "payment_paid";
  business_id: "commercefix";
  created_at: string;
  source: PaymentProvider;
  payload: {
    scan_id: string;
    order_id: string;
    payer_email: string;
    plan: CommerceFixPlan;
    amount: string;
    currency: string;
    payment_status: "paid";
    provider_capture_id: string;
    provider_order_id?: string;
  };
};

export type DeliverySentEvent = {
  event_type: "delivery_sent";
  business_id: "commercefix";
  created_at: string;
  payload: {
    scan_id: string;
    order_id: string;
    payer_email: string;
    delivery_status: "sent";
    package_path: string;
    download_url?: string;
    files: string[];
  };
};

export type DeliveryFailedEvent = {
  event_type: "delivery_failed";
  business_id: "commercefix";
  created_at: string;
  payload: {
    scan_id: string;
    order_id: string;
    payer_email?: string;
    reason:
      | "paypal_signature_invalid"
      | "payment_not_completed"
      | "order_not_found"
      | "csv_not_found"
      | "row_limit_exceeded"
      | "repair_generation_failed"
      | "email_delivery_failed";
    customer_visible_message: string;
  };
};

export type MailIntakeCreatedEvent = {
  event_type: "mail_intake_created";
  business_id: "commercefix";
  created_at: string;
  payload: {
    intake_id: string;
    mail_uid: string;
    from_email?: string;
    subject?: string;
    csv_file_name?: string;
    order_id?: string;
    scan_id?: string;
    status: "pending_payment" | "ignored" | "failed";
    reason?: "no_csv_attachment" | "csv_parse_failed" | "already_processed";
  };
};

export type StoredOrder = {
  business_id: "commercefix";
  scan_id: string;
  order_id: string;
  plan: CommerceFixPlan;
  payer_email?: string;
  amount: string;
  currency: string;
  payment_provider: PaymentProvider;
  payment_status: PaymentStatus;
  provider_order_id?: string;
  provider_capture_id?: string;
  csv_storage_path: string;
  original_file_name: string;
  created_at: string;
  paid_at?: string;
  delivered_at?: string;
  delivery_email?: string;
  package_path?: string;
  download_url?: string;
  intake_source?: "web_upload" | "email";
  intake_id?: string;
  mail_uid?: string;
  customer_note?: string;
};

export type AutomationConfig = {
  paypalEnv: "sandbox" | "live";
  paypalClientId: string;
  paypalClientSecret: string;
  paypalWebhookId: string;
  paypalCurrency: string;
  paypalLitePrice: string;
  paypalProPrice: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpAppPassword: string;
  gmailProxyUrl?: string;
  deliveryFrom: string;
  deliveryReplyTo: string;
  orderStorageDir: string;
  csvStorageDir: string;
  packageStorageDir: string;
  downloadBaseUrl?: string;
  packageRetentionHours: number;
  publicBaseUrl: string;
  serverPort: number;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapAppPassword: string;
  imapMailbox: string;
  imapSearchQuery: string;
  imapMaxMessages: number;
  imapDefaultPlan: CommerceFixPlan;
  imapCheckpointPath: string;
};

export type PayPalWebhookHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};
