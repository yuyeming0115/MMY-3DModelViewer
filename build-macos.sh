#!/usr/bin/env bash
# MMY-3DModelViewer macOS 一键打包脚本
# 生成 .app 应用 + .dmg 安装镜像
# 使用：chmod +x build-macos.sh && ./build-macos.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# 颜色输出
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  MMY-3DModelViewer macOS 打包${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""

# 1. 检查依赖
echo -e "${YELLOW}[1/4] 检查依赖...${NC}"
if ! command -v node >/dev/null 2>&1; then
  echo -e "  ${RED}✖ 未找到 Node.js，请先安装 Node.js 18+${NC}"
  exit 1
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo -e "  ${RED}✖ 未找到 Rust/Cargo，请先安装 Rust (https://rustup.rs)${NC}"
  exit 1
fi
echo -e "  ${GREEN}✔ Node.js 和 Rust 已安装${NC}"

# 2. 检查 Xcode Command Line Tools（macOS 必需）
if ! xcode-select -p >/dev/null 2>&1; then
  echo -e "  ${YELLOW}未检测到 Xcode Command Line Tools，正在安装...${NC}"
  xcode-select --install || true
  echo -e "  ${RED}请等待 Xcode CLT 安装完成后重新运行此脚本${NC}"
  exit 1
fi
echo -e "  ${GREEN}✔ Xcode Command Line Tools 已就绪${NC}"

# 3. 安装前端依赖
echo ""
echo -e "${YELLOW}[2/4] 安装前端依赖...${NC}"
if [ ! -d "node_modules" ]; then
  npm install
else
  echo -e "  ${GRAY}node_modules 已存在，跳过${NC}"
fi
echo -e "  ${GREEN}✔ 前端依赖就绪${NC}"

# 4. 生成图标（如果源图标比目标新）
SRC_ICON="$ROOT/素材/icon.png"
DST_ICON="$ROOT/src-tauri/icons/icon.png"
NEED_ICON=0

if [ -f "$SRC_ICON" ]; then
  if [ ! -f "$DST_ICON" ]; then
    NEED_ICON=1
  elif [ "$SRC_ICON" -nt "$DST_ICON" ]; then
    NEED_ICON=1
  fi
fi

if [ "$NEED_ICON" -eq 1 ]; then
  echo ""
  echo -e "${YELLOW}[3/4] 生成图标...${NC}"
  # macOS 用 sips 裁切为 1024x1024 正方形
  TMP_SQUARE="$(mktemp -t mmy-icon).png"
  # 先获取尺寸
  W=$(sips -g pixelWidth "$SRC_ICON" | awk '/pixelWidth/ {print $2}')
  H=$(sips -g pixelHeight "$SRC_ICON" | awk '/pixelHeight/ {print $2}')
  S=$(( W < H ? W : H ))
  X=$(( (W - S) / 2 ))
  Y=$(( (H - S) / 2 ))
  # 裁切为正方形
  sips -c "$S" "$S" "$SRC_ICON" --out "$TMP_SQUARE" >/dev/null
  # 缩放到 1024x1024
  sips -z 1024 1024 "$TMP_SQUARE" >/dev/null
  # 用 tauri icon 生成全平台图标
  npx tauri icon "$TMP_SQUARE" --output src-tauri/icons
  rm -f "$TMP_SQUARE"
  echo -e "  ${GREEN}✔ 图标已更新${NC}"
else
  echo ""
  echo -e "${YELLOW}[3/4] 图标已是最新，跳过${NC}"
fi

# 5. 构建
echo ""
echo -e "${YELLOW}[4/4] 构建 .app 和 .dmg...${NC}"
npx tauri build --target universal-apple-darwin

# 6. 输出结果
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  打包完成！${NC}"
echo -e "${GREEN}==========================================${NC}"

BUNDLE_DIR="$ROOT/src-tauri/target/universal-apple-darwin/release/bundle"
echo ""
echo -e "${CYAN}输出目录: $BUNDLE_DIR${NC}"

if [ -d "$BUNDLE_DIR/app" ]; then
  echo -e "${GREEN}.app 应用:${NC}"
  find "$BUNDLE_DIR/app" -maxdepth 1 -name "*.app" -exec sh -c '
    size=$(du -sh "$1" | awk "{print \$1}")
    echo "  $(basename "$1")  ($size)"
  ' _ {} \;
fi

if [ -d "$BUNDLE_DIR/dmg" ]; then
  echo -e "${GREEN}.dmg 安装镜像:${NC}"
  find "$BUNDLE_DIR/dmg" -maxdepth 1 -name "*.dmg" -exec sh -c '
    size=$(du -h "$1" | awk "{print \$1}")
    echo "  $(basename "$1")  ($size)"
  ' _ {} \;
fi

echo ""
echo -e "${GRAY}提示：${NC}"
echo -e "${GRAY}  - .dmg 是分发镜像，用户双击挂载后拖入 Applications 即可${NC}"
echo -e "${GRAY}  - .app 可直接运行，但分发推荐使用 .dmg${NC}"
echo -e "${GRAY}  - Universal Binary 同时支持 Intel 和 Apple Silicon (M1/M2)${NC}"
echo -e "${GRAY}  - 首次运行可能需要在系统设置 -> 隐私与安全性 中允许打开${NC}"
