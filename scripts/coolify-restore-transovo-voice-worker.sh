#!/usr/bin/env bash
# Restore Coolify application id=2 (historical voice worker slot) to voice-runtime-python.
# Moves SMS scheduler to a new application (id=3) using Dockerfile.sms-worker.
#
# Run ON the Coolify host (root), read-only discovery first:
#   bash scripts/coolify-restore-transovo-voice-worker.sh --discover-only
# Apply configuration (no deploy):
#   bash scripts/coolify-restore-transovo-voice-worker.sh --configure-only
# Queue ONE voice worker deploy (after configure + disk check):
#   VOICE_GIT_BRANCH=master VOICE_GIT_COMMIT=<sha> bash scripts/coolify-restore-transovo-voice-worker.sh --deploy-voice
#
# Does not print secret env values.

set -euo pipefail

VOICE_APP_ID="${VOICE_APP_ID:-2}"
SMS_APP_ID="${SMS_APP_ID:-3}"
VOICE_UUID="${VOICE_UUID:-tgjridm6vrmrgljkfrr0rpjn}"
DISCOVER_ONLY=false
CONFIGURE_ONLY=false
DEPLOY_VOICE=false
DEPLOY_SMS=false

for arg in "$@"; do
  case "$arg" in
    --discover-only) DISCOVER_ONLY=true ;;
    --configure-only) CONFIGURE_ONLY=true ;;
    --deploy-voice) DEPLOY_VOICE=true ;;
    --deploy-sms) DEPLOY_SMS=true ;;
  esac
done

psql_exec() {
  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "$1"
}

echo "[coolify-voice-restore] disk:"
df -h / | tail -1
docker system df | head -5

echo "[coolify-voice-restore] applications:"
psql_exec "SELECT id, uuid, name, build_pack, dockerfile_location, start_command, ports_exposes, git_branch, git_commit_sha, fqdn IS NOT NULL AS has_fqdn FROM applications WHERE id IN (${VOICE_APP_ID}, ${SMS_APP_ID}) OR deleted_at IS NULL ORDER BY id;"

echo "[coolify-voice-restore] running containers (coolify apps):"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'ds8s3hjin|tgjrid|transovo|sms-worker' || true

if [[ "$DISCOVER_ONLY" == true ]]; then
  echo "[coolify-voice-restore] discover-only complete"
  exit 0
fi

if [[ "$CONFIGURE_ONLY" != true && "$DEPLOY_VOICE" != true && "$DEPLOY_SMS" != true ]]; then
  echo "Specify --configure-only, --deploy-voice, and/or --deploy-sms"
  exit 1
fi

queue_deploy() {
  local app_id="$1"
  local app_name="$2"
  local commit="${3:-HEAD}"
  local dep_uuid
  dep_uuid="$(openssl rand -hex 12)"
  psql_exec "INSERT INTO application_deployment_queues (application_id, deployment_uuid, pull_request_id, force_rebuild, commit, status, is_webhook, created_at, updated_at, application_name, server_id, destination_id, only_this_server, rollback, is_api)
    VALUES ('${app_id}', '${dep_uuid}', 0, true, '${commit}', 'queued', false, NOW(), NOW(), '${app_name}', 0, '0', false, false, true);"
  echo "[coolify-voice-restore] queued deploy app_id=${app_id} uuid=${dep_uuid} commit=${commit}"
}

