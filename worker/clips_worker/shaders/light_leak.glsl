// Author: Anastasia Dunbar
// License: MIT
// Modified for Transovo (2026): blur repeats 50→12; sin-hashes → tr_hash1. Upstream: FilmBurn.glsl @ b28fce3
const float Seed = 2.31;
const float repeats = 12.0;

float sigmoid(float x, float a) {
  float b = pow(x * 2.0, a) / 2.0;
  if (x > 0.5) b = 1.0 - pow(2.0 - (x * 2.0), a) / 2.0;
  return b;
}
float apow(float a, float b) { return pow(abs(a), b) * sign(b); }
vec3 pow3(vec3 a, vec3 b) { return vec3(apow(a.r, b.r), apow(a.g, b.g), apow(a.b, b.b)); }
float smooth_mix(float a, float b, float c) { return mix(a, b, sigmoid(c, 2.0)); }
float tr_rand1(float co) { return tr_hash1(uint(floor(co * 1000.0 + Seed * 10.0))); }
float tr_rand2(vec2 co) { return tr_hash(co + vec2(Seed, 0.0)); }
float random(vec2 co, float shft) {
  co += 10.0;
  return smooth_mix(
    tr_rand2(floor(co)),
    tr_rand2(floor(co + vec2(1.0, 0.0))),
    fract(shft));
}
float smooth_random(vec2 co, float shft) {
  return smooth_mix(
    smooth_mix(random(floor(co), shft), random(floor(co + vec2(1.0, 0.0)), shft), fract(co.x)),
    smooth_mix(random(floor(co + vec2(0.0, 1.0)), shft), random(floor(co + vec2(1.0, 1.0)), shft), fract(co.x)),
    fract(co.y));
}
vec4 blendedColor(vec2 p) { return mix(getFromColor(p), getToColor(p), sigmoid(progress, 10.0)); }
const float pi = 3.14159265358979323;

vec4 transition(vec2 p) {
  vec3 f = vec3(0.0);
  for (float i = 0.0; i < 13.0; i++) {
    f += sin(((p.x * tr_rand1(i) * 6.0) + (progress * 8.0)) + tr_rand1(i + 1.43))
       * sin(((p.y * tr_rand1(i + 4.4) * 6.0) + (progress * 6.0)) + tr_rand1(i + 2.4));
    f += 1.0 - clamp(length(p - vec2(smooth_random(vec2(progress * 1.3), i + 1.0), smooth_random(vec2(progress * 0.5), i + 6.25))) * mix(20.0, 70.0, tr_rand1(i)), 0.0, 1.0);
  }
  f += 4.0;
  f /= 11.0;
  f = pow3(f * vec3(1.0, 0.7, 0.6), vec3(1.0, 2.0 - sin(progress * pi), 1.3));
  f *= sin(progress * pi);
  p -= 0.5;
  p *= 1.0 + (smooth_random(vec2(progress * 5.0), 6.3) * sin(progress * pi) * 0.05);
  p += 0.5;
  vec4 blurred_image = vec4(0.0);
  float bluramount = sin(progress * pi) * 0.03;
  for (float i = 0.0; i < repeats; i++) {
    vec2 q = vec2(cos(radians((i / repeats) * 360.0)), sin(radians((i / repeats) * 360.0))) * (tr_rand2(vec2(i, p.x + p.y)) + bluramount);
    vec2 uv2 = p + (q * bluramount);
    blurred_image += blendedColor(uv2);
  }
  blurred_image /= repeats;
  return blurred_image + vec4(f, 0.0);
}
