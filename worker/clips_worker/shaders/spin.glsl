// Author: gre
// License: MIT
// Modified for Transovo (2026): SAMPLES 24→12; hash → tr_hash. Upstream: WhipSpin.glsl @ b28fce3
const float turns = 1.0;
const float blur = 0.5;
const float chroma = 0.6;
const float zoom = 0.25;
const float PI = 3.141592653589793;
const int SAMPLES = 12;

vec2 mirror(vec2 v) {
  vec2 m = mod(v, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

float rollAngle(float t) {
  float halfTurn = PI * turns;
  if (t < 0.5) {
    float x = 2.0 * t;
    return halfTurn * x * x * x;
  }
  float x = 2.0 - 2.0 * t;
  return -halfTurn * x * x * x;
}

vec4 transition(vec2 uv) {
  float p = progress;
  float h = 1.0 - abs(2.0 * p - 1.0);
  float shutter = blur * 0.1 * h;
  float scale = 1.0 + zoom * h * h * h;
  vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
  float jitter = tr_hash(uv * vec2(ratio, 1.0) * 731.0);
  vec3 color = vec3(0.0);
  vec3 weight = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float s = (float(i) + jitter) / float(SAMPLES) - 0.5;
    float t = clamp(p + s * shutter, 0.0, 1.0);
    float a = rollAngle(t);
    float c = cos(a), sn = sin(a);
    vec2 r = vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y) / scale;
    vec2 suv = mirror(r / vec2(ratio, 1.0) + 0.5);
    vec4 col = t < 0.5 ? getFromColor(suv) : getToColor(suv);
    vec3 w = max(vec3(1.0 - 4.0 * chroma * s, 1.0, 1.0 + 4.0 * chroma * s), 0.0);
    color += col.rgb * col.a * w;
    weight += col.a * w;
    alpha += col.a;
  }
  return vec4(color / max(weight, vec3(1e-5)), alpha / float(SAMPLES));
}
