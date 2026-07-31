# Support Payment Integration

## Environment Variables

- `RAZORPAY_KEY_ID`: Public key shared with clients.
- `RAZORPAY_KEY_SECRET`: Secret key used on the server to create and verify orders.
- `RAZORPAY_WEBHOOK_SECRET`: Secret configured in the Razorpay dashboard for webhook signature verification.
- `SUPPORT_PAYMENT_RECON_INTERVAL_MINUTES` (optional): Interval in minutes for the background reconciliation job (defaults to 30 minutes).
- `SUPPORT_PAYMENT_PENDING_THRESHOLD_MINUTES` (optional): Minimum age in minutes before a `created` payment is picked up by the reconciler (defaults to 10 minutes).
- `SUPPORT_PAYMENT_RECON_BATCH_SIZE` (optional): Maximum number of pending payments processed per reconciliation run (defaults to 25).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: SMTP credentials for sending receipt emails.
- `SMTP_SECURE` (optional): Set to `true` to use TLS/SSL (defaults based on port).
- `SUPPORT_EMAIL_FROM` (or `SMTP_FROM`): The “from” address used in supporter emails.

## Webhook

- Endpoint: `POST /api/support/webhook`
- Content type: `application/json`
- Signature header: `x-razorpay-signature`
- Events handled: `payment.captured`, `payment.failed` (other events are ignored but recorded in metadata).

## Scheduled Reconciliation

- Triggered every `SUPPORT_PAYMENT_RECON_INTERVAL_MINUTES`.
- Attempts to resolve `created` payments older than `SUPPORT_PAYMENT_PENDING_THRESHOLD_MINUTES` by querying Razorpay for payment status.
- Marks payments as `paid` or `failed` based on Razorpay data while keeping metadata history for traceability.

## Receipt Email

- Receipt emails are sent once a payment reaches `paid` status (via API verification, webhook, or reconciliation).
- Emails include a PDF receipt attachment generated server-side.
- Delivery attempts are tracked via `receiptAttempts` and `receiptSentAt` on `SupportPayment`.

