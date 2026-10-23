# EST Studio 多类视觉对接说明

状态：已按下位机 M1.28A 候选协议实现，等待真实 USB 联调。

## 兼容门槛

- 单目标继续兼容协议 1.30、`vision-input` bit 30 和 schema 1。
- 多目标要求协议不低于 1.31，并同时声明 `vision-input` bit 30 与
  `vision-input-multi` bit 31。
- 多目标仍使用命令 `0x28`：`MULTI_STATUS=0x03`、
  `UPDATE_FRAME=0x04`、`MULTI_CLEAR=0x05`。
- Studio 同时检查协议和能力位。条件不满足时，多项识别不会发送；使用按类型
  runtime 接口的程序也会在下载前被阻止。

完整线协议以固件仓库
`docs/EST_Vision_Multi_Target_Protocol_V1.md` 为准。

## Studio 行为

- 摄像头同一采集帧可产生左手、右手、人体姿态和面部动作四项结果。
- 每 100 ms 最多发送一个完整快照，只保留最新帧，不积压旧帧。
- schema 2 的 `UPDATE_FRAME` 固定为一个 64 字节 HID 报告，不分片。
- enabled mask 表示已开启的识别器，valid mask 表示本帧实际检测到的目标。
  某一类消失时，仅清除该类 valid 位。
- 程序未运行时只缓存最新帧；RUN 成功后才发送，避免固件返回 busy。
- 下载、保存、固件升级期间暂停发送；恢复后只发送仍在 TTL 内的新帧。
- 停止程序、关闭摄像头、USB 断开时发送 CLEAR 或依靠固件 TTL 失效。

## 积木代码生成

新生成代码始终明确指定目标：

```python
rt.vision_snapshot('left')
rt.vision_snapshot('right')
rt.vision_snapshot('pose')
rt.vision_snapshot('face')
```

通用视觉有效、类别和位置积木提供目标类型选择；手势积木自动使用左手或右手，
面部和姿态积木自动读取各自缓存。无参数 `rt.vision_snapshot()` 仅保留给旧单目标
代码的兼容投影。

## 验证

代码与模拟验证：

```text
npm run test:est
node_modules\.bin\electron.cmd scripts\check-est-vision-window-electron.js
```

刷入 M1.28A 后的真实 USB 联调：

```text
npm run check:vision-hid -- --multi
```

该 HID 检查会验证四类同时读取、TTL 失效、恢复和 CLEAR。真实摄像头识别质量
仍需另行执行摄像头联调，不由模拟数据测试代替。
