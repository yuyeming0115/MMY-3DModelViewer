# MMY-3DModelViewer Windows 一键打包脚本
# 生成单文件 EXE 安装包（NSIS）+ 便携 EXE
# 使用：右键 -> 用 PowerShell 运行，或：powershell -ExecutionPolicy Bypass -File build-windows.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MMY-3DModelViewer Windows 打包" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查依赖
Write-Host "[1/4] 检查依赖..." -ForegroundColor Yellow
$nodeOk = (Get-Command node -ErrorAction SilentlyContinue) -ne $null
$rustOk = (Get-Command cargo -ErrorAction SilentlyContinue) -ne $null
if (-not $nodeOk) { Write-Host "  ✖ 未找到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red; exit 1 }
if (-not $rustOk) { Write-Host "  ✖ 未找到 Rust/Cargo，请先安装 Rust (https://rustup.rs)" -ForegroundColor Red; exit 1 }
Write-Host "  ✔ Node.js 和 Rust 已安装" -ForegroundColor Green

# 2. 安装前端依赖
Write-Host ""
Write-Host "[2/4] 安装前端依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
} else {
    Write-Host "  node_modules 已存在，跳过" -ForegroundColor Gray
}
Write-Host "  ✔ 前端依赖就绪" -ForegroundColor Green

# 3. 生成图标（如果源图标比目标新）
$srcIcon = Join-Path $root "素材\icon.png"
$dstIcon = Join-Path $root "src-tauri\icons\icon.png"
if ((Test-Path $srcIcon) -and ((-not (Test-Path $dstIcon)) -or ((Get-Item $srcIcon).LastWriteTime -gt (Get-Item $dstIcon).LastWriteTime))) {
    Write-Host ""
    Write-Host "[3/4] 生成图标..." -ForegroundColor Yellow
    # 先用 .NET 裁切为 1024x1024 正方形
    Add-Type -AssemblyName System.Drawing
    $tmpSquare = Join-Path $env:TEMP "mmy-icon-1024.png"
    $img = [System.Drawing.Image]::FromFile($srcIcon)
    $s = [Math]::Min($img.Width, $img.Height)
    $x = ($img.Width - $s) / 2
    $y = ($img.Height - $s) / 2
    $bmp = New-Object System.Drawing.Bitmap(1024, 1024)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)), (New-Object System.Drawing.Rectangle($x, $y, $s, $s)), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $bmp.Save($tmpSquare, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $img.Dispose()
    # 用 tauri icon 生成全平台图标
    npx tauri icon $tmpSquare --output src-tauri/icons
    Remove-Item $tmpSquare -Force
    Write-Host "  ✔ 图标已更新" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[3/4] 图标已是最新，跳过" -ForegroundColor Gray
}

# 4. 构建（全量构建：同时产出 NSIS 安装包 + 便携 EXE）
Write-Host ""
Write-Host "[4/5] 构建 EXE..." -ForegroundColor Yellow
npx tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✖ 构建失败" -ForegroundColor Red
    exit 1
}

# 5. 汇总产物到 release 目录
Write-Host ""
Write-Host "[5/5] 汇总产物到 release 目录..." -ForegroundColor Yellow
$releaseDir = Join-Path $root "release"
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}
# 复制 NSIS 安装包
$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
if (Test-Path $nsisDir) {
    Get-ChildItem $nsisDir -Filter "*.exe" | ForEach-Object {
        Copy-Item $_.FullName -Destination $releaseDir -Force
        Write-Host "  ✔ 安装包: $($_.Name)" -ForegroundColor Green
    }
}
# 复制便携 EXE（Tauri 产物名为 Cargo package name，如 mmy-3d-model-viewer.exe）
$releaseTarget = Join-Path $root "src-tauri\target\release"
if (Test-Path $releaseTarget) {
    Get-ChildItem $releaseTarget -Filter "*.exe" -File | Where-Object { $_.DirectoryName -notlike "*\bundle*" } | ForEach-Object {
        $portableDest = Join-Path $releaseDir "MMY-3DModelViewer-portable.exe"
        Copy-Item $_.FullName -Destination $portableDest -Force
        Write-Host "  ✔ 便携版: MMY-3DModelViewer-portable.exe" -ForegroundColor Green
    }
}

# 输出结果
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "输出目录: $releaseDir" -ForegroundColor Cyan
Get-ChildItem $releaseDir -Filter "*.exe" | ForEach-Object {
    $sizeMB = [Math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name)  ($sizeMB MB)" -ForegroundColor White
}
Write-Host ""
Write-Host "提示：" -ForegroundColor Gray
Write-Host "  - NSIS 安装包: 单文件 .exe 双击安装" -ForegroundColor Gray
Write-Host "  - 便携版: 无需安装，直接运行（portable）" -ForegroundColor Gray
