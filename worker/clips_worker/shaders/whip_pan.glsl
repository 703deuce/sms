// Author: gre
// License: MIT
// Modified for Transovo (2026): samples 24→12; rand → tr_hash; direction=left. Upstream: WhipPan.glsl @ b28fce3
const vec2 direction = vec2(-1.0, 0.0);
const float blur = 0.4;
const int SAMPLES = 12;

vec4 strip(vec2 q, vec2 d) {
  vec2 qt = q + d;
  if (dot(q - 0.5, -d) < 0.5 * dot(d, d)) {
    return getFromColor(clamp(q, 0.0, 1.0));
  }
  return getToColor(clamp(qt, 0.0, 1.0));
}

vec4 transition(vec2 uv) {
  vec2 d = sign(direction);
  float p = progress;
  float h = 1.0 - abs(2.0 * p - 1.0);
  float e = 0.5 * h * (0.1 + 0.9 * h * h);
  float pos = p < 0.5 ? e : 1.0 - e;
  float len = blur * h * (0.1 + 2.7 * h * h) / 2.8;
  vec2 q = uv - d * pos;
  float jitter = tr_hash(uv);
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + jitter) / float(SAMPLES) - 0.5;
    vec4 c = strip(q + d * t * len, d);
    color += c.rgb * c.a;
    alpha += c.a;
  }
  return vec4(color / max(alpha, 1e-5), alpha / float(SAMPLES));
}
