# EST Studio

EST Studio 是基于 [OpenBlock Desktop](https://github.com/openblockcc/openblock-desktop) 构建的 EST 专用图形化编程上位机。

当前项目处于开发阶段，目标是让一台电脑自动连接一台 EST 设备，并提供接近 EV3 Classroom 的积木编程体验。

编辑器无需先选择通用硬件即可进入编程。EST Studio 固定使用唯一的上传模式（可编辑代码并上传用户程序），不允许切换到模拟/实时模式；顶部的通用硬件选择和编程模式切换入口已隐藏，EST 连接状态入口继续保留。

## 当前进度

- 通过 USB HID 自动发现并连接 EST（VID `0483`，PID `5750`）。
- 菜单栏直接显示“EST 已连接”或“EST 未连接”，并使用 12 × 12 状态圆点。
- 已提供 8 个分类、106 个可见 EST 积木。
- 电机端口、移动端口和事件传感器端口支持下拉选择，也可放入原生变量。
- 转向积木提供 EV3 Classroom 风格的半圆转盘。
- 保留 OpenBlock 原生变量、列表和“我的模块”功能。
- `motor_degrees` 已接入设备状态读取；其余 EST 积木目前完成了界面和运行时占位，尚未全部接入固件指令。

“终止用户程序”功能需要等待 EST 重构项目提供对应协议，当前暂未实现。

## 目录结构

| 路径 | 用途 |
| --- | --- |
| `src/main/est/` | EST HID 传输、协议解析、设备连接服务 |
| `src/renderer/est-blocks/` | EST 积木定义、工具箱和运行时入口 |
| `src/renderer/EstStatusPanel.jsx` | 菜单栏 EST 连接状态 |
| `scripts/est-*-loader.js` | 将 EST 菜单、积木和运行时接入 OpenBlock |
| `scripts/test-est-protocol.js` | EST 协议、积木和原生编辑器回归测试 |

## 开发环境

- Windows 10/11
- Node.js 16 或更高版本
- npm
- Git

项目使用 Electron 15 和 Webpack 4。编译脚本会在较新的 Node.js 上自动启用 OpenSSL 兼容参数。

## 安装与启动

```powershell
git clone https://github.com/bans48528-cyber/EST-Stuido.git
cd EST-Stuido
npm install
npm start
```

`npm start` 会在后台启动 EST Studio，开发日志写入 `dist/openblock-dev.log`。

## 验证

```powershell
npm run test:est
npm run test:lint
npm run compile
```

## 硬件约定

- 当前只面向单电脑、单 EST 设备场景。
- 软件启动后自动连接设备，不提供额外的设备选择步骤。
- 当前 HID 标识为 VID `0483`、PID `5750`。

## 上游与许可

本项目基于 OpenBlock Desktop 2.6.3 开发，并保留原项目的 MIT、Scratch Foundation 和商标许可文件。OpenBlock 是其原作者和权利人的商标；EST Studio 的修改内容遵循仓库中的许可文件。
