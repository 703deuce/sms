void main() {
  vec4 c = transition(vec2(vUv.x, 1.0 - vUv.y));
  o = vec4(floor(clamp(c.rgb, 0.0, 1.0) * 255.0 + 0.5) / 255.0, 1.0);
}
