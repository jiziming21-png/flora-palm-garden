const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

export class HandTracker {
  constructor(video, canvas, onResult, onError) {
    this.video = video;
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onResult = onResult;
    this.onError = onError;
    this.token = 0;
    this.active = false;
    this.lastVideoTime = -1;
    this.lastInferenceTime = 0;
  }

  async loadModel() {
    if (this.detector) return;
    const { HandLandmarker, FilesetResolver } = await import('../vendor/mediapipe/vision_bundle.js');
    const vision = await FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm', import.meta.url).href);
    const options = {
      baseOptions: { modelAssetPath: new URL('../models/hand_landmarker.task', import.meta.url).href, delegate: 'GPU' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.55,
    };
    try {
      this.detector = await HandLandmarker.createFromOptions(vision, options);
    } catch (gpuError) {
      // The render context can work even when MediaPipe's GPU delegate cannot.
      console.info('MediaPipe GPU delegate unavailable, falling back to CPU.', gpuError);
      options.baseOptions.delegate = 'CPU';
      this.detector = await HandLandmarker.createFromOptions(vision, options);
    }
  }

  async start(onProgress = () => {}) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('请从 localhost 或 HTTPS 打开网页，以使用摄像头。');
    }
    const token = ++this.token;
    let stream;
    try {
      onProgress('等待摄像头授权…');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }, audio: false,
      });
      if (token !== this.token) { stream.getTracks().forEach(t => t.stop()); return false; }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (token !== this.token) return false;
      this.canvas.width = this.video.videoWidth || 640;
      this.canvas.height = this.video.videoHeight || 480;
      onProgress('正在唤醒手势模型…');
      await this.loadModel();
      if (token !== this.token) return false;
      this.active = true;
      this.lastVideoTime = -1;
      this.lastInferenceTime = 0;
      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', () => {
        if (this.active) { this.stop(); this.onError(new Error('摄像头已断开，请重新开启。')); }
      }, { once: true });
      this.tick();
      return true;
    } catch (error) {
      stream?.getTracks().forEach(t => t.stop());
      this.stop();
      throw error;
    }
  }

  tick = () => {
    if (!this.active) return;
    this.frame = requestAnimationFrame(this.tick);
    if (document.hidden || this.video.readyState < 2) return;
    const now = performance.now();
    if (now - this.lastInferenceTime < 1000 / 24 || this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    this.lastInferenceTime = now;
    try {
      const result = this.detector.detectForVideo(this.video, now);
      const landmarks = result.landmarks?.[0] || null;
      this.draw(landmarks);
      this.onResult(landmarks, result.worldLandmarks?.[0] || null);
    } catch (error) {
      this.stop();
      this.onError(error);
    }
  };

  draw(points) {
    const { width, height } = this.canvas;
    const ctx = this.context;
    ctx.clearRect(0, 0, width, height);
    if (!points) return;
    ctx.strokeStyle = '#d5e5a3b0';
    ctx.lineWidth = Math.max(1.5, width / 350);
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ctx.moveTo(points[a].x * width, points[a].y * height);
      ctx.lineTo(points[b].x * width, points[b].y * height);
    }
    ctx.stroke();
    points.forEach((point, i) => {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, i === 8 ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === 8 ? '#f3c6cf' : '#d5e5a3';
      ctx.fill();
    });
  }

  stop() {
    ++this.token;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.draw(null);
  }

  dispose() { this.stop(); this.detector?.close(); this.detector = null; }
}

export function cameraErrorMessage(error) {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return '摄像头权限未开启。请在浏览器中允许访问后重试；也可以继续用鼠标体验。';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return '没有找到摄像头。连接设备后可重试，也可以拖动滑杆体验花开。';
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return '摄像头暂时无法读取，请关闭占用它的其他应用后重试。';
  if (error.message?.includes('localhost') || error.message?.includes('断开')) return error.message;
  return '手势模型未能启动。请刷新重试，或继续用鼠标与滑杆体验。';
}
