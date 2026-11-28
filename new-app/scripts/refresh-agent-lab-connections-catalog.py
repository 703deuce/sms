#!/usr/bin/env python3
"""Rebuild new-app/lib/agent-lab/connections-catalog.json from the live Composio toolkits API.

Run on the AgentLab host (uses /opt/agent/connectors/composio.py) or with COMPOSIO_API_KEY
in the environment. Never writes the key into the JSON. Paginates GET /api/v3.1/toolkits?limit=1000.

Usage:
  python3 refresh-agent-lab-connections-catalog.py [--out PATH]
"""
import argparse, json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = 'https://backend.composio.dev/api/v3.1'
KEY_SCHEMES = {'API_KEY', 'BEARER_TOKEN', 'BASIC'}
LABELS = {
    'one_click': 'One-click connect',
    'api_key': 'Connect with your API key',
    'no_auth': 'No sign-in needed',
    'native': 'One-click connect',
}
NATIVE = [
    {'slug': 'microsoft', 'name': 'Microsoft 365', 'logo': '',
     'description': "Outlook calendar and mail, Teams, OneDrive, SharePoint, and Bookings via AgentLab’s built-in connector.",
     'categories': ['email', 'calendar', 'team chat'], 'connect': 'native', 'label': LABELS['native'], 'source': 'native'},
    {'slug': 'calendly', 'name': 'Calendly', 'logo': '',
     'description': "Scheduled events and event types via AgentLab’s built-in connector.",
     'categories': ['scheduling & booking'], 'connect': 'native', 'label': LABELS['native'], 'source': 'native'},
    {'slug': 'salesforce', 'name': 'Salesforce', 'logo': '',
     'description': "CRM records via AgentLab’s built-in connector.",
     'categories': ['crm'], 'connect': 'native', 'label': LABELS['native'], 'source': 'native'},
    {'slug': 'zoho', 'name': 'Zoho CRM', 'logo': '',
     'description': "CRM records via AgentLab’s built-in connector.",
     'categories': ['crm'], 'connect': 'native', 'label': LABELS['native'], 'source': 'native'},
]
NATIVE_SLUGS = {n['slug'] for n in NATIVE}


def api_key():
    k = os.environ.get('COMPOSIO_API_KEY') or ''
    if k:
        return k
    env_path = Path('/opt/agent/secrets/composio.env')
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith('COMPOSIO_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    sys.exit('COMPOSIO_API_KEY is not set')


def request(path, query=None):
    url = API + path
    if query:
        url += '?' + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={
        'x-api-key': api_key(),
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read() or b'{}')


def fetch_all():
    items, cursor = [], None
    while True:
        q = {'limit': 1000}
        if cursor:
            q['cursor'] = cursor
        body = request('/toolkits', q)
        batch = body.get('items') or []
        items.extend(batch)
        cursor = body.get('next_cursor')
        if not cursor or not batch:
            return items, body.get('total_items')


def classify(it):
    managed = [str(s).upper() for s in (it.get('composio_managed_auth_schemes') or [])]
    schemes = [str(s).upper() for s in (it.get('auth_schemes') or [])]
    if managed:
        return 'one_click'
    if it.get('no_auth'):
        return 'no_auth'
    if set(schemes) & KEY_SCHEMES:
        return 'api_key'
    if 'DCR_OAUTH' in schemes:
        return 'one_click'   # GB-8: Composio registers the OAuth client dynamically; the user just signs in
    if 'S2S_OAUTH2' in schemes:
        return 'api_key'     # GB-8: client ID and secret (and any instance field) pasted by the customer
    return 'excluded'


def main():
    here = Path(__file__).resolve()
    default_out = here.parents[1] / 'lib' / 'agent-lab' / 'connections-catalog.json'
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', default=str(default_out))
    args = p.parse_args()

    raw, reported = fetch_all()
    # GB-7: apps customers cannot connect. The list lives on the AgentLab host only, not in this repo.
    try:
        blocked = {str(x).lower() for x in json.load(open('/opt/agent/connectors/unconnectable-apps.json')).get('slugs', [])}
    except Exception:
        blocked = set()
    raw = [it for it in raw if str(it.get('slug') or '').lower() not in blocked]
    included, excluded, excluded_kinds = [], 0, {}
    for it in raw:
        kind = classify(it)
        if kind == 'excluded':
            excluded += 1
            schemes = tuple(sorted(str(s).upper() for s in (it.get('auth_schemes') or [])))
            excluded_kinds[str(schemes)] = excluded_kinds.get(str(schemes), 0) + 1
            continue
        slug = it.get('slug') or ''
        if slug in NATIVE_SLUGS:
            continue  # listed once as native
        meta = it.get('meta') or {}
        cats = []
        for c in meta.get('categories') or []:
            if isinstance(c, dict) and (c.get('name') or c.get('id')):
                cats.append(c.get('name') or c.get('id'))
            elif isinstance(c, str):
                cats.append(c)
        included.append({
            'slug': slug,
            'name': it.get('name') or slug,
            'logo': meta.get('logo') or '',
            'description': (meta.get('description') or '')[:220],
            'categories': cats,
            'connect': kind,
            'label': LABELS[kind],
            'source': 'composio',
        })

    apps = NATIVE + included
    counts = {}
    for a in apps:
        counts[a['connect']] = counts.get(a['connect'], 0) + 1
    out = {
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'GET https://backend.composio.dev/api/v3.1/toolkits?limit=1000 (paginated) plus AgentLab native connectors',
        'catalog_total': reported or len(raw),
        'fetched': len(raw),
        'included': len(apps),
        'excluded_oauth_unmanaged': excluded,
        'counts': counts,
        'excluded_scheme_groups': excluded_kinds,
        'notes': (
            'Included: Composio-managed OAuth and DCR OAuth (one_click), API_KEY/BEARER_TOKEN/BASIC and S2S client-credentials (api_key), '
            'no-auth toolkits, and AgentLab native connectors. '
            'Excluded: OAuth-only or SAML toolkits with no Composio sign-in app and no key option. '
            'Native slugs that also exist in Composio (calendly, salesforce, zoho) are listed once as native.'
        ),
        'apps': apps,
    }
    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, separators=(',', ':')))
    print(f'wrote {dest} apps={len(apps)} fetched={len(raw)} excluded={excluded} counts={counts}')


if __name__ == '__main__':
    main()
