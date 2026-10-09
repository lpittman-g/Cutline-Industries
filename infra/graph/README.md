# Artemis Graph integration

Microsoft Graph access for Cutline tenant operations — creating users, provisioning
mailboxes, assigning directory roles, and sending mail as the tenant.

## Why this exists

The Artemis service principal (`49ea47e1…`) holds **Azure RBAC Owner** on the
subscription but **no Entra directory rights**. Every directory call it makes returns
`Insufficient privileges` — including `az ad app create`. So the app registration has
to be created once by a Global Admin; after that, this client runs as the app and the
SP is no longer in the path.

## Setup (once, as a Global Admin)

```bash
# In Cloud Shell, signed in as your GA account — NOT the service principal
bash provision-app.sh
```

It creates the app registration, adds Graph **application** permissions, grants admin
consent, mints a client secret, and writes `graph-client-id`, `graph-tenant-id` and
`graph-client-secret` into Key Vault `cutline-kv-comms`. The secret is never printed.

Review `PERMS` in the script before running — each entry is a tenant-wide permission
once consented. The default set is deliberately narrow:

| Permission | Why |
|---|---|
| `User.ReadWrite.All` | create and update users |
| `Mail.ReadWrite` | read/write mailboxes |
| `Mail.Send` | send as a user |
| `Organization.Read.All` | read subscribed SKUs for licensing |

`RoleManagement.ReadWrite.Directory` and `Directory.ReadWrite.All` are commented out —
uncomment only if you actually need role assignment or broad directory writes.

## Usage

```python
from graph_client import GraphClient

gc = GraphClient.from_key_vault()          # reads all three values from Key Vault

gc.get_organization()
gc.list_users()

user = gc.create_user("admin@CutlineStudios.onmicrosoft.com", "Admin", password)
sku  = next(s for s in gc.list_skus() if s["prepaidUnits"]["enabled"] > s["consumedUnits"])
gc.assign_license(user["id"], sku["skuId"])   # an Exchange SKU provisions the mailbox

gc.send_mail(user["id"], ["partner@example.com"], "Subject", "Body",
             reply_to=["lpittman@cutline-industries.studio"])
```

Tokens last ~1 hour and are cached until shortly before expiry; `GraphError` carries
the HTTP status and response body so failures are diagnosable.

## Tests

```bash
python -m pytest test_graph_client.py -q     # 10 hermetic tests, no network
```

## Known constraint

The tenant previously hit **"directory object quota exceeded"**, which blocks creating
new directory objects (managed identities, and possibly this app). Verifying the
`cutline-industries.studio` domain is what lifts that ceiling. If `provision-app.sh`
fails on quota rather than privileges, that is the cause.
