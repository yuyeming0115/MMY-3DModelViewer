#!/bin/bash
# 双击此文件即可在终端运行打包
cd "$(dirname "$0")"
chmod +x build-macos.sh
./build-macos.sh
echo ""
read -n 1 -s -r -p "按任意键关闭窗口..."
