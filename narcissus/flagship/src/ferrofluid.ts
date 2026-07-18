// Shared ferrofluid/fresnel shader — a dark core with a glowing red rim-bloom that pulses under tension.
// Used by the graph hub (canonicalize) and the story-view loom knots, so the ferrofluid signature is
// consistent across both views (LEXI ferrofluid-orb lineage).
export const ferroVert = /* glsl */`
  varying vec3 vN; varying vec3 vV;
  void main(){
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
export const ferroFrag = /* glsl */`
  uniform float uTime; uniform vec3 uColor; uniform float uDim;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.4);
    float pulse = 0.86 + 0.14 * sin(uTime * 1.8);
    vec3 col = uColor * (0.3 + fres * 2.6 * pulse) * uDim;
    gl_FragColor = vec4(col, 1.0);
  }`;
