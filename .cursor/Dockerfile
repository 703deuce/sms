# Cloud Agent base image for Transovo AI SMS.
#
# The app's runtime data layer is Supabase (PostgREST). The most faithful, fully
# self-contained dev database is the Supabase CLI local stack, which runs in
# Docker. This image therefore bakes in Node, the Docker engine, the Supabase
# CLI, and the userspace overlay driver needed to run Docker inside the Cloud
# Agent VM. The Docker daemon itself is started per-boot from `.cursor/start.sh`.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Base OS packages + Docker engine + userspace overlay driver for nested Docker.
# libvips42 mirrors the production (nixpacks) image; postgresql-client is handy
# for schema-cache reloads and debugging.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl git gnupg sudo \
    docker.io fuse-overlayfs uidmap iproute2 iptables \
    libvips42 postgresql-client \
    build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

# Node.js 22 (matches the version validated in development) via NodeSource.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# Supabase CLI (pinned) for the local Postgres + PostgREST + Kong stack.
ARG SUPABASE_CLI_VERSION=2.115.0
RUN curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.tar.gz" \
    -o /tmp/supabase.tar.gz \
  && tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase \
  && rm /tmp/supabase.tar.gz \
  && supabase --version

# The Cloud Agent runs as the pre-existing `ubuntu` user; allow it to use Docker
# and passwordless sudo (needed to start dockerd and tune bridge netfilter).
RUN usermod -aG docker ubuntu \
  && echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-ubuntu-cloud-agent \
  && chmod 0440 /etc/sudoers.d/90-ubuntu-cloud-agent

USER ubuntu
