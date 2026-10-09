"""Hermetic tests for the Graph client — no network, no Key Vault, no real tenant."""
import json

import pytest

from graph_client import GraphClient, GraphError


class FakeResponse:
    def __init__(self, status=200, body=None, text=""):
        self.status_code = status
        self._body = body
        self.text = text or (json.dumps(body) if body is not None else "")
        self.content = self.text.encode()

    def json(self):
        return self._body


class FakeSession:
    """Records calls; returns queued responses. Token posts are answered separately."""

    def __init__(self, responses=None, token_expires_in=3600):
        self.responses = list(responses or [])
        self.calls = []
        self.token_posts = 0
        self.token_expires_in = token_expires_in

    def post(self, url, data=None, timeout=None):
        self.token_posts += 1
        return FakeResponse(200, {"access_token": f"tok{self.token_posts}",
                                  "expires_in": self.token_expires_in})

    def request(self, method, url, headers=None, timeout=None, **kw):
        self.calls.append({"method": method, "url": url, "json": kw.get("json"),
                           "auth": (headers or {}).get("Authorization")})
        return self.responses.pop(0) if self.responses else FakeResponse(204)


def client(session):
    return GraphClient("tenant", "clientid", "secret", session=session)


def test_token_is_cached_across_calls():
    s = FakeSession([FakeResponse(200, {"value": []}), FakeResponse(200, {"value": []})])
    gc = client(s)
    gc.request("GET", "users")
    gc.request("GET", "users")
    assert s.token_posts == 1          # fetched once, reused
    assert s.calls[1]["auth"] == "Bearer tok1"


def test_token_refetched_when_near_expiry():
    # expires_in below the 120s skew means every call must re-fetch
    s = FakeSession([FakeResponse(200, {"value": []}), FakeResponse(200, {"value": []})],
                    token_expires_in=10)
    gc = client(s)
    gc.request("GET", "users")
    gc.request("GET", "users")
    assert s.token_posts == 2
    assert s.calls[1]["auth"] == "Bearer tok2"


def test_error_status_raises_with_detail():
    s = FakeSession([FakeResponse(403, None, text="Insufficient privileges")])
    with pytest.raises(GraphError) as e:
        client(s).request("GET", "users")
    assert e.value.status == 403
    assert "Insufficient privileges" in e.value.body


def test_204_returns_none():
    assert client(FakeSession([FakeResponse(204)])).request("DELETE", "users/x") is None


def test_paged_follows_nextlink():
    s = FakeSession([
        FakeResponse(200, {"value": [{"id": 1}], "@odata.nextLink": "https://graph/next"}),
        FakeResponse(200, {"value": [{"id": 2}]}),
    ])
    assert [u["id"] for u in client(s).paged("users")] == [1, 2]
    assert s.calls[1]["url"] == "https://graph/next"   # absolute nextLink used as-is


def test_create_user_payload():
    s = FakeSession([FakeResponse(200, {"id": "u1"})])
    client(s).create_user("admin@contoso.onmicrosoft.com", "Admin", "Pw!23")
    body = s.calls[0]["json"]
    assert body["userPrincipalName"] == "admin@contoso.onmicrosoft.com"
    assert body["mailNickname"] == "admin"                  # derived from the UPN
    assert body["usageLocation"] == "US"                    # required before licensing
    assert body["passwordProfile"]["forceChangePasswordNextSignIn"] is True
    assert body["accountEnabled"] is True


def test_assign_directory_role_activates_then_retries_on_404():
    s = FakeSession([
        FakeResponse(404, None, text="role not found"),   # role not instantiated yet
        FakeResponse(201, {"id": "role"}),                # activate it
        FakeResponse(204),                                # retry add-member succeeds
    ])
    client(s).assign_directory_role("principal-1", "template-1")
    assert len(s.calls) == 3
    assert s.calls[1]["json"] == {"roleTemplateId": "template-1"}
    assert "directoryObjects/principal-1" in s.calls[2]["json"]["@odata.id"]


def test_assign_directory_role_propagates_non_404():
    s = FakeSession([FakeResponse(403, None, text="denied")])
    with pytest.raises(GraphError) as e:
        client(s).assign_directory_role("p", "t")
    assert e.value.status == 403       # not swallowed by the 404 activation path


def test_send_mail_payload_with_reply_to():
    s = FakeSession([FakeResponse(202)])
    client(s).send_mail("me@x.com", ["a@y.com", "b@y.com"], "Subj", "Body",
                        reply_to=["reply@x.com"])
    msg = s.calls[0]["json"]["message"]
    assert [r["emailAddress"]["address"] for r in msg["toRecipients"]] == ["a@y.com", "b@y.com"]
    assert msg["replyTo"][0]["emailAddress"]["address"] == "reply@x.com"
    assert msg["body"]["contentType"] == "Text"


def test_assign_license_payload():
    s = FakeSession([FakeResponse(200, {"id": "u1"})])
    client(s).assign_license("u1", "sku-123")
    assert s.calls[0]["json"] == {"addLicenses": [{"skuId": "sku-123", "disabledPlans": []}],
                                  "removeLicenses": []}
