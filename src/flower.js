import * as THREE from '../vendor/three.module.js';
import { flowerVertex, flowerFragment, petalVertex, petalFragment, dustVertex, dustFragment } from './shaders.js';

export const PALETTES = {
  rose: { name: '晨露粉', inner: '#a44e76', outer: '#ffcfdb' },
  ivory: { name: '月光白', inner: '#aa985c', outer: '#fff2cf' },
  lilac: { name: '暮山紫', inner: '#69419a', outer: '#e6ccff' },
  blue: { name: '雾霭蓝', inner: '#386f91', outer: '#c8edf4' },
};

const WHORLS = [
  { petals: 11, length: 2.58, width: 0.94, height: -0.20, cup: 0.40, rotation: 0.08 },
  { petals: 10, length: 2.20, width: 0.85, height: -0.07, cup: 0.49, rotation: 0.37 },
  { petals: 9, length: 1.82, width: 0.74, height: 0.06, cup: 0.56, rotation: 0.10 },
  { petals: 8, length: 1.43, width: 0.63, height: 0.17, cup: 0.60, rotation: 0.40 },
  { petals: 6, length: 1.00, width: 0.48, height: 0.27, cup: 0.56, rotation: 0.13 },
];

// The translucent petal veil and its point cloud sample this same surface.
// Keeping the rest shape, bud and opening phase shared prevents a second,
// disconnected flower from appearing during intermediate gesture states.
function petalSample(layer, petal, u, v) {
  const whorl = WHORLS[layer];
  const phase = ((petal * 0.61803398875 + layer * 0.173) % 1);
  const angle = petal / whorl.petals * Math.PI * 2 + whorl.rotation;
  const radius = 0.12 + u * whorl.length;
  const lateral = Math.pow(Math.sin(u * Math.PI), 0.49) * whorl.width * v;
  const twist = angle + Math.sin(u * Math.PI) * (0.075 + layer * 0.012);
  const edge = v * v;
  const y = whorl.height + Math.sin(u * Math.PI) * 0.28 + u * u * whorl.cup
    - Math.pow(u, 5) * 0.08 + edge * 0.24 * Math.sin(u * Math.PI)
    + Math.sin(v * 3.8 + phase * 5) * 0.028 * u * u;
  const budAngle = angle + v * 0.22 + u * 0.15;
  const budRadius = Math.pow(Math.sin(u * Math.PI), 0.7) * (0.53 - layer * 0.053) + 0.025;
  return {
    bloom: [Math.cos(twist) * radius - Math.sin(twist) * lateral, y, Math.sin(twist) * radius + Math.cos(twist) * lateral],
    bud: [Math.cos(budAngle) * budRadius, -0.24 + u * 1.73 + layer * 0.021, Math.sin(budAngle) * budRadius],
    gradient: Math.min(1, 0.12 + u * 0.73 + Math.abs(v) * 0.14),
    detail: [u, v, layer / (WHORLS.length - 1), phase],
  };
}

function randomGenerator(seed = 1209) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function stemSample(t) {
  return [-Math.sin(t * Math.PI) * 0.13 + t * 0.08, -0.22 - t * 3.05, Math.sin(t * 3.2) * 0.05];
}

const LEAVES = [
  { at: 0.40, side: -1, length: 1.30, width: 0.30, lift: 0.64, turn: 0.18 },
  { at: 0.69, side: 1, length: 1.46, width: 0.34, lift: 0.79, turn: 0.36 },
  { at: 0.18, side: 1, length: 0.67, width: 0.17, lift: 0.31, turn: -0.70 },
];

function leafSample(leaf, t, v) {
  const root = stemSample(leaf.at);
  const envelope = Math.pow(Math.sin(t * Math.PI), 0.85);
  const along = t * leaf.length;
  const across = v * envelope * leaf.width;
  return [
    root[0] + leaf.side * along * Math.cos(leaf.turn) - across * Math.sin(leaf.turn),
    root[1] + t * leaf.lift + envelope * 0.12 + Math.abs(v) * envelope * 0.08,
    root[2] + along * Math.sin(leaf.turn) + across * Math.cos(leaf.turn),
  ];
}

