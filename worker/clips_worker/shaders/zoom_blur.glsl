// License: MIT
// Modified for Transovo (2026): taps 40→16; rand → tr_hash. Upstream: CrossZoom.glsl @ b28fce3
const float strength = 0.4;
const float PI = 3.141592653589793;
const int TAPS = 16;

float Linear_ease(float begin, float change, float duration, float time) {
  return change * time / duration + begin;
}
float Exponential_easeInOut(float begin, float change, float duration, float time) {
  if (time == 0.0) return begin;
  if (time == duration) return begin + change;
  time = time / (duration / 2.0);
  if (time < 1.0) return change / 2.0 * pow(2.0, 10.0 * (time - 1.0)) + begin;
  return change / 2.0 * (-pow(2.0, -10.0 * (time - 1.0)) + 2.0) + begin;
}
float Sinusoidal_easeInOut(float begin, float change, float duration, float time) {
  return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}
vec4 crossFade(vec2 uv, float dissolve) {
  return mix(getFromColor(uv), getToColor(uv), dissolve);
}
vec4 transition(vec2 uv) {
  vec2 texCoord = uv.xy;
  vec2 center = vec2(Linear_ease(0.25, 0.5, 1.0, progress), 0.5);
  float dissolve = Exponential_easeInOut(0.0, 1.0, 1.0, progress);
  float str = Sinusoidal_easeInOut(0.0, strength, 0.5, progress);
  vec4 color = vec4(0.0);
  float total = 0.0;
  vec2 toCenter = center - texCoord;
  float offset = tr_hash(uv);
  for (int i = 0; i < TAPS; i++) {
    float t = float(i);
    float percent = (t + offset) / float(TAPS);
    float weight = 4.0 * (percent - percent * percent);
    color += crossFade(texCoord + toCenter * percent * str, dissolve) * weight;
    total += weight;
  }
  return color / total;
}
