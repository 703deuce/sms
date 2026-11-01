void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec4 c = transition(uv);
  c.rgb += vec3(ratio * 1e-8 + uRes.x * 1e-8 + progress * 1e-8);
  o = vec4(floor(clamp(c.rgb, 0.0, 1.0) * 255.0 + 0.5) / 255.0, 1.0);
}
