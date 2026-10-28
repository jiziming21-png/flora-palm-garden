# FLORA · 掌心花园

Three.js + MediaPipe 的手势花朵：张掌盛放、握拳合拢、食指跟随。支持鼠标与滑杆演示、四种配色和移动端布局。

花朵由多层点云、点状花脉与极薄的半透明轮廓构成，配有香槟金花蕊与少量漂浮花粉。三片错落的叶片连接同一条弯曲花茎，整株使用一致的粒子质感和轻微摆动。

这是适用于 GitHub Pages 的零构建静态站点。所有脚本、WASM 和模型均同源托管；无需 Google CDN、账号登录、数据库或后端服务。摄像头画面仅在访问者的浏览器内处理。

仓库根目录包含 `index.html` 和 `.nojekyll`，在 GitHub Pages 中选择从 `main` 分支根目录发布。MediaPipe 的 ES Module 使用 `.js` 扩展名，避免部分静态服务器缺失 `.mjs` 类型映射。

源代码：`src/`。第三方库及其许可证：`vendor/`、`THIRD_PARTY_NOTICES.md`。

本地可使用任意 HTTP 服务打开；公网摄像头体验需要 HTTPS。