function createFlowerGeometry(count) {
  const random = randomGenerator();
  const positions = new Float32Array(count * 3);
  const buds = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);
  const detail = new Float32Array(count * 4);
  const petalCount = Math.floor(count * 0.79);
  const heartCount = Math.floor(count * 0.047);
  const stemEnd = Math.floor(count * 0.994);

  for (let i = 0; i < count; i++) {
    const k = i * 3;
    const m = i * 4;
    const seed = random();
    if (i < petalCount) {
      // Allocate more points to the broad outer whorls rather than the centre.
      const pick = random();
      const layer = pick < 0.31 ? 0 : pick < 0.57 ? 1 : pick < 0.78 ? 2 : pick < 0.925 ? 3 : 4;
      const petal = Math.floor(random() * WHORLS[layer].petals);
      const u = Math.pow(random(), 0.84);
      const distribution = random();
      // Fine dotted ribs and an interrupted rim, with air between the grains.
      const v = distribution < 0.14 ? (random() < 0.5 ? -1 : 1) * (0.96 + random() * 0.04)
        : distribution < 0.40 ? Math.max(-1, Math.min(1, (Math.floor(random() * 17) - 8) / 8 + (random() - 0.5) * 0.018))
        : random() * 2 - 1;
      const sample = petalSample(layer, petal, u, v);
      positions.set(sample.bloom, k);
      positions[k + 1] += 0.012 + Math.pow(random(), 5) * 0.065;
      buds.set(sample.bud, k);
      meta[m] = seed > 0.965 ? 2.7 : 0.75 + random() * 1.20;
      meta[m + 1] = sample.gradient;
      meta[m + 2] = seed;
      meta[m + 3] = 0;
      detail.set(sample.detail, m);
    } else if (i < petalCount + heartCount) {
      // Tiny golden anthers, distributed in the same golden-angle pattern
      // as real seed heads, with slender filaments beneath the pollen tips.
      const stamen = i % 173;
      const t = (stamen + 0.5) / 173;
      const r = Math.sqrt(t) * 0.34;
      const theta = stamen * 2.39996323;
      const cap = random() > 0.22;
      const height = cap ? 1 : random();
      const jitter = cap ? 0.018 : 0.004;
      positions[k] = Math.cos(theta) * r + (random() - 0.5) * jitter;
      positions[k + 1] = 0.35 + (0.10 + Math.sqrt(1 - t) * 0.18) * height + random() * jitter;
      positions[k + 2] = Math.sin(theta) * r + (random() - 0.5) * jitter;
      buds[k] = positions[k] * 0.19;
      buds[k + 1] = 0.4 + random() * 0.15;
      buds[k + 2] = positions[k + 2] * 0.19;
      meta[m] = cap ? 1.7 + random() * 1.2 : 0.8;
      meta[m + 1] = cap ? 0.5 + random() * 0.5 : 0.1;
      meta[m + 2] = seed;
      meta[m + 3] = 1;
    } else if (i < stemEnd) {
      // Every leaf grows from the same curved stem, with staggered attachments.
      const t = random();
      const stem = random() < 0.28;
      if (stem) {
        const angle = random() * Math.PI * 2;
        const center = stemSample(t);
        const radius = 0.026 * (1 - t * 0.56);
        positions.set([center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius], k);
        detail.set([t, 0, 0, 0], m);
      } else {
        const pick = random();
        const leaf = LEAVES[pick < 0.43 ? 0 : pick < 0.88 ? 1 : 2];
        const distribution = random();
        const v = distribution < 0.19 ? (random() - 0.5) * 0.025
          : distribution < 0.34 ? (random() < 0.5 ? -1 : 1) * (0.96 + random() * 0.04)
          : random() * 2 - 1;
        positions.set(leafSample(leaf, t, v), k);
        detail.set([t, v, 0, leaf.at], m);
      }
      buds.set(positions.subarray(k, k + 3), k);
      meta[m] = 0.75 + random() * 0.95;
      meta[m + 1] = stem ? 0.24 + (1 - t) * 0.26 : 0.42 + Math.sin(t * Math.PI) * 0.36;
      meta[m + 2] = seed;
      meta[m + 3] = 2;
    } else {
      const angle = random() * Math.PI * 2;
      const r = 1.55 + random() * 1.38;
      positions.set([Math.cos(angle) * r, 0.15 + random() * 1.1, Math.sin(angle) * r], k);
      buds.set(positions.subarray(k, k + 3), k);
      meta.set([0.8 + random() * 1.8, random(), seed, 3], m);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aBud', new THREE.BufferAttribute(buds, 3));
  geometry.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));
  geometry.setAttribute('aDetail', new THREE.BufferAttribute(detail, 4));
  // Cover both morph endpoints for culling, including the tall bud.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 4);
  return geometry;
}

