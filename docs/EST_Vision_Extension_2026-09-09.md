# EST 视觉扩展

> 最新调整：按用户要求移除了全部 4 个视觉事件帽及生成器、工具箱条目、AI 可用项和三语说明。
> 当前同一“视觉”扩展包含 12 个积木，只保留判断、数值和等待；普通事件分类不变。
> 下文 8/16 个积木及视觉事件的描述为此前阶段记录，不代表当前可用积木。
> 旧文件若含已移除事件帽，在清空工作区前明确取消加载，避免静默丢失其后续程序；不会改写原文件。
> 本轮回归覆盖 93 个 EST 积木、192 份 Python AST、无视觉事件帽的工具箱和三语保存恢复。

## 入口与项目行为

采用现有 OpenBlock/Scratch 扩展库组件、选择回调、VM 扩展管理器和项目序列化机制，
不增加独立的加载弹窗、全局开关或外部下载服务。

1. 新项目默认没有视觉分类。
2. 左下角“添加扩展”中选择“视觉”，原扩展页自动关闭，工作区定位到视觉分类。
3. 重复选择仍为同一个分类，不卸载、不复制。
4. 使用原生 `deviceExtensions` 项目字段保存，尚未拖出积木时也保留选择。
5. 打开另一个项目先调用原生扩展清理接口，不继承前一个项目的视觉分类。
6. 之前含有视觉积木、但没有扩展字段的项目，根据积木 ID 补齐字段，再走原生恢复流程。
7. 添加扩展不会开启摄像头、下载程序或启用 HID 视觉发送；摄像头继续由用户显式开启。

EST 使用上传模式，原生入口对应 `loadDeviceExtension`。视觉定义和生成器已经随软件打包，
本地适配只注册原生扩展状态并发出原有工具箱刷新事件。没有修改 `node_modules`。

## 积木

原先传感器中的四个视觉积木保留 ID，统一移到独立的青绿色视觉分类。

| ID | 中文含义 | 类型 |
| --- | --- | --- |
| `event_vision_state` | 当视觉目标变为有效/无效 | 事件帽 |
| `event_vision_gesture` | 当视觉左/右手变为指定手势 | 事件帽 |
| `vision_valid` | 视觉目标有效？ | 判断 |
| `vision_gesture` | 视觉左/右手是指定手势？ | 判断 |
| `vision_class` | 视觉类别编号 | 数值 |
| `vision_position` | 视觉目标 X/Y/宽度/高度 | 数值 |
| `vision_wait_state` | 等待视觉目标有效/无效 | 等待 |
| `vision_wait_gesture` | 等待视觉左/右手是指定手势 | 等待 |

事件采用现有 `rt.on_condition`，等待采用 `rt.wait_until`，不增加 runtime API。
依照固件的条件事件语义，首次采样用于建立状态，不因首次已满足条件而触发；
之后从不满足变为满足才触发。手势持续保持不会重复触发，离开后再次出现可以重新触发。
等待积木在条件已经满足时可直接继续，并在并发程序中保持协作式等待。

手势比较从一次 `rt.vision_snapshot()` 同时读取有效标志及类别，避免失效旧值触发。
发送仍是验证页选中的单只手，左右手下拉只是匹配条件，不会切换发送来源。
保留协议 1.30、bit 30 `vision-input` 的下载门禁和已有事件/并发能力检查。
尚未加入人体姿态、面部动作、未经标定的置信度或双手独立读取。

## 修改范围

- `src/renderer/est-extensions/library.js`：本地扩展条目、原生状态注册、旧项目识别。
- `scripts/est-extension-manager-loader.js`、`est-vm-runtime-loader.js`、`est-vm-project-compat-loader.js`：接通原生上传模式扩展和保存恢复流程。
- `scripts/openblock-native-editors-loader.js`、`webpack.makeConfig.js`：复用扩展库的自动关闭及原有分类选择回调，避免点击已加载项时卸载。
- `scripts/est-toolbox-loader.js`、`src/renderer/est-blocks/{definitions,toolbox,python-generator}.js`：独立分类及八个积木。
- `src/renderer/est-i18n.js`、`est-home-block-guide.js`、`est-home-block-previews.js`：三语文案、说明与预览。
- `src/renderer/est-ai/est-block-spec.js`：分类登记同步，避免已有视觉积木从规则目录丢失。
- 协议、生成器、主页、AI 和独立 Electron UI 回归测试。

