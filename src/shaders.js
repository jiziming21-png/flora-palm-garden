// The translucent veil and its point cloud share the same GPU deformation.
// aDetail stores longitudinal/across-petal coordinates, whorl and opening phase.
const flowerDeformation = /* glsl */ `
  uniform float uTime;
  uniform float uBloom;
  uniform float uPixelRatio;
  uniform float uMotion;
  uniform vec3 uPointer;
  uniform float uInfluence;
  attribute vec3 aBud;
  attribute vec4 aMeta;
  attribute vec4 aDetail;
  varying float vGradient;
  varying float vAlpha;
  varying float vPart;
  varying float vSeed;
  varying vec4 vDetail;
  vec3 deformFlower() {
    float part = aMeta.w;
    float delay = aDetail.z * 0.085 + aDetail.w * 0.025;
    float stagger = smoothstep(delay, 0.88 + delay, uBloom);
    vec3 p = mix(aBud, position, stagger);
    float petal = 1.0 - step(0.5, part);
    p.y += sin(uTime * 0.85 + aDetail.w * 6.28 + p.x * 1.5 + aDetail.x * 1.8) * 0.022 * stagger * petal * uMotion;
    p.xz *= 1.0 + sin(uTime * 0.7) * 0.009 * uMotion;
    // One continuous, quiet sway connects the blossom, stalk and leaf nodes.
    float heightWeight = clamp((p.y + 3.27) / 3.8, 0.0, 1.0);
    p.x += sin(uTime * 0.48) * heightWeight * heightWeight * 0.045 * uMotion;
    if (part > 2.5) {
      p.x += sin(uTime * 0.33 + aMeta.z * 40.0) * 0.08 * uMotion;
      p.y += sin(uTime * 0.45 + aMeta.z * 20.0) * 0.12 * uMotion;
    }
    vec3 delta = p - uPointer;
    float distanceToFinger = length(delta);
    float influence = exp(-distanceToFinger * distanceToFinger * 2.2) * uInfluence;
    p += normalize(delta + vec3(0.001)) * influence * 0.18;
    p.y += sin(distanceToFinger * 10.0 - uTime * 3.0) * influence * 0.055 * uMotion;
    vGradient = aMeta.y;
    vPart = part;
    vSeed = aMeta.z;
    vDetail = aDetail;
    vAlpha = (0.48 + 0.44 * aMeta.z) * (0.78 + 0.22 * stagger);
    if (part < 0.5) vAlpha *= 0.72 + pow(abs(aDetail.y), 5.0) * 0.28;
    if (part > 0.5 && part < 1.5) vAlpha *= smoothstep(0.25, 0.7, uBloom);
    if (part > 2.5) vAlpha *= smoothstep(0.45, 0.95, uBloom) * 0.60;
    return p;
  }
`;

export const flowerVertex = /* glsl */ `
  ${flowerDeformation}
  void main() {
    vec3 p = deformFlower();
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aMeta.x * uPixelRatio * (11.0 / -mv.z), 0.85, 3.8 * uPixelRatio);
  }
`;

export const flowerFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform vec3 uInnerColor;
  uniform vec3 uOuterColor;
  varying float vGradient;
  varying float vAlpha;
  varying float vPart;
  varying float vSeed;
  varying vec4 vDetail;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.32, 0.86, d);
    float halo = (1.0 - d) * 0.15;
    float scintillation = 0.88 + 0.12 * sin(uTime * 1.25 * uMotion + vSeed * 91.0);
    float alpha = (core * 0.86 + halo) * vAlpha * scintillation;
    vec3 color = mix(uInnerColor, uOuterColor, smoothstep(0.0, 0.95, vGradient));
    color *= 0.82 + 0.18 * cos(vDetail.y * 3.0);
    color = mix(color, uOuterColor, step(0.965, vSeed) * 0.48);
    if (vPart > 0.5 && vPart < 1.5) color = mix(vec3(0.32, 0.16, 0.045), vec3(1.0, 0.75, 0.34), vGradient);
    if (vPart > 1.5 && vPart < 2.5) {
      color = mix(vec3(0.075, 0.15, 0.10), vec3(0.40, 0.56, 0.30), vGradient);
      float midrib = 1.0 - smoothstep(0.01, 0.10, abs(vDetail.y));
      color = mix(color, vec3(0.63, 0.69, 0.40), midrib * 0.24);
    }
    if (vPart > 2.5) color = mix(uOuterColor, vec3(1.0, 0.76, 0.43), vSeed * 0.5);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const petalVertex = /* glsl */ `
  ${flowerDeformation}
  attribute vec3 aBudNormal;
  varying vec3 vNormal;
  void main() {
    vec3 p = deformFlower();
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float delay = aDetail.z * 0.085 + aDetail.w * 0.025;
    float open = smoothstep(delay, 0.88 + delay, uBloom);
    vNormal = normalize(normalMatrix * normalize(mix(aBudNormal, normal, open) + vec3(0.0, 0.00001, 0.0)));
    gl_Position = projectionMatrix * mv;
  }
`;

export const petalFragment = /* glsl */ `
  uniform float uBloom;
  uniform vec3 uInnerColor;
  uniform vec3 uOuterColor;
  varying vec3 vNormal;
  varying float vGradient;
  varying vec4 vDetail;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 light = normalize(vec3(-0.45, 0.65, 1.0));
    float diffuse = abs(dot(normal, light));
    float rim = pow(1.0 - abs(normal.z), 2.0);
    float vein = pow(0.5 + 0.5 * sin(vDetail.y * 29.0 + vDetail.x * 2.8), 16.0);
    vec3 color = mix(uInnerColor, uOuterColor, pow(vGradient, 1.38));
    color *= (0.26 + diffuse * 0.63 + vein * 0.04) * (1.0 - vDetail.z * 0.12);
    color *= 0.62 + 0.38 * smoothstep(0.04, 0.72, vDetail.x);
    color *= 1.0 - pow(1.0 - abs(vDetail.y), 3.0) * sin(vDetail.x * 3.14159) * 0.23;
    color += uOuterColor * rim * 0.085;
    // A very thin veil preserves volume while keeping individual grains visible.
    // No depth-writing solid shell hides the particles on the far petals.
    float opacity = (0.085 + diffuse * 0.035 + rim * 0.04)
      * (0.55 + 0.45 * smoothstep(0.1, 0.8, uBloom));
    gl_FragColor = vec4(color, opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.13 + aSeed * 40.0) * 0.25 * uMotion;
    p.x += cos(uTime * 0.09 + aSeed * 20.0) * 0.18 * uMotion;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.6 + aSeed * 1.8) * uPixelRatio;
    vAlpha = 0.06 + aSeed * aSeed * 0.22;
  }
`;
export const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(0.7, 0.79, 0.48, (1.0 - d) * vAlpha);
  }
`;
