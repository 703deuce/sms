#!/bin/bash
# Stop the Agent Lab virtual desktop processes. Does not touch agent-lab.
set -u
ROOT=/opt/agent/desktop
for name in viewer x11vnc openbox xvfb; do
  pidfile="$ROOT/${name}.pid"
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
done
pkill -f "desktop-service.py" 2>/dev/null || true
pkill -f "x11vnc.*rfbport 5900" 2>/dev/null || true
pkill -f "[o]penbox" 2>/dev/null || true
# Only kill our Xvfb, not some other display.
if [ -f /tmp/.X11-unix/X99 ]; then
  pkill -f "Xvfb :99" 2>/dev/null || true
fi
echo "desktop: stopped"
