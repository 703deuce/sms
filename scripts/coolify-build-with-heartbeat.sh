#!/usr/bin/env bash
# Keep Coolify build logs alive during long silent next build phases.
# Validates output so hidden OOM kills (exit 0, missing .next) fail loudly.
set -euo pipefail

heartbeat_interval="${COOLIFY_BUILD_HEARTBEAT_SECS:-20}"

# ============================================================================
# TEMPORARY OOM ROOT-CAUSE DIAGNOSTICS (remove after identifying memory killer)
# Enabled on Coolify builds. Prints cgroup + process memory every 10s and on exit.
# ============================================================================
OOM_DIAG_INTERVAL="${COOLIFY_OOM_DIAG_INTERVAL_SECS:-10}"
OOM_DIAG_ENABLED="${COOLIFY_OOM_DIAG:-auto}"
if [[ "$OOM_DIAG_ENABLED" == "auto" ]]; then
  if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
    OOM_DIAG_ENABLED=1
  else
    OOM_DIAG_ENABLED=0
  fi
fi

oom_diag_banner() {
  if [[ "$OOM_DIAG_ENABLED" != "1" ]]; then
    return 0
  fi
  echo "[oom-diag] TEMPORARY memory instrumentation ACTIVE (interval=${OOM_DIAG_INTERVAL}s)"
  echo "[oom-diag] Remove this block from coolify-build-with-heartbeat.sh after root cause found"
}

rss_for_pid_kb() {
  awk '/VmRSS/ {print $2; exit}' "/proc/$1/status" 2>/dev/null || echo "0"
}

cmdline_for_pid() {
  [[ -r "/proc/$1/cmdline" ]] || return 0
  tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null || true
}

# All descendant PIDs (breadth-first), including root.
descendant_pids() {
  local root="$1"
  local -a queue=("$root")
  local -a seen=()
  local pid child
  for pid in "${queue[@]}"; do
    seen+=("$pid")
    while read -r child; do
      [[ -z "$child" ]] && continue
      queue+=("$child")
    done < <(pgrep -P "$pid" 2>/dev/null || true)
  done
  printf '%s\n' "${seen[@]}"
}

# PIDs whose cmdline looks like next build (survives npx wrapper exit / reparent).
find_next_build_pids() {
  local root="${1:-}"
  local -a found=()
  local pid cmd

  if [[ -n "$root" ]]; then
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      cmd="$(cmdline_for_pid "$pid")"
      if [[ "$cmd" == *"next"* && "$cmd" == *"build"* ]]; then
        found+=("$pid")
      fi
    done < <(descendant_pids "$root")
  fi

  # Fallback: any node/next process in this build container matching next build.
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    [[ -d "/proc/$pid" ]] || continue
    cmd="$(cmdline_for_pid "$pid")"
    if [[ "$cmd" == *"next"* && "$cmd" == *"build"* ]]; then
      local seen=0
      for existing in "${found[@]}"; do
        [[ "$existing" == "$pid" ]] && seen=1 && break
      done
      [[ "$seen" -eq 0 ]] && found+=("$pid")
    fi
  done < <(ps -eo pid,args --no-headers 2>/dev/null | awk '{print $1}')

  printf '%s\n' "${found[@]}"
}

tree_rss_kb() {
  local root="$1"
  local total=0
  local pid rss
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    rss="$(rss_for_pid_kb "$pid")"
    total=$((total + rss))
  done < <(descendant_pids "$root")
  echo "$total"
}

print_meminfo_selected() {
  echo "[oom-diag] --- /proc/meminfo (selected) ---"
  local key
  for key in MemTotal MemFree MemAvailable Cached SwapTotal SwapFree; do
    grep "^${key}:" /proc/meminfo 2>/dev/null | sed 's/^/[oom-diag]   /' || true
  done
}

