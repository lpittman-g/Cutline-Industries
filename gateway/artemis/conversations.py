"""Protected account/conversation records. SQLite locally; the existing Store supports PostgreSQL."""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import time
import uuid
from datetime import datetime, timezone

from .store import Store


class ChatError(Exception):
    def __init__(self, code, category, message):
        super().__init__(message)
        self.code, self.category = code, category


def uid():
    return uuid.uuid4().hex


def utc(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created {real});
CREATE TABLE IF NOT EXISTS chat_sessions (hash TEXT PRIMARY KEY, owner TEXT NOT NULL, csrf TEXT NOT NULL, expires {real});
CREATE TABLE IF NOT EXISTS chat_auth_attempts (client TEXT, created {real});
CREATE TABLE IF NOT EXISTS chat_conversations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, created {real}, updated {real}, archived INTEGER NOT NULL DEFAULT 0, head_id TEXT);
CREATE INDEX IF NOT EXISTS chat_conversation_owner ON chat_conversations(owner, updated);
CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, parent_id TEXT, role TEXT NOT NULL, content TEXT NOT NULL, state TEXT NOT NULL, created {real}, revision_of TEXT, error TEXT);
CREATE INDEX IF NOT EXISTS chat_message_conversation ON chat_messages(conversation_id, created);
CREATE TABLE IF NOT EXISTS chat_requests (id TEXT PRIMARY KEY, owner TEXT NOT NULL, conversation_id TEXT NOT NULL, idempotency TEXT NOT NULL, fingerprint TEXT NOT NULL, user_id TEXT NOT NULL, assistant_id TEXT NOT NULL, state TEXT NOT NULL, created {real}, started {real}, ended {real}, cancelled INTEGER NOT NULL DEFAULT 0, settings TEXT NOT NULL, model TEXT NOT NULL, error TEXT, finish_reason TEXT, UNIQUE(owner, idempotency));
CREATE TABLE IF NOT EXISTS chat_chunks (request_id TEXT NOT NULL, seq INTEGER NOT NULL, event TEXT NOT NULL, created {real}, PRIMARY KEY(request_id, seq));
CREATE TABLE IF NOT EXISTS chat_model_calls (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, brain TEXT NOT NULL, system TEXT NOT NULL, context TEXT NOT NULL, settings TEXT NOT NULL, model TEXT NOT NULL, output TEXT NOT NULL, metadata TEXT NOT NULL, state TEXT NOT NULL, created {real}, ended {real});
CREATE TABLE IF NOT EXISTS chat_revisions (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, original_id TEXT NOT NULL, kind TEXT NOT NULL, created {real});
CREATE TABLE IF NOT EXISTS chat_tool_events (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL, arguments TEXT NOT NULL, result TEXT, started {real}, ended {real});
CREATE TABLE IF NOT EXISTS chat_failures (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, category TEXT NOT NULL, detail TEXT NOT NULL, created {real});
CREATE TABLE IF NOT EXISTS chat_feedback (id TEXT PRIMARY KEY, owner TEXT NOT NULL, message_id TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT NOT NULL, created {real});
CREATE TABLE IF NOT EXISTS chat_voice_events (id TEXT PRIMARY KEY, owner TEXT NOT NULL, conversation_id TEXT NOT NULL, kind TEXT NOT NULL, details TEXT NOT NULL, created {real});
CREATE TABLE IF NOT EXISTS chat_preferences (owner TEXT PRIMARY KEY, retention_days INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS chat_request_events (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, kind TEXT NOT NULL, details TEXT NOT NULL, created {real});
"""


def rows(cursor, values):
    keys = [column[0] for column in cursor.description]
    return [dict(zip(keys, row)) for row in values]


def all_dict(tx, sql, params=()):
    cursor = tx.execute(sql, params)
    return rows(cursor, cursor.fetchall())


def one_dict(tx, sql, params=()):
    values = all_dict(tx, sql, params)
    return values[0] if values else None


class Conversations:
    def __init__(self, db: Store):
        self.db = db
        for statement in SCHEMA.format(real="DOUBLE PRECISION" if db.postgres else "REAL").split(";"):
            if statement.strip(): db.execute(statement)

    def _password(self, password, salt=None):
        salt = salt or secrets.token_hex(16)
        value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        return salt + ":" + value

    def authenticate(self, email, password, client, signup=False):
        email = str(email).strip().lower()
        if not re.fullmatch(r"[^@\s]{1,200}@[^@\s]{1,200}\.[^@\s]{2,30}", email):
            raise ChatError(400, "invalid_email", "Enter a valid email address.")
        if not isinstance(password, str) or not 12 <= len(password) <= 256:
            raise ChatError(400, "invalid_password", "Use a password of 12 to 256 characters.")
        now = time.time()
        with self.db.transaction() as tx:
            attempts = tx.one("SELECT COUNT(*) FROM chat_auth_attempts WHERE client=? AND created>?", (client, now-3600))[0]
            if attempts >= 20: raise ChatError(429, "login_limit", "Too many login attempts. Try again in an hour.")
            tx.execute("INSERT INTO chat_auth_attempts VALUES (?,?)", (client, now))
            tx.execute("DELETE FROM chat_auth_attempts WHERE created<?", (now-86400,))
        # Hash outside the database lock; dummy work prevents a fast unknown-account path.
        with self.db.transaction() as tx:
            user = one_dict(tx, "SELECT * FROM chat_users WHERE email=?", (email,))
        if signup:
            if user: raise ChatError(409, "account_exists", "An account already uses this email. Sign in instead.")
            password_hash = self._password(password)
            owner = uid()
            with self.db.transaction() as tx:
                if tx.one("SELECT id FROM chat_users WHERE email=?", (email,)):
                    raise ChatError(409, "account_exists", "An account already uses this email.")
                tx.execute("INSERT INTO chat_users VALUES (?,?,?,?)", (owner, email, password_hash, now))
        else:
            stored = user["password"] if user else self._password("invalid-placeholder-password")
            match = hmac.compare_digest(self._password(password, stored.split(":")[0]), stored)
            if not user or not match: raise ChatError(401, "invalid_login", "Email or password is incorrect.")
            owner = user["id"]
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with self.db.transaction() as tx:
            tx.execute("DELETE FROM chat_sessions WHERE expires<?", (now,))
            tx.execute("INSERT INTO chat_sessions VALUES (?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), owner, csrf, now+30*86400))
        return {"id": owner, "email": email, "csrf": csrf}, token

    def session(self, token):
        if not token: raise ChatError(401, "login_required", "Sign in to save and continue conversations.")
        with self.db.transaction() as tx:
            row = one_dict(tx, "SELECT s.owner AS id,s.csrf,u.email FROM chat_sessions s JOIN chat_users u ON u.id=s.owner WHERE s.hash=? AND s.expires>?",
                           (hashlib.sha256(token.encode()).hexdigest(), time.time()))
        if not row: raise ChatError(401, "login_required", "Your session expired. Please sign in again.")
        return row

    def logout(self, token):
        self.db.execute("DELETE FROM chat_sessions WHERE hash=?", (hashlib.sha256(token.encode()).hexdigest(),))

    def _owned(self, tx, owner, conversation):
        row = one_dict(tx, "SELECT * FROM chat_conversations WHERE id=? AND owner=?", (conversation, owner))
        if not row: raise ChatError(404, "not_found", "Conversation not found.")
        return row

    def create(self, owner, title="New conversation"):
        cid, now = uid(), time.time()
        with self.db.transaction() as tx:
            tx.execute("INSERT INTO chat_conversations VALUES (?,?,?,?,?,0,NULL)", (cid, owner, str(title).strip()[:100] or "New conversation", now, now))
            return self._owned(tx, owner, cid)

    def list(self, owner, query="", archived=False):
        with self.db.transaction() as tx:
            values = all_dict(tx, "SELECT * FROM chat_conversations WHERE owner=? AND archived=? ORDER BY updated DESC", (owner, int(archived)))
            if query:
                term = query.lower()
                matches = {r[0] for r in tx.all("SELECT m.conversation_id FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id WHERE c.owner=? AND LOWER(m.content) LIKE ?",
                                             (owner, "%" + term + "%"))}
                values = [c for c in values if term in c["title"].lower() or c["id"] in matches]
        return values

    def load(self, owner, cid):
        with self.db.transaction() as tx:
            conversation = self._owned(tx, owner, cid)
            conversation["messages"] = all_dict(tx, "SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY created,id", (cid,))
            conversation["requests"] = all_dict(tx, "SELECT id,assistant_id,user_id,state,model,error,created,started,ended FROM chat_requests WHERE conversation_id=? ORDER BY created", (cid,))
            conversation["tool_events"] = all_dict(tx, "SELECT t.* FROM chat_tool_events t JOIN chat_requests r ON r.id=t.request_id WHERE r.conversation_id=? ORDER BY t.started", (cid,))
        return conversation

    def update(self, owner, cid, fields):
        with self.db.transaction() as tx:
            self._owned(tx, owner, cid)
            if "title" in fields:
                title = str(fields["title"]).strip()[:100]
                if not title: raise ChatError(400, "invalid_title", "A title is required.")
                tx.execute("UPDATE chat_conversations SET title=? WHERE id=?", (title, cid))
            if "archived" in fields:
                tx.execute("UPDATE chat_conversations SET archived=? WHERE id=?", (int(bool(fields["archived"])), cid))
            if "head_id" in fields:
                head = fields["head_id"]
                if not tx.one("SELECT id FROM chat_messages WHERE id=? AND conversation_id=?", (head, cid)):
                    raise ChatError(400, "invalid_branch", "That branch is not part of this conversation.")
                tx.execute("UPDATE chat_conversations SET head_id=? WHERE id=?", (head, cid))
            tx.execute("UPDATE chat_conversations SET updated=? WHERE id=?", (time.time(), cid))

    def request(self, owner, cid, body, settings, model):
        key = body.get("idempotency_key")
        if not isinstance(key, str) or not 8 <= len(key) <= 128: raise ChatError(400, "idempotency_required", "A stable request idempotency key is required.")
        relevant = {k: body.get(k) for k in ("text", "head_id", "edit_message_id", "regenerate_message_id")}
        fingerprint = hashlib.sha256(json.dumps([cid, relevant], sort_keys=True).encode()).hexdigest()
        now = time.time()
        with self.db.transaction() as tx:
            conversation = self._owned(tx, owner, cid)
            previous = one_dict(tx, "SELECT * FROM chat_requests WHERE owner=? AND idempotency=?", (owner, key))
            if previous:
                if previous["fingerprint"] != fingerprint: raise ChatError(409, "idempotency_conflict", "This request key was already used for different input.")
                return previous, False
            if tx.one("SELECT id FROM chat_requests WHERE conversation_id=? AND state IN ('queued','generating')", (cid,)):
                raise ChatError(409, "conversation_busy", "Wait for or stop the current reply first.")
            if tx.one("SELECT COUNT(*) FROM chat_requests WHERE state IN ('queued','generating')")[0] >= 40:
                raise ChatError(429, "queue_full", "Chat is busy. Please retry shortly.")
            if tx.one("SELECT COUNT(*) FROM chat_requests WHERE owner=? AND state IN ('queued','generating')", (owner,))[0] >= 2:
                raise ChatError(429, "account_busy", "You already have two requests in progress.")
            edit, regenerate = body.get("edit_message_id"), body.get("regenerate_message_id")
            if edit and regenerate: raise ChatError(400, "invalid_revision", "Choose edit or regenerate.")
            original = None
            if edit or regenerate:
                original = one_dict(tx, "SELECT * FROM chat_messages WHERE id=? AND conversation_id=?", (edit or regenerate, cid))
                if not original or original["role"] != ("user" if edit else "assistant"):
                    raise ChatError(400, "invalid_revision", "The message cannot be revised in this conversation.")
            if regenerate:
                user_id = original["parent_id"]
            else:
                text = body.get("text")
                if not isinstance(text, str) or not 1 <= len(text.strip()) <= 8000:
                    raise ChatError(400, "invalid_message", "Messages must be 1 to 8000 characters.")
                parent = original["parent_id"] if edit else body.get("head_id", conversation["head_id"])
                if parent and not tx.one("SELECT id FROM chat_messages WHERE id=? AND conversation_id=? AND role='assistant' AND state NOT IN ('queued','generating')", (parent, cid)):
                    raise ChatError(400, "invalid_branch", "Choose a finished branch to continue.")
                user_id = uid()
                tx.execute("INSERT INTO chat_messages VALUES (?,?,?,?,?,?,?,?,NULL)", (user_id, cid, parent, "user", text, "completed", now, edit))
                if edit: tx.execute("INSERT INTO chat_revisions VALUES (?,?,?,?,?)", (uid(), user_id, edit, "edit", now))
                if not conversation["head_id"]: tx.execute("UPDATE chat_conversations SET title=? WHERE id=?", (text.strip()[:70], cid))
            assistant_id, request_id = uid(), uid()
            tx.execute("INSERT INTO chat_messages VALUES (?,?,?,?,?,?,?,?,NULL)", (assistant_id, cid, user_id, "assistant", "", "queued", now+0.000001, regenerate))
            if regenerate: tx.execute("INSERT INTO chat_revisions VALUES (?,?,?,?,?)", (uid(), assistant_id, regenerate, "regenerate", now))
            tx.execute("INSERT INTO chat_requests VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,0,?,?,NULL,NULL)",
                       (request_id, owner, cid, key, fingerprint, user_id, assistant_id, "queued", now, json.dumps(settings), model))
            tx.execute("UPDATE chat_conversations SET head_id=?,updated=? WHERE id=?", (assistant_id, now, cid))
            return one_dict(tx, "SELECT * FROM chat_requests WHERE id=?", (request_id,)), True

    def get_request(self, owner, rid):
        with self.db.transaction() as tx:
            value = one_dict(tx, "SELECT * FROM chat_requests WHERE id=? AND owner=?", (rid, owner))
        if not value: raise ChatError(404, "not_found", "Request not found.")
        return value

    def context(self, owner, rid):
        request = self.get_request(owner, rid)
        conversation = self.load(owner, request["conversation_id"])
        lookup = {m["id"]: m for m in conversation["messages"]}
        branch, current, visited = [], request["user_id"], set()
        while current:
            if current in visited or current not in lookup: raise ChatError(409, "invalid_branch", "Conversation branch is inconsistent.")
            visited.add(current); message = lookup[current]; branch.append(message); current = message["parent_id"]
        branch.reverse()
        context = []
        for i, message in enumerate(branch):
            if message["role"] == "assistant" and message["state"] != "completed": continue
            if message["role"] == "user" and i < len(branch)-1 and branch[i+1]["state"] != "completed": continue
            context.append({"role": message["role"], "content": message["content"], "id": message["id"]})
        return context

    def emit(self, rid, event, assistant=None, content=None):
        with self.db.transaction() as tx:
            if assistant is not None:
                tx.execute("UPDATE chat_messages SET content=? WHERE id=?", (content, assistant))
            seq = tx.one("SELECT COALESCE(MAX(seq),0)+1 FROM chat_chunks WHERE request_id=?", (rid,))[0]
            tx.execute("INSERT INTO chat_chunks VALUES (?,?,?,?)", (rid, seq, json.dumps(event, ensure_ascii=False), time.time()))
        return seq

    def preferences(self, owner, days=None):
        with self.db.transaction() as tx:
            if days is not None:
                if type(days) is not int or days not in (0, 30, 90, 365):
                    raise ChatError(400, "invalid_retention", "Choose keep until deleted, 30 days, 90 days, or one year.")
                tx.execute("INSERT INTO chat_preferences VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET retention_days=excluded.retention_days", (owner, days))
            row = tx.one("SELECT retention_days FROM chat_preferences WHERE owner=?", (owner,))
        return {"retention_days": row[0] if row else 0, "training_collection": False, "raw_audio_storage": False,
                "deletion": "Deletes active database records. Hosting backups require a separately configured expiry policy."}

    def lifecycle(self, rid, kind, details=None):
        with self.db.transaction() as tx:
            if tx.one("SELECT id FROM chat_requests WHERE id=?", (rid,)):
                tx.execute("INSERT INTO chat_request_events VALUES (?,?,?,?,?)", (uid(), rid, kind, json.dumps(details or {}), time.time()))

    def expire(self):
        for owner, days in self.db.all("SELECT owner,retention_days FROM chat_preferences WHERE retention_days>0"):
            for cid, in self.db.all("SELECT id FROM chat_conversations WHERE owner=? AND updated<?", (owner, time.time()-days*86400)):
                try: self.delete(owner, cid)
                except ChatError as error:
                    if error.category != "conversation_busy": raise

    def events(self, owner, rid, after=0):
        request = self.get_request(owner, rid)
        return request, [{"seq": row[0], "event": json.loads(row[1])} for row in self.db.all("SELECT seq,event FROM chat_chunks WHERE request_id=? AND seq>? ORDER BY seq", (rid, after))]

    def delete(self, owner, cid):
        with self.db.transaction() as tx:
            self._owned(tx, owner, cid)
            if tx.one("SELECT id FROM chat_requests WHERE conversation_id=? AND state IN ('queued','generating')", (cid,)):
                raise ChatError(409, "conversation_busy", "Stop the reply before deleting this conversation.")
            for rid, in tx.all("SELECT id FROM chat_requests WHERE conversation_id=?", (cid,)):
                for table in ("chat_chunks", "chat_model_calls", "chat_tool_events", "chat_failures", "chat_request_events"):
                    tx.execute(f"DELETE FROM {table} WHERE request_id=?", (rid,))
            tx.execute("DELETE FROM chat_feedback WHERE message_id IN (SELECT id FROM chat_messages WHERE conversation_id=?)", (cid,))
            tx.execute("DELETE FROM chat_revisions WHERE message_id IN (SELECT id FROM chat_messages WHERE conversation_id=?)", (cid,))
            tx.execute("DELETE FROM chat_voice_events WHERE conversation_id=?", (cid,))
            tx.execute("DELETE FROM chat_requests WHERE conversation_id=?", (cid,))
            tx.execute("DELETE FROM chat_messages WHERE conversation_id=?", (cid,))
            tx.execute("DELETE FROM chat_conversations WHERE id=?", (cid,))

    def export(self, owner, cid):
        data = self.load(owner, cid)
        with self.db.transaction() as tx:
            self._owned(tx, owner, cid)
            for name, table in (("generation_requests", "chat_requests"), ("chunks", "chat_chunks"), ("model_calls", "chat_model_calls"), ("failures", "chat_failures"), ("request_events", "chat_request_events")):
                sql = f"SELECT t.* FROM {table} t WHERE " + ("t.conversation_id=?" if table == "chat_requests" else "t.request_id IN (SELECT id FROM chat_requests WHERE conversation_id=?)")
                data[name] = all_dict(tx, sql, (cid,))
            data["revisions"] = all_dict(tx, "SELECT * FROM chat_revisions WHERE message_id IN (SELECT id FROM chat_messages WHERE conversation_id=?)", (cid,))
            data["feedback"] = all_dict(tx, "SELECT * FROM chat_feedback WHERE message_id IN (SELECT id FROM chat_messages WHERE conversation_id=?)", (cid,))
            data["voice_events"] = all_dict(tx, "SELECT * FROM chat_voice_events WHERE conversation_id=?", (cid,))
        data["exported_at"] = utc(time.time())
        data["attachments"] = []  # No extraction service is configured; uploads are not exposed.
        return data
