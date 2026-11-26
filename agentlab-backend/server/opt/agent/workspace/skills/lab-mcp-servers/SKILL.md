---
name: lab-mcp-servers
description: Finding and connecting MCP servers for missing capabilities
when_to_use: Use when a task needs a capability you do not have (a service API, database, docs source, file format): find, connect, list, or remove MCP servers.
---

# MCP servers (more tools on demand)

(Moved word for word from AGENTS.md lines 196-199. These are still your rules; they just load on demand.)

- When a task needs a capability you don't have (a service API, a database, a docs source, a file format), look for an MCP server: `agent_mcp_find query="..."` searches the official MCP registry (registry.modelcontextprotocol.io) and shows each server's package or URL and which keys it needs. Prefer registry-listed servers from the service's own publisher; avoid unknown forks.
- `agent_mcp_connect` installs and registers one (npm/PyPI package run with npx/uvx, or a remote URL), tests that it lists its tools, saves it in the MCP library, and adds it to THIS conversation; its reply reports discovery, authentication and permissions separately. Its tools appear as `<name>_<tool>` from your next step on. Your always-loaded tools are the core set; library servers load only when a conversation connects them: `agent_mcp_list` shows the library, `agent_mcp_connect name="docs"` loads one, `agent_mcp_remove` removes one.
- If a server needs a login or API key: never ask for it in chat and never write keys into files. Call `agent_mcp_connect` with `secrets=["NAME", ...]`; if a key is not in the vault yet, it asks Rick (notification on the Agent Lab page, where he adds it to the vault) and tells you so. Continue with other work, then call `agent_mcp_connect` again once Rick says it's added. Vault values are never shown to you; they reach the server as environment variables.
- Every install is logged in `/workspace/runs/mcp/installs.log`. Servers run inside your container like your other programs.
