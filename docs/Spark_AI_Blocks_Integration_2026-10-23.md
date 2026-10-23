# Spark AI 积木接入

EST Studio 2.8.49 支持在硬件选择器中选择 Spark AI，使用其积木编程并预览 PikaPython 代码。本阶段没有接入 Spark AI 通信协议，不提供连接、下载、运行、停止或固件更新，也不会使用 EST HID 协议发送 Spark AI 程序。

## 接入范围

来源为用户提供的 `artifacts/spark-ai-extraction-2026-10-23/visible-blocks/blocks.json`，对应 Spark AI 1.1.9 的实际可见工具箱，不包含原软件的隐藏、遗留积木。

| 分类 | 固定积木 |
| --- | ---: |
| 电机 | 4 |
| 移动 | 9 |
| 矩阵灯 | 5 |
| 声音 | 1 |
| 事件 | 1 |
| 控制 | 9 |
| 传感器 | 19 |
| 运算 | 18 |
| 合计 | 66 |

变量、列表和自制积木使用已有原生编辑界面，接入清单中的 13 种动态生成器。显示、隐藏舞台监视器的积木不新增。固定积木和参数影子使用 `spark_` 前缀，避免覆盖 EST 或原生积木。

电机端口 E–H，传感器端口 A–D。保留原始 API 拼写，包括 `_beep.play_muic`、`_key.read_adcance_left_offset`；没有自动改写为 EST 接口。

## 编辑与生成

- 硬件切换继续保存独立的 SB3 草稿及标题。项目硬件标识为 `meta.estStudio.hardwareId = "spark-ai"`。
- 新项目默认包含 Spark AI 的程序启动帽。
- Python 预览按硬件选择独立的 `SparkPython` 生成器，使用现有 Blockly 遍历与优先级引擎，不运行 Python。
- 当前编辑会话内分别保留各硬件的手写代码及锁定状态；这不是把手写 Python 持久化到 SB3 文件的新格式。
- 菜单和积木覆盖简中、繁中、英语、葡萄牙语、俄语。语言切换不改变积木 ID、参数值或端口含义。
- 矩阵编辑沿用原生控件，独立修复初始化和边界处理。布局为 5 列、7 行，35 位按行存储；固件 API 的 x 是行（0–6），y 是列（0–4）。每行对应一个字节，bit0 为最左像素。

## 相对提取结果的修正

- 空布尔输入生成 Python `False`，不生成 `false`。
- 控制块使用统一的四空格缩进，支持嵌套，重复计数器使用独立名称。
- 修正乘除表达式的优先级，保留连接的子表达式含义。
- 单点矩阵的坐标菜单限制在固件有效范围内。
- 音符时长标为秒；计时器标为毫秒，与提取包核对的固件单位一致。
- 删除输入影子后使用清单中的默认参数；字符串通过 Python 转义生成，不执行用户输入。

## 待固件与协议确认

1. Spark AI 的设备标识、握手、传输、程序下载/执行/停止流程，以及 PikaPython 执行环境的对象注入和导入方式。
2. 提取包记录灰度 `cmp_lux(..., "=", ...)` 的固件实现与常规相等含义相反。本阶段保留原 API 映射，需真机确认后决定修复位置。
3. 动态列表的 `remove_index`、`remove_all`、`dataToindex`、`num`、`list_if_data` 在提取包提供的固件中未找到对应实现，当前保留原软件代码生成方式，不视为真机支持已完成。
4. 原软件音符列表中的 `E#`、`B#` 名称已保留，需确认目标固件的实际音符表。
5. 除法/取余的默认除数为 0，用户需填写有效值；跳出循环只能放在循环内部。多个启动帽目前按工作区顺序生成，不承诺固件多任务执行。
6. 原 Spark AI 软件工程的直接导入与通信联调不属于本阶段；本阶段验证的是 EST Studio 新建并保存的 Spark AI 工程。

## 实现文件

核心位于 `src/renderer/spark-ai/`：`catalog.json`、`blocks.js`、`messages.js`、`matrix-field.js`、`source-generators.js`、`python-generator.js`。

桥接使用硬件 profile、默认项目、工具箱、积木注册/语言切换、代码生成器选择和代码抽屉；`src/renderer/hardware/code-drafts.js` 隔离手写代码。没有改动下位机或设备通信实现。

`scripts/import-spark-ai-blocks.js` 从提取结果机械生成目录、隔离后的源生成器和测试预期。SVG 来自原安装包的 `static/blocks-media`，已内嵌到目录中，运行和打包不依赖原软件或本机 E 盘。原文件目录可作为脚本第二个参数，图标目录可作为第三个参数。生成器修正维护在单独的 `python-generator.js` 中，不修改生成文件。

## 验证入口

```powershell
npm run test:spark
npm run test:est
npm run compile
node scripts/check-est-locale-electron.js
```

Spark 单元测试核对固定积木默认代码、下拉变体、动态生成器、多语言、矩阵字节和嵌套控制，并使用 Python AST 校验语法。Electron 测试使用独立用户目录和模拟 IPC，不连接硬件，检查真实积木实例、点阵编辑、代码预览、工程保存重开及硬件草稿隔离。

这些结果不替代 PikaPython 固件执行与真机验收。
