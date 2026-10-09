#!/bin/bash
# One-time provisioning of the Artemis Graph integration app.
#
# RUN THIS AS A GLOBAL ADMIN (Azure Cloud Shell, signed in as your GA account).
# It cannot run from the Artemis service principal — that SP holds Azure RBAC
# Owner but no Entra directory rights, so `az ad app create` returns
# "Insufficient privileges". Creating an app and consenting to Graph application
# permissions are both directory-admin actions.
#
# The client secret is written straight to Key Vault and never printed.
set -euo pipefail

APP_NAME="${APP_NAME:-Artemis-Graph-Integration}"
VAULT="${VAULT:-cutline-kv-comms}"
GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"   # Microsoft Graph

# Graph APPLICATION permissions (role GUIDs). Trim this list to least privilege:
# every one of these is tenant-wide once consented.
PERMS=(
  "741f803b-c850-494e-b5df-cde7c675a1ca"  # User.ReadWrite.All          - create/update users
  "e2a3a72e-5f79-4c64-b1b1-878b674786c9"  # Mail.ReadWrite              - read/write mailboxes
  "b633e1c5-b582-4048-a93e-9f11b44c7e96"  # Mail.Send                   - send as any user
  "498476ce-e0fe-48b0-b801-37ba7e2685c6"  # Organization.Read.All       - read SKUs/licenses
  # Uncomment only if you need role assignment / full directory writes:
  # "9e3f62cf-ca93-4989-b6ce-bf83c28f9fe8"  # RoleManagement.ReadWrite.Directory
  # "19dbc75e-c2e2-444c-a770-ec69d8559fc7"  # Directory.ReadWrite.All
)

echo "==> Signed in as: $(az ad signed-in-user show --query userPrincipalName -o tsv 2>/dev/null || echo '(not a user — this script needs a GA user, not an SP)')"
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "==> Creating app registration: $APP_NAME"
APP_ID=$(az ad app create --display-name "$APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)
echo "    appId: $APP_ID"

echo "==> Creating service principal for the app"
az ad sp create --id "$APP_ID" --only-show-errors >/dev/null || true

echo "==> Adding Graph application permissions"
for p in "${PERMS[@]}"; do
  az ad app permission add --id "$APP_ID" --api "$GRAPH_APP_ID" \
    --api-permissions "${p}=Role" --only-show-errors
done

echo "==> Granting admin consent (this is the step that actually confers access)"
sleep 15   # let the permission entries replicate before consenting
az ad app permission admin-consent --id "$APP_ID"

echo "==> Creating client secret and storing it in Key Vault '$VAULT' (never printed)"
SECRET=$(az ad app credential reset --id "$APP_ID" --append \
          --display-name "artemis-graph" --years 1 --query password -o tsv)
az keyvault secret set --vault-name "$VAULT" --name graph-client-secret --value "$SECRET" --output none
az keyvault secret set --vault-name "$VAULT" --name graph-client-id     --value "$APP_ID" --output none
az keyvault secret set --vault-name "$VAULT" --name graph-tenant-id     --value "$TENANT_ID" --output none
unset SECRET

cat <<EOF

==> Done.
    appId     : $APP_ID
    tenantId  : $TENANT_ID
    Key Vault : $VAULT  (graph-client-id, graph-tenant-id, graph-client-secret)

Verify consent landed:
  az ad app permission list-grants --id $APP_ID -o table

The client reads all three values from Key Vault:
  python -c "from graph_client import GraphClient; print(GraphClient.from_key_vault().get_organization())"
EOF
