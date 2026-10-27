/**
 * Template preview seeding runs in the worker (real T2V assemble/finalize pipeline).
 *
 * Do not run during normal dev — reserved for final test pass.
 *
 *   PYTHONPATH=worker python worker/scripts/seed_t2v_template_previews.py [--force]
 *
 * Requires: DATABASE_URL, clip storage env, ffmpeg on PATH.
 */
console.error(
  'Use worker/scripts/seed_t2v_template_previews.py (see file header). This entrypoint is intentionally disabled.',
)
process.exit(1)
