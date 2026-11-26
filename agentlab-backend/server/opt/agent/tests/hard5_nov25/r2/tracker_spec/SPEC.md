# Tracker: a tiny issue tracker (spec v1)

Build it with the **Python standard library only** (http.server, sqlite3, json, urllib, threading...). No pip installs, no frameworks. The frontend is plain HTML/CSS/JS with no CDN.

## Run
    python server.py --port 8123 --db tracker.db
- Creates the database file and schema if missing. Data must survive a restart.
- Serves the frontend at `GET /` (an HTML page) and the JSON API under `/api/`.
- All API responses are JSON with `Content-Type: application/json`, except 204 responses (no body).
- Errors: `{"error": "<message>"}` with the status codes below. Unknown routes return 404. Invalid JSON body returns 400.

## Issue object
    {"id": 1, "title": "...", "body": "", "priority": "medium", "labels": ["bug"],
     "status": "open", "created_at": "2026-11-25T16:00:00Z", "updated_at": "2026-11-25T16:00:00Z",
     "comment_count": 0}
- `id` integer, assigned 1, 2, 3, ... in creation order (ids are never reused after delete).
- `priority` one of `low`, `medium`, `high` (default `medium`).
- `labels` list of unique lowercase strings, stored sorted alphabetically (input `["UI","bug","ui"]` is stored as `["bug","ui"]`).
- `status` one of `open`, `in_progress`, `closed`. New issues are `open`.
- `created_at` / `updated_at` are UTC ISO-8601 with a `Z` suffix.

## Endpoints
1. `POST /api/issues` body `{"title", "body"?, "priority"?, "labels"?}` -> **201** with the issue.
   - **400** if `title` is missing, not a string, empty after trimming, or longer than 200 characters (title is stored trimmed);
     if `priority` is not one of the three values; if `labels` is not a list of strings.
2. `GET /api/issues` -> **200** `{"items": [...], "total": N, "page": P, "per_page": K}`
   - Query filters (all optional, combined with AND): `status`, `priority`, `label` (issue has that label, case-insensitive),
     `q` (case-insensitive substring of title OR body).
   - Sorted by `id` ascending. `page` default 1, `per_page` default 20, max 100. `total` counts all matches (not just this page).
   - **400** if `page` or `per_page` is not a positive integer, or `per_page` > 100, or a `status`/`priority` filter value is invalid.
3. `GET /api/issues/<id>` -> **200** issue, or **404**.
4. `PATCH /api/issues/<id>` body may contain any of `title`, `body`, `priority`, `labels`, `status` -> **200** updated issue (updates `updated_at`).
   - Same validation as create (**400**). **404** if no such issue.
   - Status transitions allowed: open->in_progress, open->closed, in_progress->open, in_progress->closed, closed->open.
     Anything else (closed->in_progress) returns **409**. Setting the same status it already has is allowed (no-op).
5. `DELETE /api/issues/<id>` -> **204**, then the issue and its comments are gone (**404** after). **404** if missing.
6. `POST /api/issues/<id>/comments` body `{"author", "text"}` (both non-empty strings) -> **201**
   `{"id", "issue_id", "author", "text", "created_at"}`. **400** on bad input, **404** if issue missing.
   Adding a comment increments the issue's `comment_count`.
7. `GET /api/issues/<id>/comments` -> **200** list of comments oldest first. **404** if issue missing.
8. `GET /api/stats` -> **200** `{"total": N, "by_status": {"open": a, "in_progress": b, "closed": c}, "by_priority": {"low": x, "medium": y, "high": z}}` (all six keys always present).

## Frontend (`GET /`)
A single page that lists issues (with status and priority), filters by status, creates an issue with a form, and can change an issue's status, all via `fetch()` calls to the API above.

## Tests
`tests/test_api.py` runnable with `python -m unittest discover -s tests` that starts the server on a free port with a temporary database and covers every endpoint, including error cases.
