# EST Studio 独立视觉识别验证

版本：2.8.43。状态：独立模型链路已实现，真实 30 FPS 与四项现场动作验收尚未完成。

## 实现

- 验证页不再实例化 Holistic。Hands 独立检测手掌并定位关键点，不以人体或人脸检测结果作为运行条件。
- 手部使用 `@mediapipe/hands@0.4.1675469240`，最多两只手，完整关键点模型（modelComplexity=1）。
- 人体使用 `@mediapipe/pose@0.5.1675469404` 的 Lite 模型；面部使用 `@mediapipe/face_mesh@0.4.1633559619`，沿用微笑、闭眼/眨眼、张嘴几何规则。
- 每个采样帧只运行一次 Hands。三个模型使用同一个冻结的摄像头帧；整个处理完成前丢弃新的帧，不排队，不同时运行第二套手部推理。
- 左右手各有结果和短窗口平滑；当前帧缺失的手立即清空，不通过平滑继续保留旧的手势。
- 摄像头像素没有镜像，预览通过 CSS 镜像；Hands 的镜像约定在左右手映射时进行补偿。这里的左右指用户自身的左右。
- UI 不再把固定的手势规则分数显示成模型置信概率。Handedness score 只用于左右分类结果筛选。
- 新帧回调在推理前重新登记，帧繁忙时直接跳过。页面分别显示摄像头 FPS 与完整识别 FPS；后者以三个模型完成为一次计数。
- 模型进入页面时加载并预热；关闭页面等待在途模型调用结束后释放，停止摄像头后忽略旧会话结果。
- 三组 SDK 的 WASM 工厂和 packed-assets 全局名称在资源复制时分别命名，并修正 Electron 下误走 Node 文件读取的问题。没有手工改 node_modules。

## 摄像头实测

设备：Integrated Camera，配置 640×480、30 FPS。最终配置下，在可见 Electron 测试窗口连续采样 150 帧：

| 项目 | 实测 |
| --- | --- |
| 三模型预热 | 8671 ms |
| 摄像头送达页面 | 10.0 FPS |
| 三模型完整处理 | 10.1 FPS |
| 输入拷贝及完整处理平均耗时 | 32 ms |
| 检测到手的帧数 | 0/150 |
| 检测到人体的帧数 | 148/150 |
| 检测到脸的帧数 | 0/150 |

对照：不运行任何推理、仅接收摄像头帧的可见窗口测试，同样为摄像头 10.0 FPS / 采样循环 10.1 FPS。设备报告的 frameRate=30 不等于实际送达页面的帧率。已经定位到推理之前的供帧限制，但尚未确定是设备、驱动、光照/曝光或浏览器捕获链路的具体原因。

因此不能宣布达成实际 30 FPS，也不能用没有手入镜的性能采样证明双手识别性能。对应日志：`dist/vision-final-camera.log`、`dist/vision-capture-visible.log`。

## 输入回放测试

使用用户先前提供的 Studio 摄像头截图，在内存 Canvas 中裁剪/遮挡，运行真实 MediaPipe 模型。没有保存处理后的画面。这里是静态输入回放，不是现场摄像头动作测试；15 帧是重复输入同一画面，不是独立场景样本数量。

| 输入 | 手检测 | 其他结果 |
| --- | --- | --- |
| 完整手掌裁剪，排除人脸 | 15/15 帧 | 人脸 0/15，人体 0/15 |
| 遮住截图中的脸 | 15/15 帧 | 人脸 0/15，人体 0/15 |
| 原截图两只手，其中第二只靠近边缘且未展开 | 始终只有一只手 | 不记为双手通过 |
| 手掌镜像合成对照 | 未稳定检出两只 | 不记为双手通过 |
| Google 官方双手样例 | 15/15 帧均检出两只 | 同时获得 Left、Right 分类 |
| 切换为空白画面 | 0/15 帧残留 | 人脸、人体同样为空 |

样例来自 [Google MediaPipe 官方示例 notebook](https://github.com/google-ai-edge/mediapipe-samples/blob/main/examples/hand_landmarker/python/hand_landmarker.ipynb) 引用的测试图。左右手镜像约定参考 [MediaPipe Hands 文档](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md)。官方样例仅下载到 dist 供测试，没有打包进软件。

对应日志：`dist/vision-reference.log`、`dist/vision-official-reference.log`。

## 现场测试

第一次引导窗口等待开始超时，没有生成有效的四项现场报告，不记录为通过。

重新测试：先完成 `npm run compile`，再运行 `npm run check:vision-camera`。窗口会等待用户点击开始；每项 7 秒准备、7 秒采样，依次为仅手掌、遮脸、双手、手离开。只保存计数和帧率到 `dist/vision-guided-results.json`，不保存摄像头视频或图片。

需要继续确认：仅手入镜的持续稳定性、遮脸后的手势识别率、真实左右手标注是否一致、双手一起运动时的识别率、离开后的清除延迟，以及解决供帧限制后能否达到完整识别 30 FPS。

## 验证与修改范围

- `npm run test:est` 通过，包括新增的独立识别测试：无脸/无人体输入、双手映射、单手离开、低可信左右分类、在途帧丢弃和关闭时结果失效。
- `npm run compile` 通过。
- Electron 中三模型均实际加载成功并返回结果。
- Electron 关闭并重新创建三模型测试通过（`dist/vision-reopen.log`）。
- 主要文件：`EstVisionLab.jsx`，`est-vision/independent-vision.js`，`est-vision/hand-results.js`，`scripts/est-vision-assets.js`，`scripts/test-est-independent-vision.js`，`scripts/check-est-independent-vision-electron.js`，`scripts/vision-guided.html`。
- 配套修改：`webpack.renderer.js` 的模型资源复制，`package.json` / `package-lock.json` 的固定依赖及版本号。
- 本轮没有修改积木、HID、下位机或 AI 功能。工作期间出现的其他未提交修改全部保留；未提交、未推送 Git。