function createPetalGeometry() {
  const positions = [], buds = [], meta = [], detail = [], normals = [], budNormals = [], indices = [];
  const rows = 32, columns = 20;
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), normal = new THREE.Vector3();
  WHORLS.forEach((whorl, layer) => {
    for (let petal = 0; petal < whorl.petals; petal++) {
      const offset = positions.length / 3;
      for (let row = 0; row <= rows; row++) {
        for (let column = 0; column <= columns; column++) {
          const u = row / rows, v = column / columns * 2 - 1;
          const sample = petalSample(layer, petal, u, v);
          positions.push(...sample.bloom);
          buds.push(...sample.bud);
          meta.push(1, sample.gradient, sample.detail[3], 0);
          detail.push(...sample.detail);
          const beforeU = petalSample(layer, petal, Math.max(0.0001, u - 0.001), v);
          const afterU = petalSample(layer, petal, Math.min(0.9999, u + 0.001), v);
          const beforeV = petalSample(layer, petal, Math.max(0.0001, Math.min(0.9999, u)), v - 0.001);
          const afterV = petalSample(layer, petal, Math.max(0.0001, Math.min(0.9999, u)), v + 0.001);
          for (const [shape, target] of [['bloom', normals], ['bud', budNormals]]) {
            du.set(afterU[shape][0] - beforeU[shape][0], afterU[shape][1] - beforeU[shape][1], afterU[shape][2] - beforeU[shape][2]);
            dv.set(afterV[shape][0] - beforeV[shape][0], afterV[shape][1] - beforeV[shape][1], afterV[shape][2] - beforeV[shape][2]);
            normal.crossVectors(du, dv).normalize();
            target.push(normal.x, normal.y, normal.z);
          }
        }
      }
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const a = offset + row * (columns + 1) + column;
          const b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aBud', new THREE.Float32BufferAttribute(buds, 3));
  geometry.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 4));
  geometry.setAttribute('aDetail', new THREE.Float32BufferAttribute(detail, 4));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aBudNormal', new THREE.Float32BufferAttribute(budNormals, 3));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  return geometry;
}

