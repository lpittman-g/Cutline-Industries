# Stripe — Cutline Thermal checkout

Configure **separate Test and Live** credentials. Never mix `sk_test_` with live Price IDs or webhook secrets.

## Env vars

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Secret API key (`sk_test_…` or `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Endpoint signing secret (`whsec_…`) |
| `STRIPE_PRICE_GATEWAY` | One-time **$15** Price ID (gateway claim) |
| `STRIPE_PRICE_BOUNTY` | One-time **$50** Price ID (bounty claim) |
| `STRIPE_PRICE_RETAINER` | Recurring subscription Price ID (indie-dev retainer) |

Optional amount overrides (cents) if you omit Price IDs and use `price_data`:

```bash
# STRIPE_GATEWAY_AMOUNT_CENTS=1500
# STRIPE_BOUNTY_AMOUNT_CENTS=5000
# STRIPE_RETAINER_AMOUNT_CENTS=75000
```

Without `STRIPE_SECRET_KEY`, checkout returns **503**; seed/demo UI still loads.

## Dashboard links

| Resource | URL |
|----------|-----|
| API keys | https://dashboard.stripe.com/apikeys |
| Webhook endpoints & signing secrets | https://dashboard.stripe.com/webhooks |
| Products and prices | https://dashboard.stripe.com/products |

Toggle **Test mode** / **Live mode** in the Dashboard before copying each set of values.

## Webhook URL

Production / Amplify (same origin as the site — Vite proxies `/api` locally; production must route `/api` to the Express API):

```text
https://cutline-industries.studio/api/stripe/webhook
```

Local development (Stripe CLI):

```bash
stripe listen --forward-to localhost:8787/api/stripe/webhook
```

Paste the CLI `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET`.

### Endpoint settings

- **Events:** `checkout.session.completed` (required; fulfillment runs on paid / no_payment_required)
- **Raw body:** the route is registered **before** `express.json()` in `server/api.ts` — do not move it

## Test vs Live checklist

1. **Test mode** — create Products/Prices (or run `npm run stripe:setup-prices`), copy `sk_test_…`, create a webhook (or use `stripe listen`), set all five env vars, run a test Checkout.
2. **Live mode** — repeat with Live keys, Live Price IDs, and a Live webhook pointing at `https://cutline-industries.studio/api/stripe/webhook`.
3. Inject Live secrets as **deployment secrets** (Amplify / host env). Never commit keys.

## Create Prices from the CLI

With `STRIPE_SECRET_KEY` in `.env` (test or live):

```bash
npm run stripe:setup-prices
```

Creates (or reuses by lookup key) Gateway $15, Bounty $50, and Retainer $750/mo, then prints the `STRIPE_PRICE_*` lines to paste into `.env`.

## Related

- Checkout + webhook implementation: [`server/stripeCheckout.ts`](../server/stripeCheckout.ts)
- Mission Control flow: [`docs/THERMAL-MISSION-CONTROL.md`](./THERMAL-MISSION-CONTROL.md)
- Auth letter: [`docs/stripe-authorization-letter.html`](./stripe-authorization-letter.html)
