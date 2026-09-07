# EST AI Block IR v1

EST AI Block IR 是 Studio 内部用于“自然语言生成积木”的受限中间格式。模型只能返回 IR；本地代码负责校验、生成 Blockly XML 并导入工作区。模型输出不会直接执行 JavaScript、Python 或设备命令。

## 顶层结构

```json
{
  "version": 1,
  "mode": "insert",
  "stacks": []
}
```

- `version` 当前固定为 `1`。
- `mode` 只能为 `insert` 或 `replace`。
- `stacks` 包含 1～8 个程序堆。
- 整份 IR 最多包含 256 个积木，最大嵌套深度为 24。

## 程序堆和积木

每个程序堆由事件帽、语句列表和可选坐标组成：

```json
{
  "event": {"type": "event_program_start"},
  "body": [],
  "x": 360,
  "y": 160
}
```

积木使用 Studio 中的真实 opcode。下拉字段写入 `fields`，值输入写入 `inputs`。控制积木的第一个分支写入 `body`，第二个分支写入 `elseBody`。

```json
{
  "type": "control_if_else",
  "inputs": {
    "CONDITION": {
      "type": "sensor_touch_pressed",
      "inputs": {"PORT": "1"}
    }
  },
  "body": [{"type": "drive_stop"}],
  "elseBody": [
    {
      "type": "control_wait_seconds",
      "inputs": {"SECONDS": 0.2}
    }
  ]
}
```

字段名、输入名和允许值以 `src/renderer/est-ai/est-block-spec.js` 运行时导出的 `EST_AI_BLOCK_SPEC` 为准。规格直接从现有 EST 积木定义生成，避免两套积木清单发生漂移。

## 完整示例

```json
{
  "version": 1,
  "mode": "insert",
  "stacks": [
    {
      "event": {"type": "event_program_start"},
      "body": [
        {
          "type": "drive_set_pair",
          "inputs": {"LEFT_PORT": "B", "RIGHT_PORT": "C"}
        },
        {
          "type": "control_repeat",
          "inputs": {"TIMES": 3},
          "body": [
            {
              "type": "drive_move_for",
              "fields": {"DIRECTION": "forward", "UNIT": "rotations"},
              "inputs": {"AMOUNT": 1}
            },
            {
              "type": "control_wait_seconds",
              "inputs": {"SECONDS": 0.5}
            }
          ]
        },
        {"type": "drive_stop"}
      ]
    }
  ]
}
```

## 本地约束

- 未知属性、未知积木、缺少字段或缺少输入都会被拒绝。
- 左右驱动端口不能相同。
- 端口、下拉枚举、数值范围和积木输入形状会被校验。
- `control_forever` 和 `control_stop` 等终止积木后不能继续连接语句。
- 永久循环内持续驱动且没有停止积木时会生成安全提醒，导入前必须再次确认。
- 导入使用单个 Blockly 事件组，支持一次撤销。
- 校验通过后会在浮窗的对话结果中渲染完整程序堆预览；预览成功前不能导入。
- IR 只修改工作区，不会自动下载或运行程序。

## 当前覆盖范围

- 81 个可见 EST 积木。
- 11 个常用原生运算积木。
- 暂不包含变量、列表、自定义积木以及任意 Python 反向转换。

## 聊天浮窗与服务接入

- 从编辑器顶部菜单栏打开 AI 编程助手，入口不再占用右下角，因此不会遮挡下载、运行和停止控件。标题栏可拖动，浮窗通过 Portal 挂载到 body，层级高于菜单栏。
- 用户消息靠右，助手回复靠左；程序经本地校验和真实 Blockly 渲染后，作为积木预览卡片出现在对话中。
- 生成不会修改工作区。只有点击“插入”或确认“替换工作区”才导入，支持一步撤销；不会自动运行硬件。
- Enter 发送、Shift+Enter 换行，中文输入法确认不会误发送。可以停止生成、新建对话；关闭浮窗保留本次会话，退出应用不保存聊天记录。
- 浮窗内的菜单按钮打开连接设置：API 地址、模型 ID、API 密钥及可选 JSON 模式。OpenAI、DeepSeek、Ollama 仅作为可选快捷预设；不选择预设也可直接填写兼容接口，实际请求不锁定厂商。
- 当前支持 [OpenAI Chat Completions 兼容协议](https://developers.openai.com/api/reference/typescript/resources/chat/subresources/completions/methods/create)，不是所有厂商的原生协议。非兼容的原生接口（如 Anthropic Messages）需兼容网关或后续适配。
- 地址可填写基础路径或完整 /chat/completions 路径，系统避免重复拼接。远程地址必须为 HTTPS，本机 localhost/127.0.0.1/::1 可用 HTTP，且可不填密钥。
- 配置和密钥整体由 Electron 主进程使用系统 safeStorage 加密。统一保存到 appData/EST Studio/ai/settings.bin（Windows 为 AppData/Roaming/EST Studio/ai/settings.bin），自动创建目录，不依赖开发版默认 Electron 数据目录，也不会删除占用旧目录位置的文件。
- 旧版 userData/est-ai-key.bin 仅作兼容读取，下一次保存采用新路径；不回传已保存密钥。更换 API 地址必须重新填入密钥，只改快捷预设标签或模型可保留绑定在同一地址上的密钥。当前只保存一组活动连接，不是多账户密钥管理器。
- Studio 根据用户描述在本地选择规则分类，再从 `EST_AI_BLOCK_SPEC` 加载对应的精确积木规格；每轮只向模型发送一次生成请求，不会发送全部 91 个积木规则，也不再额外请求模型选择分类。
- 规则随 Studio 安装在本地，不需要 Git，也不会让模型自行访问仓库或网络。后续修改会自动合并上一次候选程序已使用的规则分类，避免编辑时丢失原有积木知识。
- 请求只使用普通 system/user/assistant 消息与 JSON，兼容的模型不需要原生工具调用能力。仅发送当前对话最近 12 条有效消息，不自动读取或上传当前工作区；后续修改针对对话中上一次生成的候选程序。
- “已配置”仅表示配置已保存，不代表已验证账户或余额。请求只使用主进程中已保存的地址，不跟随重定向，单次生成最多等待 90 秒并设置响应大小上限；生成中不能修改活动连接。
- 通用请求不强制温度、token 上限或 DeepSeek 专用参数，JSON 模式可关闭。只有官方 DeepSeek 地址附带非思考参数，预设依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/)；本机地址依据 [Ollama 兼容接口文档](https://docs.ollama.com/api/openai-compatibility)。格式或 IR 校验失败时最多自动修复两次。
- 本地 IR 调试入口只在开发构建的设置面板中显示，发布构建隐藏。

## 验证

- `npm run test:est`：积木校验、按需规则选择与隔离、编译、聊天修复、取消、密钥存储、IPC、HTTP 错误处理和面板动作回归。
- `npm run test:ai-ui`：使用独立隐藏 Electron 窗口和模拟 API 回复，实际渲染积木 SVG，验证菜单栏入口不遮挡底部控件、插入/替换的一步撤销、浮窗层级、拖动、输入法、焦点和小窗口布局。使用真实 Windows safeStorage 与临时文件系统验证加密保存、覆盖更新、重新读取、可选快捷预设以及旧路径被文件占用的场景。截图输出到临时 est-ai-ui-* 目录；不会打开用户项目或调用真实 API。
- `npm run compile`：完整桌面构建检查。
- 真实服务联调需要用户自行输入 API 密钥；测试不使用真实凭据、不产生模型调用费用。
