// Author: gre
// License: MIT
// Modified for Transovo (2026): uniforms baked as consts; integer hash; reduced samples. Upstream: gl-transitions/transitions/Ripple.glsl @ b28fce3eaeaa10d2cc09fe85b4615052da02e37b
const float amplitude = 100.0;
const float speed = 50.0;

vec4 transition(vec2 uv) {
  vec2 dir = uv - vec2(0.5);
  float dist = length(dir);
  vec2 offset = dir * (sin(progress * dist * amplitude - progress * speed) + 0.5) / 30.0 * progress;
  return mix(getFromColor(uv + offset), getToColor(uv), smoothstep(0.2, 1.0, progress));
}
