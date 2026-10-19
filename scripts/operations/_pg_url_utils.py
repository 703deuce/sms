"""Parse/build PostgreSQL URLs without breaking on @ in passwords (use last @ before host)."""
from __future__ import annotations

from urllib.parse import quote, unquote


def parse_postgres_url(url: str) -> dict[str, str]:
    raw = url.strip()
    for prefix in ("postgresql://", "postgres://"):
        if raw.startswith(prefix):
            raw = raw[len(prefix) :]
            break
    else:
        raise ValueError("Not a postgres URL")

    query = ""
    if "?" in raw:
        raw, q = raw.split("?", 1)
        query = "?" + q

    path = "/postgres"
    if "/" in raw:
        hostpart, db = raw.split("/", 1)
        path = "/" + db.split("?")[0]
        raw = hostpart
    else:
        hostpart = raw
        raw = ""

    at = hostpart.rfind("@")
    if at < 0:
        raise ValueError("Missing @ in postgres URL")
    userinfo = hostpart[:at]
    hostport = hostpart[at + 1 :]

    user = userinfo
    password = ""
    if ":" in userinfo:
        user, password = userinfo.split(":", 1)
        user = unquote(user)
        password = unquote(password)
    else:
        user = unquote(user)

    if ":" in hostport and not hostport.startswith("["):
        host, port = hostport.rsplit(":", 1)
    else:
        host, port = hostport, "5432"

    return {
        "user": user,
        "password": password,
        "host": host,
        "port": port,
        "path": path,
        "query": query,
    }


def build_postgres_url(parts: dict[str, str], database: str | None = None) -> str:
    user = quote(parts["user"], safe="")
    password = quote(parts["password"], safe="")
    path = "/" + (database or parts["path"].lstrip("/") or "postgres")
    query = parts.get("query") or ""
    return f"postgresql://{user}:{password}@{parts['host']}:{parts['port']}{path}{query}"
