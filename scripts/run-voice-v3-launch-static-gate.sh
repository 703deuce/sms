#!/usr/bin/env bash
# Voice V3 final launch certification — static/contract gate (no local Next build).
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p /opt/cursor/artifacts/voice-v3-launch-cert
LOG=/opt/cursor/artifacts/voice-v3-launch-cert/static-gate.log
: > "$LOG"

export NODE_OPTIONS="--import ./scripts/preload-server-only.mjs"

run_one() {
  local name="$1"
  shift
  echo "===== $name =====" | tee -a "$LOG"
  if "$@" >>"$LOG" 2>&1; then
    echo "RESULT:$name:PASS" | tee -a "$LOG"
    return 0
  else
    echo "RESULT:$name:FAIL" | tee -a "$LOG"
    return 1
  fi
}

# Scripts that must not load server-only graph (pure static scans).
run_one_no_preload() {
  local name="$1"
  shift
  echo "===== $name =====" | tee -a "$LOG"
  if env -u NODE_OPTIONS "$@" >>"$LOG" 2>&1; then
    echo "RESULT:$name:PASS" | tee -a "$LOG"
    return 0
  else
    echo "RESULT:$name:FAIL" | tee -a "$LOG"
    return 1
  fi
}

FAIL=0

run_one runtime_launch_classification npx tsx scripts/test-voice-v3-runtime-launch-classification.ts || FAIL=1
run_one runtime_launch_gap_report npx tsx scripts/report-voice-v3-runtime-launch-gaps.ts || FAIL=1
run_one configuration_certification_contract npx tsx scripts/test-voice-v3-configuration-certification-contract.ts || FAIL=1
run_one wizard_backend_propagation npx tsx scripts/test-voice-v3-wizard-backend-propagation.ts || FAIL=1
run_one send_booking_link_matrix npx tsx scripts/test-voice-v3-send-booking-link-matrix.ts || FAIL=1
run_one transfer_cold_warm_cert npx tsx scripts/test-voice-v3-transfer-cold-warm-cert.ts || FAIL=1
run_one_no_preload transfer_system npx tsx scripts/test-voice-v3-transfer-system.ts || FAIL=1
run_one_no_preload transfer_wizard_state npx tsx scripts/test-voice-v3-transfer-wizard-state.ts || FAIL=1
run_one required_fields_book_gate npx tsx scripts/test-voice-v3-required-fields-book-gate.ts || FAIL=1
run_one livekit_bridge npx tsx scripts/test-voice-v3-livekit-bridge.ts || FAIL=1
run_one livekit_concurrency_cert npx tsx scripts/test-voice-v3-livekit-concurrency-cert.ts || FAIL=1
run_one microsoft_appointment_management npx tsx scripts/test-voice-v3-microsoft-appointment-management.ts || FAIL=1
run_one voice_v3_booking_scene npx tsx scripts/test-voice-v3-booking-scene-invariant.ts || FAIL=1
run_one voice_v3_booking npx tsx scripts/test-voice-v3-booking.ts || FAIL=1
run_one knowledge_retrieval npx tsx scripts/test-voice-v3-knowledge-retrieval.ts || FAIL=1
run_one filesearch_session_cert npx tsx scripts/test-voice-v3-filesearch-session-cert.ts || FAIL=1
run_one business_hours_invariant npx tsx scripts/test-voice-v3-business-hours-invariant.ts || FAIL=1
run_one after_hours_notifications npx tsx scripts/test-voice-v3-after-hours-notifications.ts || FAIL=1
run_one_no_preload qualification_urgency npx tsx scripts/test-voice-v3-qualification-urgency.ts || FAIL=1
run_one callback_matrix npx tsx scripts/test-voice-v3-callback-matrix.ts || FAIL=1
run_one callback_wizard_roundtrip npx tsx scripts/test-voice-v3-callback-wizard-roundtrip.ts || FAIL=1
run_one post_call_closure npx tsx scripts/test-voice-v3-post-call-closure.ts || FAIL=1
run_one wizard_draft_vs_published npx tsx scripts/test-voice-v3-wizard-draft-vs-published-resolution.ts || FAIL=1
run_one wizard_republish_intake npx tsx scripts/test-voice-v3-wizard-republish-intake.ts || FAIL=1
run_one wizard_pages_backend npx tsx scripts/test-wizard-pages-backend.ts || FAIL=1
run_one wizard_merge_on_save npx tsx scripts/test-wizard-merge-on-save.ts || FAIL=1
run_one wizard_cert_matrix npx tsx scripts/test-voice-v3-wizard-cert-matrix.ts || FAIL=1
run_one wizard_compiler npx tsx scripts/test-voice-v3-wizard-compiler.ts || FAIL=1
run_one conversation_freshness npx tsx scripts/test-voice-v3-conversation-freshness.ts || FAIL=1
run_one booking_link_sms_isolation npx tsx scripts/test-voice-v3-booking-link-sms-isolation.ts || FAIL=1
run_one microsoft_connection_resolve npx tsx scripts/test-voice-v3-microsoft-connection-resolve.ts || FAIL=1
run_one architecture_invariants npx tsx scripts/test-voice-v3-architecture-invariants.ts || FAIL=1
run_one pipeline_boundary npx tsx scripts/test-voice-v3-pipeline-boundary.ts || FAIL=1

echo "===== STATIC_GATE_SUMMARY fail_count=$FAIL =====" | tee -a "$LOG"
grep '^RESULT:' "$LOG" | tee -a "$LOG"
exit $FAIL
