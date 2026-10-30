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

## 变量、列表和自定义积木

IR v1 新增两个可选声明数组，旧格式保持兼容：

```json
{
  "version": 1,
  "mode": "insert",
  "variables": [{"name": "计数", "type": ""}, {"name": "记录", "type": "list"}],
  "procedures": [{"name": "显示数值", "arguments": [{"name": "数值", "type": "number"}], "warp": false}],
  "stacks": [
    {
      "event": {"type": "event_program_start"},
      "body": [
        {"type": "data_setvariableto", "fields": {"VARIABLE": "计数"}, "inputs": {"VALUE": 3}},
        {"type": "data_addtolist", "fields": {"LIST": "记录"}, "inputs": {"ITEM": {"type": "data_variable", "fields": {"VARIABLE": "计数"}}}},
        {"type": "procedures_call", "fields": {"PROCEDURE": "显示数值"}, "inputs": {"数值": 3}}
      ]
    },
    {
      "event": {"type": "procedures_definition", "fields": {"PROCEDURE": "显示数值"}},
      "body": [{"type": "display_text_line", "inputs": {"LINE": 1, "TEXT": {"type": "argument_reporter_number", "fields": {"VALUE": "数值"}}}}]
    }
  ]
}
```

- `variables` 最多 64 项；`type:""` 为普通变量，`type:"list"` 为列表。字段引用声明名称，不让模型管理 Blockly ID。
- 名称长度 1～64，忽略大小写后不能重复；禁止控制字符和 `__proto__`、`constructor`、`prototype`。变量初值与列表内容通过启动堆内的赋值/添加积木设置。
- `procedures` 声明参数及可选 `warp`；每个声明必须恰好有一个定义堆。定义堆也计入最多 8 个程序堆的限制。
- 参数最多 16 个，类型为 `number`、`text`、`boolean`。调用的 `inputs` 使用参数名称，不能缺项或多项。
- 参数读取积木分别为 `argument_reporter_number`、`argument_reporter_string`、`argument_reporter_boolean`，`VALUE` 为参数名，只能出现在所属定义堆内。
- 无参数积木使用 `arguments:[]`。自定义积木名称禁止 `%` 和反斜杠，真实 mutation、原型与参数 ID 由本地编译器构造，模型不得提供原始 XML/mutation。
- 列表索引采用原生数字输入，首项为 1；沿用 Studio 原生列表语义。
- Spark AI、NEW AI 的 Python 生成器负责转换到 Pika 的 0 起始索引；IR 不能提前减 1。读取越界返回空文本，越界删除/替换不修改列表；插入允许列表末尾后一项。查找返回 1 起始项号，未找到返回 0。
- 插入为本次程序生成独立的变量 ID；与工作区同名时自动使用 `名称 (2)` 等后缀，并同步修改新程序的引用。自定义积木签名冲突采用同样处理。不会绑定或改写旧程序的同名内容。
- 变量声明、列表、函数定义、调用及普通积木属于同一个导入事件组，可一起撤销/重做。预览使用独立工作区，不创建编辑器变量。

### Pika 运算与显示规则（2026-10-26）

- Spark AI、NEW AI 的三角函数输入和反三角函数输出使用度数；底层 `_math` 的弧度转换由上位机生成器完成。
- 两款原始工具箱的 `ln_abs` 选项显示为 `log`，统一按以 10 为底的对数处理。自然对数可用 `log(x) / log(e)` 组合。取整与负数取模按现有 OpenBlock VM 的语义生成。
- Spark AI 列表使用固件已提供的 `pop`、`insert`、`set`、长度及逐项遍历实现兼容，不再生成固件未提供的 `remove_all`、`dataToindex`、`num`、`list_if_data`。
- NEW AI 滚动文字使用固件内置的数字、大写英文及 `?.+-*/=` 字符集，每次最终文本最长 31 字符。固定文本及可确定的拼接文本会校验；动态文本也应按此规则构建。推荐 `SUM=99` 等英文显示标签，用户解释仍使用当前语言。
- 本轮包含两款硬件各 35 项运算结果对照、列表边界、统计程序的严格本地执行模拟和原生 Pika 编译；三个已授权真实模型用例完成生成、修改、预览、导入及编译。以上不代替主机实机运行验收。

## 自定义绘图

