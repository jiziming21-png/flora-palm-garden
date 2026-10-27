import { FlowerGarden, PALETTES } from './flower.js';
import { HandTracker, cameraErrorMessage } from './hand-tracker.js';
import { analyzeHand, damp, gestureLabel } from './gesture.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { auto: !reducedMotion, manualBloom: 0.85, handBloom: 0.85, camera: false, starting: false, lastHandAt: 0, handPresent: false, palette: 'rose' };
let garden;
let tracker;
let toastTimer;
let previousGesture = '';
let animationFrame;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3300);
}

function setAuto(value) {
  state.auto = value;
  $('auto-button').classList.toggle('active', value);
  $('auto-button').setAttribute('aria-pressed', String(value));
}

function setBloomUI(value) {
  const percentage = Math.round(value * 100);
  $('bloom-range').value = percentage;
  $('bloom-range').style.setProperty('--range', `${percentage}%`);
  $('bloom-value').replaceChildren(String(percentage), Object.assign(document.createElement('span'), { textContent: '%' }));
}

function setPalette(key) {
  if (!PALETTES[key]) return;
  state.palette = key;
  garden?.setPalette(key);
  $('palette-name').textContent = PALETTES[key].name;
  document.querySelectorAll('.swatch').forEach(button => {
    const active = button.dataset.palette === key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function cameraUI(active) {
  state.camera = active;
  document.body.classList.toggle('tracking', active);
  $('camera-button').querySelector('span').textContent = active ? '关闭摄像头' : '开启摄像头';
  $('camera-placeholder').hidden = active;
  $('preview-live').hidden = !active;
  $('camera-badge').textContent = active ? '等待手势' : '未连接';
  $('bloom-range').disabled = active;
  $('bloom-range').title = active ? '手势控制中，关闭摄像头后可手动调整' : '';
  $('auto-button').disabled = active;
  $('mode-label').textContent = active ? '等待手势' : state.auto ? '自由演示' : '指尖漫游';
}

function stopCamera({ message = '摄像头已关闭，继续享受指尖花园。' } = {}) {
  tracker?.stop();
  state.handPresent = false;
  state.lastHandAt = 0;
  previousGesture = '';
  garden?.follow(0.5, 0.5, 0);
  if (garden) garden.pointerStrength = 0;
  cameraUI(false);
  $('camera-message').textContent = message;
}

function handleTrackingError(error) {
  console.warn('Hand tracking stopped:', error);
  stopCamera({ message: cameraErrorMessage(error) });
  $('camera-badge').textContent = '可重试';
  toast('手势感应已暂停，仍可用鼠标与滑杆体验。');
}

function handleHand(landmarks, worldLandmarks) {
  const hand = analyzeHand(landmarks, worldLandmarks);
  if (!hand) {
    state.handPresent = false;
    return;
  }
  state.handPresent = true;
  state.lastHandAt = performance.now();
  state.handBloom = hand.openness;
  garden.follow(hand.indexTip.x, hand.indexTip.y);
  garden.pointer(hand.indexTip.x, hand.indexTip.y, 1);
}

async function toggleCamera() {
  if (state.starting) return;
  if (state.camera) { stopCamera(); return; }
  state.starting = true;
  $('camera-button').disabled = true;
  $('camera-badge').textContent = '连接中';
  $('camera-button').querySelector('span').textContent = '正在连接…';
  try {
    const started = await tracker.start(message => { $('camera-message').textContent = message; });
    if (started) {
      cameraUI(true);
      $('camera-message').textContent = '将整只手放入画面，缓缓握拳或张开。';
      toast('花园已感应，伸出手试试看。');
    } else {
      cameraUI(false);
    }
  } catch (error) {
    handleTrackingError(error);
  } finally {
    state.starting = false;
    $('camera-button').disabled = false;
    $('camera-button').querySelector('span').textContent = state.camera ? '关闭摄像头' : '开启摄像头';
  }
}

function reset() {
  if (state.camera) stopCamera();
  setPalette('rose');
  state.manualBloom = 0.85;
  setAuto(!reducedMotion);
  garden.follow(0.5, 0.5, 0);
  garden.pointerStrength = 0;
  $('mode-label').textContent = state.auto ? '自由演示' : '指尖漫游';
  $('camera-message').textContent = '开启摄像头，让花朵回应你的手势。';
  $('camera-badge').textContent = '未连接';
  setBloomUI(state.manualBloom);
  toast('回到初见，重新生长。');
}

function setupControls() {
  document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => setPalette(button.dataset.palette)));
  $('bloom-range').addEventListener('input', event => {
    state.manualBloom = Number(event.target.value) / 100;
    setAuto(false);
    $('mode-label').textContent = '手动绽放';
    setBloomUI(state.manualBloom);
  });
  $('auto-button').addEventListener('click', () => {
    if (state.auto) state.manualBloom = garden.uniforms.uBloom.value;
    setAuto(!state.auto);
    $('mode-label').textContent = state.auto ? '自由演示' : '指尖漫游';
  });
  $('reset-button').addEventListener('click', reset);
  $('camera-button').addEventListener('click', toggleCamera);
  $('scene').addEventListener('pointermove', event => {
    if (state.camera) return;
    const rect = $('scene').getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    garden.pointer(x, y, 0.8);
    garden.follow(x, y, 0.16);
  });
  $('scene').addEventListener('pointerleave', () => {
    if (state.camera) return;
    garden.pointerStrength = 0;
    garden.follow(0.5, 0.5, 0);
  });
  $('scene').addEventListener('pointerup', event => {
    if (event.pointerType === 'touch' && !state.camera) garden.pointerStrength = 0;
  });
  $('fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.querySelector('.garden').requestFullscreen) await document.querySelector('.garden').requestFullscreen();
      else toast('当前浏览器暂不支持全屏模式。');
    } catch { toast('当前浏览器无法进入全屏，可使用浏览器全屏功能。'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const full = Boolean(document.fullscreenElement);
    $('fullscreen-button').setAttribute('aria-label', full ? '退出全屏' : '进入全屏');
    $('fullscreen-button').title = full ? '退出全屏' : '全屏';
  });
  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.repeat || state.camera || $('help-dialog').open) return;
    if (['INPUT', 'BUTTON', 'A', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    event.preventDefault();
    setAuto(false);
    state.manualBloom = garden.uniforms.uBloom.value > 0.5 ? 0 : 1;
    setBloomUI(state.manualBloom);
    $('mode-label').textContent = '手动绽放';
  });
}

