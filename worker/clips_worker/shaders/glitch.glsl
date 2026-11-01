// Author: Gunnar Roth
// based on work from natewave
// License: MIT
// Modified for Transovo (2026): uniforms baked as consts; integer hash; reduced samples. Upstream: gl-transitions/transitions/GlitchMemories.glsl @ b28fce3eaeaa10d2cc09fe85b4615052da02e37b
vec4 transition(vec2 p) {
  vec2 block = floor(p.xy / vec2(16.0));
  vec2 uv_noise = block / vec2(64.0);
  uv_noise += floor(vec2(progress) * vec2(1200.0, 3500.0)) / vec2(64.0);
  vec2 dist = progress > 0.0 ? (fract(uv_noise) - 0.5) * 0.3 * (1.0 - progress) : vec2(0.0);
  vec2 red = p + dist * 0.2;
  vec2 green = p + dist * 0.3;
  vec2 blue = p + dist * 0.5;
  vec4 center = mix(getFromColor(green), getToColor(green), progress);
  return vec4(mix(getFromColor(red), getToColor(red), progress).r, center.g, mix(getFromColor(blue), getToColor(blue), progress).b, center.a);
}
