#!/bin/bash
# Start the Agent Lab virtual desktop (Xvfb :99 + Openbox + x11vnc).
# Does not print cookies or env values. Safe to call if already running.
set -euo pipefail
umask 077

DISPLAY_NUM=99
export DISPLAY=":${DISPLAY_NUM}"
ROOT=/opt/agent/desktop
WS=/workspace/desktop
# workspace path on the host. 2026-11-26 (gap-fixes2): prefer the real host workspace whenever it exists. A stray host
# /workspace folder made the cookie copy land in /workspace/desktop on the host, so the shared Chromium in the
# container could not open the display (no desktop browser since Nov 25 ~01:18 AM ET).
if [ -d /opt/agent/workspace ] || [ ! -d /workspace ] || [ ! -w /workspace ]; then
  WS=/opt/agent/workspace/desktop
fi
AUTH="$ROOT/Xauthority"
export XAUTHORITY="$AUTH"
LOG="$ROOT/xvfb.log"

mkdir -p "$ROOT" "$WS" "$ROOT/.config/openbox" /var/log
chmod 755 "$ROOT" "$WS"

start_xvfb() {
  if [ -S /tmp/.X11-unix/X${DISPLAY_NUM} ] && DISPLAY=":${DISPLAY_NUM}" XAUTHORITY="$AUTH" xset q >/dev/null 2>&1; then
    return 0
  fi
  rm -f "$AUTH" "$WS/Xauthority"
  # Cookie stays in this function; never echoed.
  local cookie
  cookie="$(mcookie)"
  touch "$AUTH"
  chmod 640 "$AUTH"
  xauth -f "$AUTH" add ":${DISPLAY_NUM}" MIT-MAGIC-COOKIE-1 "$cookie"
  xauth -f "$AUTH" add "127.0.0.1:${DISPLAY_NUM}" MIT-MAGIC-COOKIE-1 "$cookie"
  xauth -f "$AUTH" add "$(hostname)/unix:${DISPLAY_NUM}" MIT-MAGIC-COOKIE-1 "$cookie"
  unset cookie
  # -listen tcp so the agent container (network=host) can attach with DISPLAY=127.0.0.1:99.
  # UFW default-deny keeps port 60xx off the public internet.
  Xvfb ":${DISPLAY_NUM}" -auth "$AUTH" -listen tcp -nolisten inet6 \
    -screen 0 1920x1080x24 +extension RANDR +extension GLX \
    >"$LOG" 2>&1 &
  echo $! > "$ROOT/xvfb.pid"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if DISPLAY=":${DISPLAY_NUM}" XAUTHORITY="$AUTH" xset q >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
  cp -a "$AUTH" "$WS/Xauthority"
  chown 10001:10001 "$WS/Xauthority" 2>/dev/null || true
  chmod 640 "$WS/Xauthority" "$AUTH"
  # Let uid 10001 (openhands) read the cookie; group-own the host copy too.
  chgrp 10001 "$AUTH" 2>/dev/null || true
}

start_openbox() {
  if pgrep -f "[o]penbox" >/dev/null 2>&1; then
    return 0
  fi
  mkdir -p "$ROOT/.config/openbox"
  if [ -d /opt/agent/ops/desktop/openbox ]; then
    cp -a /opt/agent/ops/desktop/openbox/. "$ROOT/.config/openbox/" || true
  fi
  HOME="$ROOT" DISPLAY=":${DISPLAY_NUM}" XAUTHORITY="$AUTH" \
    openbox >"$ROOT/openbox.log" 2>&1 &
  echo $! > "$ROOT/openbox.pid"
  sleep 0.3
  DISPLAY=":${DISPLAY_NUM}" XAUTHORITY="$AUTH" xsetroot -solid "#1b1e23" >/dev/null 2>&1 || true
}

start_x11vnc() {
  if pgrep -f "x11vnc.*rfbport 5900" >/dev/null 2>&1; then
    return 0
  fi
  x11vnc -display ":${DISPLAY_NUM}" -auth "$AUTH" \
    -localhost -rfbport 5900 -forever -shared -nopw -repeat \
    -noxdamage -ncache 0 -wait 10 -o "$ROOT/x11vnc.log" >/dev/null 2>&1 &
  echo $! > "$ROOT/x11vnc.pid"
}

start_xvfb
start_openbox
start_x11vnc
# Under systemd we are the foreground process: start deps, then run the viewer
# in the foreground (do not exec, so a trap can stop Xvfb/openbox/vnc with us).
if [ "${DESKTOP_SERVICE_EXEC:-}" = "1" ]; then
  cleanup() {
    pkill -f "x11vnc.*rfbport 5900" >/dev/null 2>&1 || true
    pkill -f "[o]penbox" >/dev/null 2>&1 || true
    pkill -f "Xvfb :${DISPLAY_NUM}" >/dev/null 2>&1 || true
  }
  trap cleanup EXIT
  /usr/bin/python3 /opt/agent/ops/desktop/desktop-service.py
  exit $?
fi
if ! pgrep -f "desktop-service.py" >/dev/null 2>&1; then
  nohup /usr/bin/python3 /opt/agent/ops/desktop/desktop-service.py >>"$ROOT/viewer.log" 2>&1 &
  echo $! > "$ROOT/viewer.pid"
  disown || true
fi
echo "desktop: up on DISPLAY=:${DISPLAY_NUM}  view=http://127.0.0.1:6080  control=http://127.0.0.1:6070"