$('help-button').addEventListener('click', () => $('help-dialog').showModal());
for (const id of ['close-help', 'got-it']) $(id).addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const r = $('help-dialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('help-dialog').close(); } });

try {
  garden = new FlowerGarden($('scene'), { reducedMotion });
  tracker = new HandTracker($('video'), $('landmarks'), handleHand, handleTrackingError);
  $('particle-count').textContent = `${garden.count.toLocaleString('en-US')} POINTS OF POSSIBILITY`;
  setAuto(state.auto);
  setupControls();
  let lastTime = performance.now();
  let elapsed = 0;
  let lastUiTime = 0;
  let frames = 0;
  let fpsTime = lastTime;
  let visibleBloom = 0.85;

  function animate(now) {
    animationFrame = requestAnimationFrame(animate);
    const delta = Math.min((now - lastTime) / 1000, 0.06);
    lastTime = now;
    if (document.hidden) return;
    elapsed += delta;
    let bloom = state.manualBloom;
    if (state.camera) {
      if (state.lastHandAt && now - state.lastHandAt < 650) {
        bloom = state.handBloom;
      } else {
        // Hold the flower briefly during occlusion, then ease back to neutral.
        bloom = state.lastHandAt ? 0.65 : state.manualBloom;
        garden.follow(0.5, 0.5, 0);
        garden.pointerStrength = 0;
      }
    } else if (state.auto) {
      bloom = 0.58 + Math.sin(elapsed * 0.36 + 0.6) * 0.4;
    }
    visibleBloom = damp(visibleBloom, bloom, delta, 7);
    garden.update(elapsed, delta, bloom);
    frames++;
    if (now - fpsTime > 1000) {
      $('fps').textContent = `${Math.round(frames * 1000 / (now - fpsTime))} FPS`;
      fpsTime = now;
      frames = 0;
    }
    if (now - lastUiTime > 100) {
      setBloomUI(state.camera || state.auto ? visibleBloom : state.manualBloom);
      if (state.camera) {
        const found = state.lastHandAt && now - state.lastHandAt < 650;
        previousGesture = found ? gestureLabel(visibleBloom, previousGesture) : '';
        $('mode-label').textContent = found ? previousGesture : '等待手势';
        $('camera-badge').textContent = found ? '已识别 · 21 点' : '等待手势';
        $('camera-message').textContent = found ? '跟随你的指尖，感受花朵的呼吸。' : '将整只手放入画面，保持光线充足。';
      }
      lastUiTime = now;
    }
  }
  garden.renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(animationFrame);
    stopCamera({ message: '图形上下文已中断，请刷新页面恢复花园。' });
    $('renderer-error').hidden = false;
    $('renderer-error').querySelector('h2').textContent = '花园暂时休息了';
    $('renderer-error').querySelector('p').textContent = '图形上下文已中断，请刷新页面恢复。';
  });
  garden.renderer.compile(garden.scene, garden.camera);
  $('loading-note').hidden = true;
  animationFrame = requestAnimationFrame(animate);
  document.addEventListener('visibilitychange', () => { lastTime = performance.now(); fpsTime = lastTime; frames = 0; });
  window.addEventListener('pagehide', () => {
    stopCamera();
    cancelAnimationFrame(animationFrame);
  });
  // Restore an animation loop when returning from the browser's back/forward cache.
  window.addEventListener('pageshow', event => { if (event.persisted) { lastTime = performance.now(); animationFrame = requestAnimationFrame(animate); } });
} catch (error) {
  console.error('Could not initialize the garden:', error);
  $('loading-note').hidden = true;
  $('renderer-error').hidden = false;
  $('camera-button').disabled = true;
  $('camera-message').textContent = '请先恢复图形渲染后再开启摄像头。';
}
