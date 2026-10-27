# Third-party components

All runtime assets are served locally. No CDN request is required by the app.

| Component | Version / source | License |
| --- | --- | --- |
| Three.js | 0.186.1, `three` npm package, `build/three.module.js` and `build/three.core.js` | MIT; see `vendor/THREE-LICENSE.txt` |
| MediaPipe Tasks Vision | 0.10.32, `@mediapipe/tasks-vision` npm package, ES module plus SIMD and non-SIMD WASM | Apache-2.0; see `vendor/mediapipe/LICENSE.txt` and `vendor/mediapipe/VENDOR-README.md` |
| MediaPipe Hand Landmarker model | Google official `hand_landmarker/float16/1/hand_landmarker.task` | See MediaPipe model documentation and applicable terms |

Upstream sources:

- [Three.js](https://github.com/mrdoob/three.js)
- [MediaPipe](https://github.com/google-ai-edge/mediapipe)
- [Hand Landmarker models](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker#models)
- [Model asset](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)

Original UI, procedural flower geometry and application code were created for this project. The hand photograph used during validation is not distributed with the project.
