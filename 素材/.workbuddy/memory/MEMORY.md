# MMY-3DModelViewer 项目长期记忆

## 图标
- 源图标：`素材/icon.png`（2048×2048 RGBA 透明）。用 `npx tauri icon 素材/icon.png --output src-tauri/icons` 生成全平台图标。
- 打包脚本/文档引用路径统一为 `素材/icon.png`（原 `FBXView-logo.png` 已删除）。

## 构建（Windows，沙箱环境）
- 沙箱**禁止 cmd.exe**：不能用 `build-windows.bat`（内部走 cmd 且末尾 `pause` 会卡住），PowerShell 工具也会拦截 `cmd.exe` 调用。
- 正确做法：用 VS2022 Community 的 DevShell 模块注入 MSVC ——
  `Import-Module "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\Microsoft.VisualStudio.DevShell.dll"; Enter-VsDevShell -Arch amd64`
  然后 `npx tauri build`，最后把 `src-tauri/target/release/mmy-3d-model-viewer.exe` 与 `src-tauri/target/release/bundle/nsis/*.exe` cp 到 `release/`。
- `target/`（2.8G 编译缓存）存在时增量构建很快；`beforeBuildCommand` 会触发 npm→cmd，但实测能跑通，只是日志里会出现 `cmd.exe` 调试字样。

## git 推送（本仓库）
- 保留全局代理 `127.0.0.1:7897`（本环境实际可达），**不要**清空代理走直连（github:443 会超时）。
- 大体积 pack（全套图标 + 2.8MB 源图）需先 `git config http.postBuffer 1048576000`，否则代理返回 408/断开。
- `release/`、`target/`、`dist/` 被 `.gitignore` 忽略，构建产物不进 git（仅本地交付）。