export class FlowerGarden {
  constructor(container, { reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.count = matchMedia('(max-width: 760px)').matches ? 52000 : 96000;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.10;
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    this.camera.position.set(0, 5.2, 9.8);
    this.camera.lookAt(0, -0.52, 0);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    const pixelRatio = this.renderer.getPixelRatio();
    this.uniforms = {
      uTime: { value: 0 }, uBloom: { value: 0.85 },
      uPixelRatio: { value: pixelRatio }, uMotion: { value: reducedMotion ? 0 : 1 },
      uPointer: { value: new THREE.Vector3(20, 20, 20) }, uInfluence: { value: 0 },
      uInnerColor: { value: new THREE.Color(PALETTES.rose.inner) },
      uOuterColor: { value: new THREE.Color(PALETTES.rose.outer) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: flowerVertex, fragmentShader: flowerFragment,
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.flower = new THREE.Points(createFlowerGeometry(this.count), this.material);
    this.flower.renderOrder = 2;
    this.petals = new THREE.Mesh(createPetalGeometry(), new THREE.ShaderMaterial({
      vertexShader: petalVertex, fragmentShader: petalFragment,
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
    this.petals.renderOrder = 1;
    this.group.add(this.petals);
    this.group.add(this.flower);
    this.addDust();
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.pointerWorld = new THREE.Vector3(20, 20, 20);
    this.pointerLocal = new THREE.Vector3();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
    this.target = new THREE.Vector3();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  addDust() {
    const random = randomGenerator(9);
    const positions = new Float32Array(600 * 3);
    const seeds = new Float32Array(600);
    for (let i = 0; i < 600; i++) {
      positions[i * 3] = (random() - 0.5) * 20;
      positions[i * 3 + 1] = (random() - 0.5) * 8;
      positions[i * 3 + 2] = (random() - 0.5) * 12 - 2;
      seeds[i] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: dustVertex, fragmentShader: dustFragment,
      uniforms: { uTime: this.uniforms.uTime, uPixelRatio: this.uniforms.uPixelRatio, uMotion: this.uniforms.uMotion },
      transparent: true, depthWrite: false,
    });
    this.dust = new THREE.Points(geometry, material);
    this.scene.add(this.dust);
  }

  resize() {
    const bounds = this.container.getBoundingClientRect();
    const { width, height } = bounds;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.mobile = matchMedia('(max-width: 760px)').matches;
    // Keep a sizeable desktop bloom without letting the large whorls grow
    // underneath the introduction or the camera card on narrower screens.
    const unitWidth = height / (2 * Math.tan(THREE.MathUtils.degToRad(this.mobile ? 45 : 37) / 2)) * 5.45 / 11.1;
    this.horizontalTravel = this.mobile ? 0.18 : width < 1100 ? 0.16 : 0.42;
    const intro = this.container.parentElement.querySelector('.intro')?.getBoundingClientRect();
    const card = this.container.parentElement.querySelector('.camera-card')?.getBoundingClientRect();
    const left = intro ? intro.right - bounds.left + 24 : width * 0.25;
    const right = card ? card.left - bounds.left - 24 : width * 0.80;
    const followMargin = this.horizontalTravel * unitWidth / 5.45;
    const availableWidth = this.mobile ? width * 0.89 : Math.max(120, right - left - followMargin);
    this.displayScale = Math.min(this.mobile ? 0.95 : 1.36, availableWidth / unitWidth);
    this.camera.fov = this.mobile ? 45 : 37;
    const centerX = this.mobile ? width / 2 : (left + right) / 2;
    this.camera.setViewOffset(width, height, width / 2 - centerX, this.mobile ? height * 0.015 : 0, width, height);
    this.camera.updateProjectionMatrix();
  }

  pointer(x, y, influence = 1) {
    this.pointerNdc.set(x * 2 - 1, 1 - y * 2);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.pointerWorld);
    this.pointerStrength = influence;
  }

  follow(x, y, strength = 1) {
    // x/y are mirrored display coordinates, normalized in [0,1].
    this.target.set((x - 0.5) * this.horizontalTravel * strength, (0.5 - y) * 0.60 * strength, 0);
  }

  setPalette(key) {
    const palette = PALETTES[key];
    if (!palette) return;
    this.uniforms.uInnerColor.value.set(palette.inner);
    this.uniforms.uOuterColor.value.set(palette.outer);
  }

  update(time, delta, bloom) {
    const smoothing = 1 - Math.exp(-delta * 6.5);
    this.uniforms.uTime.value = time;
    this.uniforms.uBloom.value += (bloom - this.uniforms.uBloom.value) * smoothing;
    const followSmoothing = 1 - Math.exp(-delta * 3);
    this.group.position.x += (this.target.x - this.group.position.x) * followSmoothing;
    this.group.position.y += (this.target.y + (this.mobile ? 0.12 : 0) - this.group.position.y) * followSmoothing;
    this.group.rotation.y = this.reducedMotion ? 0.25 : 0.25 + Math.sin(time * 0.12) * 0.18;
    this.group.rotation.z = this.reducedMotion ? -0.04 : Math.sin(time * 0.23) * 0.018 - 0.04;
    this.group.scale.setScalar(this.displayScale);
    this.group.updateMatrixWorld();
    this.pointerLocal.copy(this.pointerWorld);
    this.group.worldToLocal(this.pointerLocal);
    this.uniforms.uPointer.value.lerp(this.pointerLocal, smoothing);
    this.uniforms.uInfluence.value += ((this.pointerStrength || 0) - this.uniforms.uInfluence.value) * smoothing;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    for (const points of [this.flower, this.petals, this.dust]) {
      points.geometry.dispose(); points.material.dispose();
    }
    this.renderer.dispose();
  }
}
