# MMY 3D Model Viewer

一款本地化的轻量 3D 模型查看工具，基于 Tauri 2 + Vue 3 + Three.js 构建，参考 [ThePoly Model Viewer](https://www.thepoly.cn/tools/model-viewer) 的交互与功能设计，最终打包为单文件 exe 直接运行，无需安装。

## 功能特性

- 📦 **多格式支持**：FBX / GLB / glTF / OBJ / PLY
- 🖱️ **拖拽导入**：直接将模型文件拖入窗口即可加载，也可点击按钮选择文件
- 🎨 **PBR 材质编辑**：
  - 基础色 / 粗糙度 / 金属度 / 透明度 / 自发光 颜色与参数调节
  - 法线 / AO / 粗糙度 / 金属度 / 透明 / 自发光 各通道贴图导入与替换
  - 贴图以缩略图形式展示，点击空槽导入，悬停显示 × 按钮移除
- 🧊 **网格管理**：网格列表显示，点击高亮选中对应模型网格
- 🎥 **视角控制**：前/后/左/右/顶/底/等轴测 预设视角，一键重置
- 🎛️ **显示模式**：实体 / 线框 / 实体+线框 / 法线
- 🌓 **背景切换**：深色 / 浅色 / 自定义背景
- 📐 **辅助显示**：网格地面、坐标轴可切换
- 📸 **截图导出**：一键保存当前画面为 PNG
- 🖼️ **贴图拖拽**：直接将图片文件拖入窗口，自动替换第一个材质的颜色贴图

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x |
| 前端框架 | Vue 3 (Composition API + `<script setup>`) |
| 构建工具 | Vite 5 |
| 语言 | TypeScript |
| 3D 引擎 | Three.js 0.169 |
| 样式 | 原生 CSS（CSS Variables 主题） |

## 项目结构

```
MMY-3DModelViewer/
├── src/                          # 前端源码
│   ├── App.vue                   # 主应用组件
│   ├── main.ts                   # 入口文件
│   ├── styles.css                # 全局样式与主题变量
│   ├── components/               # Vue 组件
│   │   ├── Toolbar.vue           # 顶部工具栏（导入、截图）
│   │   ├── CanvasToolbarTop.vue  # 画布内顶部控制栏（视角、显示模式）
│   │   ├── CanvasToolbarBottom.vue # 画布内底部控制栏（背景色、缩放）
│   │   ├── ModelInfo.vue         # 右侧信息面板容器
│   │   ├── MaterialEditor.vue    # 材质编辑面板
│   │   └── MeshList.vue          # 网格列表组件
│   ├── services/
│   │   └── fileService.ts        # 文件选择/读取服务（Tauri Dialog + FS）
│   └── three/                    # Three.js 核心模块
│       ├── SceneManager.ts       # 场景管理器（相机、渲染、材质编辑、选中高亮）
│       └── ModelLoader.ts        # 模型加载器（格式解析、FBX材质转换、信息统计）
├── src-tauri/                    # Tauri Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri 配置（窗口、权限、拖拽等）
│   └── src/
│       └── main.rs
├── docs/                         # 项目文档
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 环境要求

- **Node.js** ≥ 18
- **Rust** 工具链（stable），安装方式：https://www.rust-lang.org/tools/install
- **系统依赖**（Windows 会自动通过 Tauri 安装 WebView2，一般无需额外配置）

首次使用前安装依赖：

```bash
npm install
```

## 开发运行

启动开发模式（会自动编译 Rust 后端 + 启动 Vite 前端 + 打开应用窗口）：

```bash
npm run tauri:dev
```

首次运行时 Rust 编译较慢，后续启动会快很多。代码修改后前端会热更新（HMR），Rust 端修改会自动重编译。

> 如果遇到端口 1420 被占用，通常是上次的进程没完全退出，可用以下命令清理：
> ```powershell
> Stop-Process -Name node -Force -ErrorAction SilentlyContinue
> Stop-Process -Name "MMY-3DModelViewer" -Force -ErrorAction SilentlyContinue
> ```

仅启动前端 Vite 开发服务器（不启动桌面窗口，用于浏览器调试）：

```bash
npm run dev
```

访问 http://localhost:1420/ 即可在浏览器中预览（注意：文件拖拽和本地文件系统功能依赖 Tauri API，纯浏览器下不可用）。

## 构建打包

生产构建（生成单文件 exe 安装包/便携版）：

```bash
npm run tauri:build
```

构建产物位于：

- 安装包：`src-tauri/target/release/bundle/msi/MMY 3D Model Viewer_<version>_x64_en-US.msi`
- 便携 exe：`src-tauri/target/release/bundle/nsis/`（或直接使用 `src-tauri/target/release/mmy-3d-model-viewer.exe`）
- macOS 会生成 `.app` 和 `.dmg`，Linux 会生成 `.AppImage` / `.deb`

类型检查 + 仅构建前端（不打包桌面端）：

```bash
npm run build
```

## 使用说明

1. **导入模型**
   - 点击顶部「导入模型」按钮选择文件，或直接将模型文件拖入窗口
   - 支持格式：`.fbx` `.glb` `.gltf` `.obj` `.ply`

2. **操作视角**
   - 鼠标左键拖拽：旋转视角
   - 鼠标右键拖拽：平移
   - 滚轮：缩放
   - 左上角控制栏可快速切换预设视角（前/后/左/右/顶/底/等轴测）或重置视角

3. **显示设置**
   - 点击画布顶部的图标切换：网格显示、显示模式（实体/线框/法线）
   - 画布底部可切换背景色（深/浅/自定义）、调节缩放

4. **材质编辑**（右侧面板）
   - 材质下拉框选择要编辑的材质
   - 每行最左侧方形缩略图槽：点击导入对应通道贴图，鼠标悬停显示 × 按钮移除贴图
   - 颜色行：点击颜色拾取器修改基础色
   - 各参数行：拖动滑块调节数值（粗糙度、金属度、法线强度、AO强度、透明度、自发光强度等）
   - 也可以直接将图片文件拖入窗口，会自动替换为第一个材质的颜色贴图

5. **网格列表**
   - 列出模型中所有网格（名称、坐标）
   - 点击网格项 → 模型上该网格高亮显示蓝色线框
   - 再次点击取消选中

6. **截图**
   - 点击顶部相机图标，当前画布内容会保存为 PNG 下载到本地

## 常见问题

**Q: FBX 模型导入后没有颜色/是灰色的？**
A: 工具会自动将 FBX 的 MeshPhongMaterial 转换为 PBR 标准材质，但 FBX 文件本身可能未嵌入贴图。如果模型外部贴图和 FBX 不在同一目录或路径不对，Three.js 无法自动加载。此时可手动点击材质槽的缩略图框导入对应贴图。

**Q: 拖入图片没反应？**
A: 确保已先导入一个模型（没有材质时无法应用贴图）。拖拽图片会应用到第一个材质的颜色通道，其他通道需要在材质面板中对应槽位点击导入。

**Q: 开发启动报错 `Address already in use`？**
A: 见上方「开发运行」中的端口清理命令，关闭残留进程后重新运行。

## License

MIT