print_cgroup_memory() {
  echo "[oom-diag] --- cgroup memory ---"
  local base="" line rel v1base

  # cgroup v2 unified at mount root
  if [[ -f /sys/fs/cgroup/memory.current ]]; then
    base="/sys/fs/cgroup"
    echo "[oom-diag]   cgroup v2 (unified mount): $base"
    echo "[oom-diag]   memory.current: $(cat "${base}/memory.current" 2>/dev/null || echo n/a)"
    echo "[oom-diag]   memory.max: $(cat "${base}/memory.max" 2>/dev/null || echo n/a)"
    if [[ -f "${base}/memory.events" ]]; then
      echo "[oom-diag]   memory.events:"
      sed 's/^/[oom-diag]     /' "${base}/memory.events" 2>/dev/null || true
    fi
    return 0
  fi

  # cgroup v2 via /proc/self/cgroup (0::/path)
  line="$(grep '^0::' /proc/self/cgroup 2>/dev/null | head -1 || true)"
  if [[ -n "$line" ]]; then
    rel="${line#0::}"
    base="/sys/fs/cgroup${rel}"
    if [[ -f "${base}/memory.current" ]]; then
      echo "[oom-diag]   cgroup v2 (self): $base"
      echo "[oom-diag]   memory.current: $(cat "${base}/memory.current" 2>/dev/null || echo n/a)"
      echo "[oom-diag]   memory.max: $(cat "${base}/memory.max" 2>/dev/null || echo n/a)"
      if [[ -f "${base}/memory.events" ]]; then
        echo "[oom-diag]   memory.events:"
        sed 's/^/[oom-diag]     /' "${base}/memory.events" 2>/dev/null || true
      fi
      return 0
    fi
  fi

  # cgroup v1 memory controller
  line="$(grep '^memory:' /proc/self/cgroup 2>/dev/null | head -1 || true)"
  if [[ -n "$line" ]]; then
    rel="${line#memory:}"
    v1base="/sys/fs/cgroup/memory${rel}"
    if [[ -f "${v1base}/memory.usage_in_bytes" ]]; then
      echo "[oom-diag]   cgroup v1 (self): $v1base"
      echo "[oom-diag]   memory.usage_in_bytes: $(cat "${v1base}/memory.usage_in_bytes" 2>/dev/null || echo n/a)"
      echo "[oom-diag]   memory.limit_in_bytes: $(cat "${v1base}/memory.limit_in_bytes" 2>/dev/null || echo n/a)"
      echo "[oom-diag]   memory.failcnt: $(cat "${v1base}/memory.failcnt" 2>/dev/null || echo n/a)"
      if [[ -f "${v1base}/memory.oom_control" ]]; then
        echo "[oom-diag]   memory.oom_control:"
        sed 's/^/[oom-diag]     /' "${v1base}/memory.oom_control" 2>/dev/null || true
      fi
      return 0
    fi
  fi

  echo "[oom-diag]   (cgroup memory files not found in this container)"
}

print_top_rss_processes() {
  echo "[oom-diag] --- top RSS processes (pid ppid rss_kb vsz %mem %cpu comm args) ---"
  ps -eo pid,ppid,rss,vsz,%mem,%cpu,comm,args --sort=-rss 2>/dev/null \
    | head -30 \
    | sed 's/^/[oom-diag]   /' || true
}

print_node_processes() {
  echo "[oom-diag] --- node/next processes ---"
  ps -eo pid,ppid,rss,vsz,%mem,%cpu,args 2>/dev/null \
    | grep -E '[n]ode|[n]ext' \
    | sed 's/^/[oom-diag]   /' || echo "[oom-diag]   (none)"
}

