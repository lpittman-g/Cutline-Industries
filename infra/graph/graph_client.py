"""Microsoft Graph client for Cutline tenant operations.

Authenticates as the Artemis-Graph-Integration app via client credentials. The
client id, tenant id and secret are read from Key Vault at construction — never
from source, environment, or a conversation.

Covers the directory and mailbox operations this project needs and that the
Artemis service principal cannot do itself (it has Azure RBAC Owner but no Entra
directory rights):

    gc = GraphClient.from_key_vault()
    gc.create_user("admin@CutlineStudios.onmicrosoft.com", "Admin", password)
    gc.assign_license(user_id, sku_id)          # this is what provisions the mailbox
    gc.send_mail(from_user_id, ["x@y.com"], "subject", "body")

Access tokens last about an hour and are cached until shortly before expiry.
"""
from __future__ import annotations

import subprocess
import time
from typing import Any, Optional

import requests

GRAPH = "https://graph.microsoft.com/v1.0"
LOGIN = "https://login.microsoftonline.com"
DEFAULT_VAULT = "cutline-kv-comms"
_EXPIRY_SKEW = 120  # refresh this many seconds before the token actually expires


class GraphError(RuntimeError):
    """A Graph call returned a non-success status. Carries the status and body."""

    def __init__(self, status: int, body: str, method: str, path: str):
        super().__init__(f"{method} {path} -> HTTP {status}: {body[:400]}")
        self.status = status
        self.body = body


def _kv_secret(vault: str, name: str) -> str:
    """Read one secret from Key Vault via the az CLI (uses the ambient login)."""
    out = subprocess.run(
        ["az", "keyvault", "secret", "show", "--vault-name", vault, "--name", name,
         "--query", "value", "-o", "tsv"],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


class GraphClient:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str,
                 session: Optional[requests.Session] = None):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self._secret = client_secret
        self._session = session or requests.Session()
        self._token: Optional[str] = None
        self._expires_at: float = 0.0

    @classmethod
    def from_key_vault(cls, vault: str = DEFAULT_VAULT) -> "GraphClient":
        return cls(
            tenant_id=_kv_secret(vault, "graph-tenant-id"),
            client_id=_kv_secret(vault, "graph-client-id"),
            client_secret=_kv_secret(vault, "graph-client-secret"),
        )

    # ---- auth ---------------------------------------------------------------

    def _needs_token(self, now: Optional[float] = None) -> bool:
        return self._token is None or (now or time.time()) >= self._expires_at - _EXPIRY_SKEW

    def token(self) -> str:
        if not self._needs_token():
            return self._token  # type: ignore[return-value]
        r = self._session.post(
            f"{LOGIN}/{self.tenant_id}/oauth2/v2.0/token",
            data={"grant_type": "client_credentials", "client_id": self.client_id,
                  "client_secret": self._secret, "scope": "https://graph.microsoft.com/.default"},
            timeout=30,
        )
        if r.status_code != 200:
            raise GraphError(r.status_code, r.text, "POST", "oauth2/v2.0/token")
        body = r.json()
        self._token = body["access_token"]
        self._expires_at = time.time() + int(body.get("expires_in", 3600))
        return self._token

    # ---- transport ----------------------------------------------------------

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = path if path.startswith("http") else f"{GRAPH}/{path.lstrip('/')}"
        r = self._session.request(
            method, url,
            headers={"Authorization": f"Bearer {self.token()}", "Content-Type": "application/json"},
            timeout=60, **kwargs,
        )
        if r.status_code >= 400:
            raise GraphError(r.status_code, r.text, method, path)
        if r.status_code == 204 or not r.content:
            return None
        return r.json()

    def paged(self, path: str) -> list[dict]:
        """Follow @odata.nextLink and return every item."""
        items: list[dict] = []
        page = self.request("GET", path)
        while page:
            items.extend(page.get("value", []))
            nxt = page.get("@odata.nextLink")
            page = self.request("GET", nxt) if nxt else None
        return items

    # ---- directory ----------------------------------------------------------

    def get_organization(self) -> dict:
        return self.request("GET", "organization")["value"][0]

    def list_users(self, select: str = "id,displayName,userPrincipalName") -> list[dict]:
        return self.paged(f"users?$select={select}")

    def get_user(self, user: str) -> dict:
        return self.request("GET", f"users/{user}")

    def create_user(self, upn: str, display_name: str, password: str,
                    force_change: bool = True, usage_location: str = "US") -> dict:
        """Create a member user. usage_location is required before a license can be assigned."""
        return self.request("POST", "users", json={
            "accountEnabled": True,
            "displayName": display_name,
            "mailNickname": upn.split("@")[0],
            "userPrincipalName": upn,
            "usageLocation": usage_location,
            "passwordProfile": {"password": password,
                                "forceChangePasswordNextSignIn": force_change},
        })

    def assign_directory_role(self, principal_id: str, role_template_id: str) -> None:
        """Add a principal to a directory role, activating the role if it is not yet instantiated."""
        try:
            self.request("POST", f"directoryRoles/roleTemplateId={role_template_id}/members/$ref",
                         json={"@odata.id": f"{GRAPH}/directoryObjects/{principal_id}"})
        except GraphError as e:
            if e.status != 404:
                raise
            self.request("POST", "directoryRoles", json={"roleTemplateId": role_template_id})
            self.request("POST", f"directoryRoles/roleTemplateId={role_template_id}/members/$ref",
                         json={"@odata.id": f"{GRAPH}/directoryObjects/{principal_id}"})

    # ---- licensing / mailbox ------------------------------------------------

    def list_skus(self) -> list[dict]:
        """Subscribed SKUs with consumed/enabled counts — pick one to provision a mailbox."""
        return self.request("GET", "subscribedSkus")["value"]

    def assign_license(self, user: str, sku_id: str) -> dict:
        """Assign a license. For an Exchange-bearing SKU this is what creates the mailbox."""
        return self.request("POST", f"users/{user}/assignLicense",
                            json={"addLicenses": [{"skuId": sku_id, "disabledPlans": []}],
                                  "removeLicenses": []})

    # ---- mail ---------------------------------------------------------------

    def send_mail(self, from_user: str, to: list[str], subject: str, body: str,
                  html: bool = False, reply_to: Optional[list[str]] = None) -> None:
        message: dict[str, Any] = {
            "subject": subject,
            "body": {"contentType": "HTML" if html else "Text", "content": body},
            "toRecipients": [{"emailAddress": {"address": a}} for a in to],
        }
        if reply_to:
            message["replyTo"] = [{"emailAddress": {"address": a}} for a in reply_to]
        self.request("POST", f"users/{from_user}/sendMail",
                     json={"message": message, "saveToSentItems": True})

    def list_messages(self, user: str, top: int = 25, search: Optional[str] = None) -> list[dict]:
        q = f"users/{user}/messages?$top={top}&$select=subject,from,receivedDateTime,isRead"
        if search:
            q += f'&$search="{search}"'
        return self.request("GET", q).get("value", [])
