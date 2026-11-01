#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float progress;
uniform float ratio;
uniform vec2 uRes;
in vec2 vUv;
out vec4 o;

vec4 getFromColor(vec2 p) { return texture(uFrom, vec2(p.x, 1.0 - p.y)); }
vec4 getToColor(vec2 p) { return texture(uTo, vec2(p.x, 1.0 - p.y)); }

uint tr_pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float tr_hash(vec2 uv) {
  uvec2 p = uvec2(clamp(floor(uv * uRes), vec2(0.0), uRes - 1.0));
  return float(tr_pcg(p.x + tr_pcg(p.y)) >> 8u) / 16777216.0;
}
float tr_hash1(uint i) { return float(tr_pcg(i) >> 8u) / 16777216.0; }