## 验证

- `npm run test:est`：包括 89 个 EST 积木、177 份 Python AST 检查和现有协议/识别/AI 回归。
- `npm run compile`：编译检查。
- `node scripts/check-est-locale-electron.js`：真实编译后界面，隔离用户资料和硬件 IPC。
  验证默认不加载、实际点击扩展卡、关闭扩展页、自动选中分类、重复添加、未使用扩展的保存恢复、
  含积木项目重开、无扩展新项目、旧项目恢复和五次中/葡/英切换后工作区 XML 不变。
  摄像头请求次数保持零。

本批未下载到真机、未修改固件，未提交或推送 Git。

## 同日追加：人脸与人体姿态

按用户确认，仍只有一个“视觉”扩展入口。原 8 个积木保留，新增 8 个，共 16 个：

| 分组 | 判断目标 | 判断动作 | 事件 | 等待 |
| --- | --- | --- | --- | --- |
| 人脸 | `vision_face_detected` | `vision_face_action` | `event_vision_face` | `vision_wait_face` |
| 人体姿态 | `vision_pose_detected` | `vision_pose_action` | `event_vision_pose` | `vision_wait_pose` |

摄像头页“发送对象”增加人脸动作、人体姿态。沿用已有三套 MediaPipe 推理的同一帧结果，
不增加模型、训练或推理循环。选项发送期间锁定；先停止发送再切换，重新启用时先 CLEAR。
新增判断、事件和等待全部只读取一次 `rt.vision_snapshot()`；有效标志为假或类别不匹配时返回假。
通用有效性、类别、X/Y/宽/高积木可以读取任意当前发送目标。

### Studio 类别表

消息、能力和 runtime 接口保持不变。只读核对了固件 `est_vision.c` 的 `update_is_valid`
以及 `update_protocol.c` 的 0x28 UPDATE 校验：class_id 为 uint16，仅 65535 是无效保留值，
没有手势编号白名单。以下是 Studio 新增的应用层映射，不是新增固件能力声明。

- 手势：继续使用左手 1101–1106、右手 1201–1206，不改原程序含义。
- 人脸：2100 + 动作位。微笑=1、眨眼=2、张嘴=4；2100 表示自然。
  例如 2103 表示微笑和眨眼同时成立；判断自然只接受 2100。
  这里只表示关键点规则识别的可见动作，不进行身份、健康或真实情绪推断。
- 人体：3101 站立、3102 举起左手、3103 举起右手、3104 举起双手、
  3105 下蹲、3106 身体左倾、3107 身体右倾。

发送与生成器共同引用 `est-vision/visual-classes.js`，避免类别表漂移。
所有新样本仍是 sensor_id=0、TTL=500 ms、confidence=0、镜像归一化坐标。
目标消失、无效关键点、退化目标框或超过 200 ms 的推理结果映射为 CLEAR。
人体判断要求肩部和髋部可见，站立/下蹲还需要腿部可见，避免只看到头部就判断下蹲。
一个样本只能属于一种目标类型，不支持同时独立读取手、人脸和人体。

### 追加验证与限制

- `npm run test:est` 包含 97 个 EST 积木、196 份生成 Python 的 AST 验证。
- 真正执行 Python 谓词，覆盖全部脸部动作组合、7 种姿态、跨类型编号和有效/失效标志；每次仅读一次快照。
- 覆盖三类发送映射的坐标、过期、无目标、不可见人体及 0x28 原帧格式编码。
- `npm run compile` 和独立 Electron 界面回归：同一入口加载 16 个积木；三语切换不改变 XML；项目保存恢复不丢失新积木。
- 未启用用户摄像头、未下发程序，新增人脸/人体映射尚待真机联调，未声称实测识别准确率或帧率。
- 原“下发并运行测试”诊断程序校验的是手势编号；新类型请用新增积木搭建显示测试程序，不用手势诊断位判断通过。

追加修改集中于 `EstVisionLab.jsx`、`est-vision/{visual-classes,visual-sample,holistic-recognition}.js`、
视觉扩展积木定义/工具箱/生成器/三语说明以及对应测试。没有修改 HID 协议和下位机。
