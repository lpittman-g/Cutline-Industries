# Stripe — Cutline Thermal checkout

Configure **separate Test and Live** credentials. Never mix `sk_test_` / sandbox keys with live Price IDs or webhook secrets.

## Env vars

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Secret API key (`sk_test_…`, sandbox `rkcs_test_…`, or `sk_live_…`) |
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

## Stripe CLI

This repo includes `@stripe/cli` as a devDependency (Node 18+). Use `npx stripe` / the npm scripts below, or install globally:

```bash
npm install -g @stripe/cli
# upgrade later:
npm update -g @stripe/cli
```

Other platforms / Docker: [Stripe CLI install](https://docs.stripe.com/stripe-cli/install) · [GitHub readme](https://github.com/stripe/stripe-cli#installation) · [CLI reference](https://docs.stripe.com/cli).

### Sandbox (no browser account required)

Agents and scripts should use `--non-interactive`:

```bash
npm run stripe:sandbox
# equivalent:
npx stripe sandbox create --email lpittman@cutline-industries.studio --non-interactive
# or: npx stripe sandbox create --from-git --non-interactive
```

Returns temporary test keys (`secret_key`, `publishable_key`, `claim_url`). Sandboxes expire in **7 days** — claim with `npx stripe sandbox claim` or the claim URL before then.

Already have a Stripe account:

```bash
npx stripe login
# CI / no browser:
npx stripe login --interactive
# or per-command: --api-key $STRIPE_SECRET_KEY
```

### npm scripts

| Script | Purpose |
|--------|---------|
| `npm run stripe:sandbox` | Provision claimable test sandbox |
| `npm run stripe:setup-prices` | Create Gateway $15 / Bounty $50 / Retainer $750/mo Price IDs |
| `npm run stripe:listen` | Forward `checkout.session.completed` → local API |
| `npm run stripe:trigger` | Fire a test `checkout.session.completed` event |
| `npm run stripe:cli -- …` | Pass-through to the Stripe CLI |

## Webhook URL

Production (Amplify must route `/api` to the Express API):

```text
https://cutline-industries.studio/api/stripe/webhook
```

Local development (Stripe CLI):

```bash
npm run stripe:listen
# or:
npx stripe listen --events checkout.session.completed --forward-to localhost:8787/api/stripe/webhook
```

Paste the printed `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET` (or run `npx stripe listen --print-secret`).

### Endpoint settings

- **Events:** `checkout.session.completed` (required; fulfillment runs on paid / no_payment_required)
- **Raw body:** the route is registered **before** `express.json()` in `server/api.ts` — do not move it

## Test vs Live checklist

1. **Test / sandbox** — `npm run stripe:sandbox` (or Dashboard Test mode), copy secret key into `.env`, run `npm run stripe:setup-prices`, run `npm run stripe:listen`, paste `whsec_…`, exercise Checkout.
2. **Live mode** — repeat with Live keys, Live Price IDs, and a Live webhook pointing at `https://cutline-industries.studio/api/stripe/webhook`.
3. Inject Live secrets as **deployment secrets** (Amplify / host env). Never commit keys.

## Create Prices from the CLI

With `STRIPE_SECRET_KEY` in `.env` (test, sandbox, or live):

```bash
npm run stripe:setup-prices
```

Creates (or reuses by lookup key) Gateway $15, Bounty $50, and Retainer $750/mo, then prints the `STRIPE_PRICE_*` lines to paste into `.env`.

## Related

- Checkout + webhook implementation: [`server/stripeCheckout.ts`](../server/stripeCheckout.ts)
- Mission Control flow: [`docs/THERMAL-MISSION-CONTROL.md`](./THERMAL-MISSION-CONTROL.md)
- Auth letter: [`docs/stripe-authorization-letter.html`](./stripe-authorization-letter.html)
- Stripe CLI docs: https://docs.stripe.com/stripe-cli