ensure_sms_application() {
  local exists
  exists="$(docker exec coolify-db psql -U coolify -d coolify -t -A -c "SELECT count(*) FROM applications WHERE id=${SMS_APP_ID};")"
  if [[ "$exists" == "1" ]]; then
    echo "[coolify-voice-restore] SMS app id=${SMS_APP_ID} already exists"
    return 0
  fi

  echo "[coolify-voice-restore] creating SMS worker application id=${SMS_APP_ID}"
  local new_uuid
  new_uuid="$(openssl rand -hex 13)"
  psql_exec "
    INSERT INTO applications (
      uuid, name, git_repository, git_branch, git_commit_sha, build_pack, static_image, base_directory,
      health_check_path, health_check_host, health_check_method, health_check_return_code, health_check_scheme,
      health_check_interval, health_check_timeout, health_check_retries, health_check_start_period,
      limits_memory, limits_memory_swap, limits_memory_swappiness, limits_memory_reservation, limits_cpus, limits_cpu_shares,
      status, preview_url_template, environment_id, destination_id, destination_type, source_type, source_id,
      dockerfile_location, start_command, ports_exposes, health_check_enabled, health_check_port, redirect, compose_parsing_version, swarm_replicas, custom_healthcheck_found
    )
    SELECT
      '${new_uuid}', 'transovo-sms-worker', git_repository, git_branch, git_commit_sha, 'dockerfile', static_image, base_directory,
      health_check_path, health_check_host, health_check_method, health_check_return_code, health_check_scheme,
      health_check_interval, health_check_timeout, health_check_retries, health_check_start_period,
      limits_memory, limits_memory_swap, limits_memory_swappiness, limits_memory_reservation, limits_cpus, limits_cpu_shares,
      'exited', preview_url_template, environment_id, destination_id, destination_type, source_type, source_id,
      '/Dockerfile.sms-worker', '', '8082', true, '8082', redirect, compose_parsing_version, swarm_replicas, custom_healthcheck_found
    FROM applications WHERE id=${VOICE_APP_ID};
  "

  psql_exec "INSERT INTO application_settings (is_static, is_git_submodules_enabled, is_git_lfs_enabled, is_auto_deploy_enabled, is_force_https_enabled, is_debug_enabled, is_preview_deployments_enabled, application_id, created_at, updated_at, is_log_drain_enabled, is_gpu_enabled, gpu_driver, is_include_timestamps, is_swarm_only_worker_nodes, is_raw_compose_deployment_enabled, is_build_server_enabled, is_consistent_container_name_enabled, is_gzip_enabled, is_stripprefix_enabled, connect_to_docker_network, is_container_label_escape_enabled, is_env_sorting_enabled, is_container_label_readonly_enabled, is_preserve_repository_enabled, disable_build_cache, is_spa, is_git_shallow_clone_enabled, is_pr_deployments_public_enabled, use_build_secrets, inject_build_args_to_dockerfile, include_source_commit_in_build, docker_images_to_keep)
    SELECT is_static, is_git_submodules_enabled, is_git_lfs_enabled, false, is_force_https_enabled, is_debug_enabled, is_preview_deployments_enabled, ${SMS_APP_ID}, NOW(), NOW(), is_log_drain_enabled, is_gpu_enabled, gpu_driver, is_include_timestamps, is_swarm_only_worker_nodes, is_raw_compose_deployment_enabled, is_build_server_enabled, is_consistent_container_name_enabled, is_gzip_enabled, is_stripprefix_enabled, connect_to_docker_network, is_container_label_escape_enabled, is_env_sorting_enabled, is_container_label_readonly_enabled, is_preserve_repository_enabled, disable_build_cache, is_spa, is_git_shallow_clone_enabled, is_pr_deployments_public_enabled, use_build_secrets, inject_build_args_to_dockerfile, include_source_commit_in_build, docker_images_to_keep
    FROM application_settings WHERE application_id=${VOICE_APP_ID};"

  psql_exec "
    INSERT INTO environment_variables (key, value, is_preview, is_shown_once, is_multiline, version, is_literal, uuid, is_required, is_shared, resourceable_type, resourceable_id, is_runtime, is_buildtime, created_at, updated_at)
    SELECT key, value, is_preview, is_shown_once, is_multiline, version, is_literal, md5(random()::text || key), is_required, is_shared, resourceable_type, ${SMS_APP_ID}, is_runtime, is_buildtime, NOW(), NOW()
    FROM environment_variables
    WHERE resourceable_type='App\\Models\\Application' AND resourceable_id=${VOICE_APP_ID};
  "
}

configure_voice_application() {
  ensure_sms_application

  local voice_branch="${VOICE_GIT_BRANCH:-master}"
  echo "[coolify-voice-restore] configuring voice app id=${VOICE_APP_ID} branch=${voice_branch}"

  psql_exec "
    UPDATE applications SET
      name = 'transovo-voice',
      build_pack = 'dockerfile',
      dockerfile_location = '/voice-runtime-python/Dockerfile',
      dockerfile = NULL,
      start_command = NULL,
      ports_exposes = '8081',
      ports_mappings = NULL,
      fqdn = NULL,
      health_check_enabled = true,
      health_check_port = '8081',
      health_check_path = '/',
      git_branch = '${voice_branch}',
      updated_at = NOW()
    WHERE id = ${VOICE_APP_ID};
  "

  psql_exec "
    INSERT INTO environment_variables (key, value, is_preview, is_shown_once, is_multiline, version, is_literal, uuid, is_required, is_shared, resourceable_type, resourceable_id, is_runtime, is_buildtime, created_at, updated_at)
    SELECT 'VOICE_V3_LIVEKIT_AGENT_NAME', 'transovo-voice-v3', false, false, false, version, false, md5('v3agent'), false, false, 'App\\Models\\Application', ${VOICE_APP_ID}, true, true, NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM environment_variables
      WHERE resourceable_type='App\\Models\\Application' AND resourceable_id=${VOICE_APP_ID} AND key='VOICE_V3_LIVEKIT_AGENT_NAME'
    );
  "

  psql_exec "
    UPDATE environment_variables SET value = 'livekit_cloud'
    WHERE resourceable_type='App\\Models\\Application' AND resourceable_id=${VOICE_APP_ID} AND key='MEDIA_BACKEND_MODE';
  "

  psql_exec "DELETE FROM environment_variables WHERE resourceable_type='App\\Models\\Application' AND resourceable_id=${VOICE_APP_ID} AND key='COOLIFY_SKIP_NEXT_BUILD';"
}

if [[ "$CONFIGURE_ONLY" == true ]]; then
  configure_voice_application
  echo "[coolify-voice-restore] configure-only complete (no deploy queued)"
fi

if [[ "$DEPLOY_SMS" == true ]]; then
  local_commit="${VOICE_GIT_COMMIT:-HEAD}"
  queue_deploy "${SMS_APP_ID}" "transovo-sms-worker" "${local_commit}"
fi

if [[ "$DEPLOY_VOICE" == true ]]; then
  local_commit="${VOICE_GIT_COMMIT:?set VOICE_GIT_COMMIT}"
  queue_deploy "${VOICE_APP_ID}" "transovo-voice" "${local_commit}"
fi

echo "[coolify-voice-restore] done"
