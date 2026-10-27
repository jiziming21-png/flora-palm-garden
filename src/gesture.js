export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const damp = (current, target, delta, speed = 8) => current + (target - current) * (1 - Math.exp(-speed * delta));
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

function jointExtension(a, b, c) {
  const ab = length(a, b);
  const bc = length(b, c);
  if (ab * bc < 1e-10) return 0;
  const dot = ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)
    + ((a.z || 0) - (b.z || 0)) * ((c.z || 0) - (b.z || 0))) / (ab * bc);
  return (1 - clamp(dot, -1, 1)) / 2;
}

export function analyzeHand(landmarks, worldLandmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21 || landmarks.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const points = worldLandmarks?.length === 21 && worldLandmarks.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) ? worldLandmarks : landmarks;
  // Bone-length ratios and joint angles are invariant to scale/rotation.
  // Four fingers carry the openness signal; thumb placement varies in a fist.
  const extension = [5, 9, 13, 17].map(base => {
    const [mcp, pip, dip, tip] = points.slice(base, base + 4);
    const chain = length(mcp, pip) + length(pip, dip) + length(dip, tip);
    if (chain < 1e-6) return 0;
    const straightness = clamp((length(mcp, tip) / chain - 0.42) / 0.53);
    const joint = clamp((jointExtension(mcp, pip, dip) - 0.45) / 0.5);
    return straightness * 0.65 + joint * 0.35;
  });
  const openness = clamp(extension.reduce((sum, n) => sum + n, 0) / extension.length);
  return {
    openness,
    // Match the mirrored camera preview: rightward motion stays rightward.
    indexTip: { x: clamp(1 - landmarks[8].x), y: clamp(landmarks[8].y) },
    extension,
  };
}

export function gestureLabel(openness, previous = '') {
  // Hysteresis prevents labels flickering around the threshold.
  if (openness < (previous === '轻握 · 含苞' ? 0.32 : 0.23)) return '轻握 · 含苞';
  if (openness > (previous === '张开 · 盛放' ? 0.67 : 0.78)) return '张开 · 盛放';
  return '舒展 · 生长';
}
