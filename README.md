# ATC CodeStudio

ATC CodeStudio 是基于 [OpenBlock Desktop](https://github.com/openblockcc/openblock-desktop) 的图形化编程桌面软件，支持 EST、Spark AI 和 NEW AI。工程后缀为 `.atc`，设备归属随工程保存。

主页可独立选择查看三款产品的文件、指南和搭建图；开始编程后加载所选设备的积木、代码生成器和通信服务。三款产品共用编辑器、语言设置和 AI 编程助手。

当前开发版本为 **2.8.79**。Spark AI 已同步原版软件 1.1.10 的积木增量、编译器和 111 版内置固件；软件及模拟验证通过，111 版真机升级与红外灯仍待实机验收。具体实现和历史验收见 `docs/`。

## 核心目录

| 路径 | 内容 |
| --- | --- |
| `src/` | 主进程、编辑器、三款硬件及 AI/视觉功能 |
| `resources/` | 打包所需固件、编译器、搭建图等运行资源 |
| `buildResources/` | 应用图标、文件关联图标及安装配置资源 |
| `scripts/` | 开发、编译、打包、集成加载器和测试 |
| `scripts/import-data/` | 可重新生成积木所需的最小原始输入 |
| `docs/`、`doc/` | 协议、接入说明及上游文档 |

## 安装与启动

开发环境为 Windows 10/11 x64、Node.js 16 或更高版本、npm 和 Git。项目使用 Electron 15 与 Webpack 4，编译脚本会为较新的 Node.js 设置 OpenSSL 兼容参数。

```powershell
git clone https://github.com/bans48528-cyber/EST-Stuido.git
cd EST-Stuido
npm ci
npm start
```

已安装依赖的工作区直接运行 `npm start`。开发日志和 PID 写入 `dist/`。OpenBlock 的定制通过仓库中的加载器在构建时应用。

## 验证与打包

```powershell
npm run test:est
npm run test:spark
npm run test:new-ai
npm run compile
npm run build:dist
```

`test:*` 默认使用模拟设备及编译器样例；`check:*-usb`、`check:vision-*` 等命令可能访问实际硬件或摄像头，应按对应接入文档使用。整库 ESLint 仍有历史问题，不等同于上述功能测试失败。

## 工作区清理

核心源码、运行资源、测试、必要文档、锁文件及 Git 历史保留在本仓库。`dist/`、`tmp/`、`translations/`、`static/`、`node_modules/.cache/` 均为可重新生成的目录；旧安装包、截图、日志、提取副本及已合入的主页原型可删除。`node_modules/` 中当前开发依赖可保留以继续开发，也可通过 `npm ci` 重装。

积木导入默认读取 `scripts/import-data/`，编译器样例保存在 `scripts/*-compiler-fixtures.json`，不再依赖工作区旁的 `artifacts/` 或原版软件安装路径。固件导入脚本仍可显式指定外部固件目录；正常启动、编译和打包使用已纳入版本控制的 `resources/`。

用户工程、AI 密钥与本机偏好不属于构建产物；维护仓库时不要删除应用数据目录。

## 上游与许可

项目保留 OpenBlock Desktop 的 MIT、Scratch Foundation 和商标许可文件，以及相关导入组件的声明。详见 `LICENSE`、`LICENSE.ScratchFoundation`、`TRADEMARK` 和相应资源目录中的说明。