print_node_rss_totals() {
  local build_pid="${1:-}"
  local -a next_pids=()
  local pid rss total_node=0 total_next_tree=0 count_node=0 count_next=0

  mapfile -t next_pids < <(find_next_build_pids "$build_pid")

  while read -r rss; do
    [[ -z "$rss" ]] && continue
    total_node=$((total_node + rss))
    count_node=$((count_node + 1))
  done < <(ps -eo rss,args --no-headers 2>/dev/null | grep -E '[n]ode|[n]ext' | awk '{print $1}')

  for pid in "${next_pids[@]}"; do
    [[ -z "$pid" ]] && continue
    total_next_tree=$((total_next_tree + $(tree_rss_kb "$pid")))
    count_next=$((count_next + 1))
  done

  echo "[oom-diag] --- node RSS totals ---"
  echo "[oom-diag]   node/next process count: ${count_node}"
  echo "[oom-diag]   total node/next RSS sum: ${total_node} kB ($(awk -v k="$total_node" 'BEGIN {printf "%.2f GB", k/1024/1024}'))"
  echo "[oom-diag]   next-build PID(s): ${next_pids[*]:-(not found)}"
  echo "[oom-diag]   next-build process count: ${count_next}"
  echo "[oom-diag]   next-build descendant-tree RSS sum: ${total_next_tree} kB ($(awk -v k="$total_next_tree" 'BEGIN {printf "%.2f GB", k/1024/1024}'))"
  if [[ -n "$build_pid" ]]; then
    local wrapper_rss wrapper_tree
    wrapper_rss="$(rss_for_pid_kb "$build_pid")"
    wrapper_tree="$(tree_rss_kb "$build_pid")"
    echo "[oom-diag]   wrapper PID $build_pid RSS: ${wrapper_rss} kB (often tiny — npx/bash shell)"
    echo "[oom-diag]   wrapper descendant-tree RSS: ${wrapper_tree} kB"
    if [[ "$wrapper_rss" -lt 1000 && "$total_next_tree" -gt 100000 ]]; then
      echo "[oom-diag]   NOTE: wrapper RSS is misleading; use next-build tree totals above"
    fi
  fi
}

print_process_tree() {
  local build_pid="${1:-}"
  echo "[oom-diag] --- process tree ---"
  if [[ -n "$build_pid" ]] && command -v pstree >/dev/null 2>&1; then
    pstree -ap "$build_pid" 2>/dev/null | sed 's/^/[oom-diag]   /' || true
  elif command -v pstree >/dev/null 2>&1; then
    pstree -ap 2>/dev/null | sed 's/^/[oom-diag]   /' | head -40 || true
  else
    ps -ef --forest 2>/dev/null | sed 's/^/[oom-diag]   /' | head -50 \
      || ps -ef 2>/dev/null | sed 's/^/[oom-diag]   /' | head -50 \
      || true
  fi
}

print_full_memory_snapshot() {
  local label="$1"
  local build_pid="${2:-}"
  if [[ "$OOM_DIAG_ENABLED" != "1" ]]; then
    return 0
  fi
  echo ""
  echo "[oom-diag] ########## MEMORY SNAPSHOT: ${label} ##########"
  echo "[oom-diag] timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  print_meminfo_selected
  print_cgroup_memory
  print_top_rss_processes
  print_node_processes
  print_node_rss_totals "$build_pid"
  print_process_tree "$build_pid"
  echo "[oom-diag] ########## END SNAPSHOT: ${label} ##########"
  echo ""
}
# ============================================================================ END TEMPORARY OOM DIAG

# Coolify: 4GB V8 heap (fixed earlier JS heap OOM). Use webpack — Turbopack hits ~6GB RSS + oom_kill.
# instrumentation.node.ts keeps job-handlers/Twilio out of edge-instrumentation webpack graph.
if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
  build_cmd=(npx next build --webpack)
  build_mode="webpack (Coolify 4GB heap)"
else
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
  build_cmd=(npm run build)
  build_mode="npm run build"
fi

echo "[coolify-build] starting next production build ($build_mode)"
echo "[coolify-build] node=$(node -v) heap_limit=${NODE_OPTIONS:-unset}"
oom_diag_banner
if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
  echo "[coolify-build] COOLIFY_RESOURCE_UUID set — next.config skips in-build TypeScript (OOM guard; run tsc in CI)"
fi

if [[ "$OOM_DIAG_ENABLED" == "1" ]]; then
  print_full_memory_snapshot "pre-build" ""
fi

