# Batch 6 opt-in timing sampler (incomplete standalone integration)

This change introduces a pure 30fps output-local timing sampler, with piecewise source
rates, freeze holds, and explicit A/B transition sampling. No existing ClipEditsV2
payload is changed; all legacy renders and editor geometry remain untouched.

The sampler does NOT yet connect to the template compiler, browser preview or the
FFmpeg worker. It is not a user-visible Batch 6 release and must not be marked ready
until both renderers consume an identical validated sequence plan and decoded-frame
parity, audio policy and cache revision tests pass. The connector environment cannot
execute repository TypeScript/FFmpeg checks. No worker files were changed.

Transition source-audio blending and hold policy must be specified at the renderer
boundary. The template publication gate should fail closed for ramps/holds until
the worker and preview render exactly the same frame-local plan. Existing fixed
slot speed, effects and transition paths from Batch 3 remain unchanged.
