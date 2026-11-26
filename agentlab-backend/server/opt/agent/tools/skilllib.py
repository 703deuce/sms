"""Skills: folders with SKILL.md (frontmatter name + one-line description).
Shared skills live in /workspace/skills/<slug>/; a bot's own skills in /workspace/bots/<BOT_ID>/skills/<slug>/
(a bot skill with the same slug overrides the shared one)."""
import os, re

BOT = os.environ.get('BOT_ID', 'agent-lab')
SHARED = os.environ.get('AGENT_SKILLS_DIR', '/workspace/skills')
OWN = f'/workspace/bots/{BOT}/skills'


def parse(path):
    text = open(path, encoding='utf-8', errors='replace').read()
    meta, body = {}, text
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', text, re.S)
    if m:
        body = m.group(2)
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':')
            if v: meta[k.strip()] = v.strip().strip('"\'')
    return meta, body


def all_skills():
    found = {}
    for root, scope in ((SHARED, 'shared'), (OWN, BOT)):
        if not os.path.isdir(root):
            continue
        for slug in sorted(os.listdir(root)):
            p = os.path.join(root, slug, 'SKILL.md')
            if os.path.isfile(p):
                meta, _ = parse(p)
                found[slug] = {'slug': slug, 'name': meta.get('name', slug), 'description': meta.get('description', ''),
                               'path': os.path.dirname(p), 'scope': scope}
    return found