`display_draw.fields.BITMAP` 支持像素矩阵，而非图片 URL 或可执行绘图代码：

```json
{"type":"display_draw","fields":{"BITMAP":{"rows":["010","111","010"],"x":20,"y":20,"scale":8}}}
```

各行必须为等宽的 `0`/`1` 字符串（白/黑），坐标为非负整数，缩放为 1～16 的整数，最终图案不得超出 180×128 屏幕。本地编码为 Studio 的标准 `v1:` 位图，预览、导入、手动编辑、保存和 Python 生成使用相同数据。后续对话也接受规范化的 `v1:` 编码。为兼容旧 IR，省略 BITMAP 时保持空白图案。

## 当前覆盖范围

- 81 个可见 EST 积木。
- 全部 18 个原生运算积木，包括数学函数的 14 个下拉选项。
- 13 个变量/列表积木（3 个普通变量、10 个列表操作）。
- 自定义积木定义、调用和 3 种参数读取积木。
- 合计 117 种可生成类型，覆盖当前积木指南中全部 114 个用户可见积木，以及 3 种参数读取类型。绘图支持自定义像素内容。
- 不包含第三方扩展中尚未注册到 EST 工具箱的积木，以及任意 Python 反向转换。影子输入、端口选择器和函数原型由编译器自动构造，不作为模型独立输出类型。

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
- Studio 根据用户描述在本地选择规则分类，再从 `EST_AI_BLOCK_SPEC` 加载对应的精确积木规格；按需发送规则，不再额外请求模型选择分类。变量/自定义积木请求同时加载控制与运算规则；声明格式和绘图格式仅在对应分类中发送。
- 规则随 Studio 安装在本地，不需要 Git，也不会让模型自行访问仓库或网络。后续修改会自动合并上一次候选程序已使用的规则分类，避免编辑时丢失原有积木知识。
- 请求只使用普通 system/user/assistant 消息与 JSON，兼容的模型不需要原生工具调用能力。仅发送当前对话最近 12 条有效消息，不自动读取或上传当前工作区；后续修改针对对话中上一次生成的候选程序。
- “已配置”仅表示配置已保存，不代表已验证账户或余额。请求只使用主进程中已保存的地址，不跟随重定向，单次 API 请求最多等待 8 分钟并设置响应大小上限；生成中不能修改活动连接。
- 通用请求不强制温度、token 上限或 DeepSeek 专用参数，JSON 模式可关闭。只有官方 DeepSeek 地址附带非思考参数，预设依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/)；本机地址依据 [Ollama 兼容接口文档](https://docs.ollama.com/api/openai-compatibility)。格式或 IR 校验失败时最多自动修复两次。
- 本地 IR 调试入口只在开发构建的设置面板中显示，发布构建隐藏。

## 验证

- `npm run test:est`：全部可见积木与 AI 清单自动对照、117 类积木编译、声明/作用域/参数/位图校验、按需规则选择与后续编辑、聊天修复、取消、密钥存储、IPC、HTTP 错误处理和面板动作回归。
- `npm run test:ai-ui`：使用独立隐藏 Electron 窗口和模拟 API 回复，实际渲染积木 SVG，验证菜单栏入口不遮挡底部控件、插入/替换的一步撤销、浮窗层级、拖动、输入法、焦点和小窗口布局。使用真实 Windows safeStorage 与临时文件系统验证加密保存、覆盖更新、重新读取、可选快捷预设以及旧路径被文件占用的场景。截图输出到临时 est-ai-ui-* 目录；不会打开用户项目或调用真实 API。
- `npm run compile`：完整桌面构建检查。
- 隐藏 UI 回归新增真实变量/列表、三类参数、空参数定义/调用、全部数学函数选项、像素图案、名称冲突、插入/替换一步撤销及重做、XML 保存/加载测试，并对真实 Blockly 生成的 Python 做语法检查。使用模拟模型响应，不代表已验证所有模型或真实硬件组合。
- 真实服务联调需要用户自行输入 API 密钥；测试不使用真实凭据、不产生模型调用费用。
- 测试程序还在替代 `est`/`est_runtime` 的隔离模拟运行时中执行，验证变量、列表、参数传递、图案字节与数学函数结果，不连接硬件。新增回归修复了原生生成器将 `acos` 错写为 `acosh` 的问题，验证 `acos(0.5)=60°`。