set -o pipefail
"${build_cmd[@]}" > >(stdbuf -oL -eL tee /tmp/coolify-next-build.log) 2>&1 &
build_pid=$!

max_rss_kb=0
max_next_tree_kb=0
diag_tick=0

while kill -0 "$build_pid" 2>/dev/null; do
  if [[ "$OOM_DIAG_ENABLED" == "1" ]]; then
    sleep "$OOM_DIAG_INTERVAL"
  else
    sleep "$heartbeat_interval"
  fi

  if ! kill -0 "$build_pid" 2>/dev/null; then
    break
  fi

  # Legacy heartbeat + fixed next-build tree tracking (not wrapper shell RSS).
  tree_kb="$(tree_rss_kb "$build_pid")"
  if [[ "$tree_kb" -gt "$max_rss_kb" ]]; then
    max_rss_kb="$tree_kb"
  fi

  next_tree_kb=0
  while read -r npid; do
    [[ -z "$npid" ]] && continue
    npid_tree_kb="$(tree_rss_kb "$npid")"
    next_tree_kb=$((next_tree_kb + npid_tree_kb))
  done < <(find_next_build_pids "$build_pid")
  if [[ "$next_tree_kb" -gt "$max_next_tree_kb" ]]; then
    max_next_tree_kb="$next_tree_kb"
  fi

  if [[ "$OOM_DIAG_ENABLED" == "1" ]]; then
    diag_tick=$((diag_tick + 1))
    print_full_memory_snapshot "build-running tick=${diag_tick}" "$build_pid"
  else
    echo "[coolify-build] still running... pid=$build_pid wrapper_tree_rss_kb=${tree_kb} next_build_tree_rss_kb=${next_tree_kb} peak_next_tree_rss_kb=${max_next_tree_kb}"
  fi
done

wait "$build_pid"
build_status=$?

if [[ "$OOM_DIAG_ENABLED" == "1" ]]; then
  print_full_memory_snapshot "post-build exit=${build_status}" "$build_pid"
fi

if [[ "$build_status" -ne 0 ]]; then
  echo "[coolify-build] next build exited with status $build_status (peak_wrapper_tree_rss_kb=${max_rss_kb} peak_next_build_tree_rss_kb=${max_next_tree_kb})"
  if [[ "$build_status" -eq 137 ]]; then
    echo "[coolify-build] exit 137: process likely SIGKILL (host/cgroup OOM — check [oom-diag] memory.events)"
  elif grep -q "JavaScript heap out of memory" /tmp/coolify-next-build.log 2>/dev/null; then
    echo "[coolify-build] V8 heap exhaustion detected in build log — raise --max-old-space-size if still failing"
  fi
  if [[ "$build_status" -ne 0 ]]; then
    echo "[coolify-build] tips: review [oom-diag] snapshots in this log for cgroup vs V8 heap diagnosis"
  fi
  tail -n 40 /tmp/coolify-next-build.log 2>/dev/null || true
  exit "$build_status"
fi

if [[ ! -d .next/server ]]; then
  echo "[coolify-build] build reported success but .next/server is missing (hidden OOM?)"
  if [[ "$OOM_DIAG_ENABLED" == "1" ]]; then
    print_full_memory_snapshot "missing-.next-server" "$build_pid"
  fi
  tail -n 40 /tmp/coolify-next-build.log 2>/dev/null || true
  exit 1
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "[coolify-build] standalone output missing at .next/standalone/server.js"
  exit 1
fi

bundle_typescript_voice_runtime() {
  echo "[coolify-build] skipping TypeScript voice runtime bundle (Python-only voice worker)"
}

# Standalone server runs from .next/standalone — copy assets only (no Python bundle).
cp -a public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static 2>/dev/null || true
bundle_typescript_voice_runtime ".next/standalone"

echo "[coolify-build] complete (transovo-web only — voice worker uses voice-runtime-python/Dockerfile)"
if [[ "$OOM_DIAG_ENABLED" == "1" ]]; then
  echo "[oom-diag] build succeeded — remove TEMPORARY diagnostics once OOM root cause is documented"
fi
