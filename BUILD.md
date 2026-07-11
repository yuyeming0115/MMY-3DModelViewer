# MMY-3DModelViewer 打包说明

本工具基于 Tauri 2.x + Vue3 + Three.js，支持 Windows 和 macOS 双平台打包。
图标源文件：`素材/icon.png`（打包脚本会自动裁切为 1024×1024 正方形并生成全平台图标）。

---

## 一、环境准备

### 通用依赖
- **Node.js** 18+（推荐 LTS）：https://nodejs.org
- **Rust**（stable）：https://rustup.rs

### Windows 额外依赖
- **Microsoft C++ Build Tools**（含 MSVC 和 Windows SDK）
  - 安装 Visual Studio Installer → 勾选 "使用 C++ 的桌面开发"
- WebView2 Runtime（Win10/11 通常已内置；Win10 早期版本需手动安装）

### macOS 额外依赖
- **Xcode Command Line Tools**：终端运行 `xcode-select --install`
- macOS 10.15+（脚本默认构建 Universal Binary，同时支持 Intel 和 Apple Silicon）

---

## 二、一键打包

### Windows（单文件 EXE）

**最简单**：双击 `build-windows.bat` 即可自动打包。

**命令行方式**：
```powershell
# 方式 1：PowerShell 直接运行
powershell -ExecutionPolicy Bypass -File build-windows.ps1

# 方式 2：右键 build-windows.ps1 -> 用 PowerShell 运行
```

**产出**：
- `src-tauri\target\release\bundle\nsis\*.exe` — 单文件 NSIS 安装包（推荐分发）
- `src-tauri\target\release\MMY-3DModelViewer.exe` — 便携版 EXE（无需安装）

**特点**：
- NSIS 安装器支持简体中文 + 英文界面
- `currentUser` 模式安装，无需管理员权限
- 单个 `.exe` 文件即可分发，双击安装

---

### macOS（.app + .dmg）

**最简单**：双击 `build-macos.command` 即可自动打包。

**命令行方式**：
```bash
# 赋予执行权限（仅首次）
chmod +x build-macos.sh

# 运行打包
./build-macos.sh
```

**产出**：
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg` — DMG 安装镜像（推荐分发）
- `src-tauri/target/universal-apple-darwin/release/bundle/app/*.app` — 应用包

**特点**：
- Universal Binary，同时支持 Intel 和 Apple Silicon（M1/M2/M3）
- DMG 镜像双击挂载后，拖入 Applications 即可安装
- 最低系统要求 macOS 10.15

> **注意**：如需仅为当前架构打包（加快构建速度），可手动执行：
> ```bash
> npx tauri build --target aarch64-apple-darwin    # 仅 M 系列
> npx tauri build --target x86_64-apple-darwin      # 仅 Intel
> ```

---

## 三、打包流程说明

脚本自动执行以下步骤：

1. **检查依赖** — 确认 Node.js / Rust / 平台工具链已安装
2. **安装前端依赖** — `npm install`（如 `node_modules` 已存在则跳过）
3. **生成图标** — 从 `素材/icon.png` 裁切为 1024×1024 正方形，再用 `npx tauri icon` 生成全平台图标
   - Windows: 脚本只在源图标更新时才重新生成，避免重复工作
4. **构建产物** — `npx tauri build` 指定目标平台
5. **输出结果** — 打印产物路径和大小

---

## 四、常见问题

### Q1: Windows 构建报错 "link.exe not found"
未安装 MSVC。请通过 Visual Studio Installer 安装 "使用 C++ 的桌面开发" 工作负载。

### Q2: Windows 构建报错 "WebView2 not found"
Win10 早期版本需安装 WebView2 Runtime：https://developer.microsoft.com/microsoft-edge/webview2/

### Q3: macOS 构建报错 "xcode-select: error: tool 'xcodebuild' requires Xcode"
运行 `xcode-select --install` 安装 Command Line Tools；若仍报错，安装完整 Xcode。

### Q4: macOS 构建报错 "cargo lipo not found"
构建 Universal Binary 需要 `cargo-lipo`。安装：`cargo install cargo-lipo`。
若仅构建单架构，可不用 lipo，直接指定 `--target` 即可。

### Q5: 图标未更新
脚本根据文件修改时间判断是否需要重新生成。如需强制更新，删除 `src-tauri/icons/icon.png` 后重新运行脚本。

### Q6: 首次运行 Rust 构建很慢
首次需下载并编译所有依赖，耗时较长属正常现象。后续增量构建会快很多。

### Q7: macOS 应用打开提示 "无法验证开发者" / "来自身份不明的开发者"
系统设置 → 隐私与安全性 → 点击 "仍要打开"。或对 .app 右键 → 打开。
若需彻底解决，需申请 Apple 开发者证书并对应用进行签名公证。

---

## 五、项目结构

```
MMY-3DModelViewer/
├── build-windows.ps1        # Windows 一键打包脚本
├── build-macos.sh           # macOS 一键打包脚本
├── BUILD.md                 # 本文档
├── 素材/
│   └── icon.png     # 图标源文件
├── src-tauri/
│   ├── tauri.conf.json      # Tauri 配置（bundle targets、图标、NSIS、macOS）
│   ├── icons/               # 自动生成的全平台图标
│   ├── src/                 # Rust 后端代码
│   └── Cargo.toml           # Rust 依赖配置
├── src/                     # Vue3 前端代码
├── package.json             # 前端依赖与脚本
└── vite.config.ts           # Vite 构建配置
```

---

## 六、手动构建（不用脚本）

如需手动控制构建流程：

```bash
# 1. 安装前端依赖
npm install

# 2. 生成图标（可选，首次需要）
npx tauri icon 素材/icon.png --output src-tauri/icons

# 3a. Windows 构建（NSIS 单文件）
npx tauri build --target nsis

# 3b. macOS 构建（Universal）
npx tauri build --target universal-apple-darwin

# 3c. 全平台默认（按当前 OS 自动选择 target）
npx tauri build
```
