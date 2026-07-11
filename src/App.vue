<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { SceneManager, type ViewPreset, type DisplayMode, type BgColor, type MapChannel, type UV2DData } from "./three/SceneManager";
import { loadModelFromBuffer, getFormat, isSupportedFormat, type ModelStats } from "./three/ModelLoader";
import { pickModelFile, pickImageFile, loadPickedFile, type PickedFile } from "./services/fileService";
import ModelInfo from "./components/ModelInfo.vue";
import CanvasToolbarTop from "./components/CanvasToolbarTop.vue";
import CanvasToolbarBottom from "./components/CanvasToolbarBottom.vue";
import UV2DViewer from "./components/UV2DViewer.vue";
import AnimationPanel from "./components/AnimationPanel.vue";

const canvasContainer = ref<HTMLElement | null>(null);
let scene: SceneManager | null = null;
let unlistenDragDrop: (() => void) | null = null;
let animFrameId = 0;

const currentFile = ref<PickedFile | null>(null);
const stats = ref<ModelStats | null>(null);
const bbox = ref<{ x: number; y: number; z: number } | null>(null);
const loading = ref(false);
const errorMsg = ref("");
const showGrid = ref(true);
const showAxes = ref(false);
const isDragging = ref(false);
const displayMode = ref<DisplayMode>("solid");
const bgColor = ref<BgColor>("dark");
const camAngle = ref(0);
const lightIntensity = ref(1.0);
const envRotation = ref(0);
const selectedMatUuid = ref<string>("");
const isDarkTheme = ref(false);
const viewMode = ref<"3d" | "2d">("3d");
const uv2dData = ref<UV2DData[]>([]);
const animList = ref<{ name: string; duration: number; index: number }[]>([]);

function updateCamInfo() {
  if (!scene) return;
  camAngle.value = scene.getCameraAngle();
}

onMounted(async () => {
  document.documentElement.setAttribute("data-theme", isDarkTheme.value ? "dark" : "light");

  if (canvasContainer.value) {
    scene = new SceneManager(canvasContainer.value);
    scene.setGridVisible(showGrid.value);
    scene.setAxesVisible(showAxes.value);
    scene.setBackground(bgColor.value);
  }

  try {
    const webview = await getCurrentWebview();
    unlistenDragDrop = await webview.onDragDropEvent(async (event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        isDragging.value = true;
      } else if (event.payload.type === "leave") {
        isDragging.value = false;
      } else if (event.payload.type === "drop") {
        isDragging.value = false;
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          try {
            // 分类：模型 vs 贴图
            const modelPaths: string[] = [];
            const imagePaths: string[] = [];
            for (const p of paths) {
              const ext = p.split(".").pop()?.toLowerCase() || "";
              if (["glb","gltf","fbx","obj","ply"].includes(ext)) {
                modelPaths.push(p);
              } else if (["png","jpg","jpeg","webp","bmp","tga"].includes(ext)) {
                imagePaths.push(p);
              }
            }
            // 优先加载模型
            if (modelPaths.length > 0) {
              const picked = await loadPickedFile(modelPaths[0]);
              await handleFile(picked);
            }
            // 贴图：按文件名分组匹配到多个材质球
            if (imagePaths.length > 0 && stats.value?.materialList?.length) {
              const materialList = stats.value.materialList;
              // 解析每张贴图：提取材质标识 + 通道
              const parsed = imagePaths.map(p => {
                const name = p.split(/[\\/]/).pop() || p;
                const { matKey, channel } = extractMaterialAndChannel(name);
                return { path: p, matKey, channel, name };
              });
              // 按材质标识分组
              const groups = new Map<string, typeof parsed>();
              for (const img of parsed) {
                if (!groups.has(img.matKey)) groups.set(img.matKey, []);
                groups.get(img.matKey)!.push(img);
              }
              // 对每个分组匹配材质球并应用
              let appliedGroups = 0;
              for (const [matKey, imgs] of groups) {
                const targetUuid = findMaterialByContainment(matKey, materialList);
                if (!targetUuid) continue;
                for (const img of imgs) {
                  const picked = await loadPickedFile(img.path);
                  await scene?.setMaterialMap(targetUuid, img.channel, picked.buffer, picked.name);
                }
                appliedGroups++;
              }
              // 回退：所有贴图都没匹配上任何材质球时，用当前选中材质球
              if (appliedGroups === 0) {
                const targetMatUuid = selectedMatUuid.value || materialList[0].uuid;
                for (const img of parsed) {
                  const picked = await loadPickedFile(img.path);
                  await scene?.setMaterialMap(targetMatUuid, img.channel, picked.buffer, picked.name);
                }
              }
              refreshStats();
            }
          } catch (e: any) {
            errorMsg.value = `读取失败：${e?.message || String(e)}`;
          }
        }
      }
    });
  } catch (e) {
    console.warn("拖拽事件监听失败:", e);
  }

  const tick = () => {
    updateCamInfo();
    animFrameId = requestAnimationFrame(tick);
  };
  tick();
});

onUnmounted(() => {
  cancelAnimationFrame(animFrameId);
  unlistenDragDrop?.();
  scene?.dispose();
});

function refreshStats() {
  if (scene) {
    bbox.value = scene.getBoundingBox();
    scene.refreshMaterialList();
    if (stats.value) {
      stats.value = { ...stats.value, materialList: scene.getMaterialInfos() as any };
    }
    if (viewMode.value === "2d") {
      uv2dData.value = scene.getUV2DData();
    }
  }
}

function getThumbnail(uuid: string, channel: MapChannel): string | null {
  return scene?.getTextureThumbnail(uuid, channel) ?? null;
}

async function handleFile(file: PickedFile) {
  if (!isSupportedFormat(file.name)) {
    errorMsg.value = `不支持的格式：${file.name}`;
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    const format = getFormat(file.name);
    const result = await loadModelFromBuffer(
      file.buffer,
      format,
      file.name,
      file.size
    );
    scene?.setModel(result.model, result.animations);
    currentFile.value = file;
    stats.value = result.stats;
    bbox.value = scene?.getBoundingBox() ?? null;
    animList.value = scene?.getAnimations() ?? [];
    updateCamInfo();
    if (viewMode.value === "2d") {
      scene?.refreshMaterialList();
      uv2dData.value = scene?.getUV2DData() ?? [];
    }
  } catch (e: any) {
    errorMsg.value = `加载失败：${e?.message || String(e)}`;
  } finally {
    loading.value = false;
  }
}

async function onClickImport() {
  const file = await pickModelFile();
  if (file) await handleFile(file);
}

function onToggleGrid(v: boolean) {
  showGrid.value = v;
  scene?.setGridVisible(v);
}
function onToggleAxes(v: boolean) {
  showAxes.value = v;
  scene?.setAxesVisible(v);
}
function onSetView(v: ViewPreset) {
  scene?.setView(v);
}
function onResetView() {
  scene?.resetView();
}
function onSetDisplayMode(v: DisplayMode) {
  displayMode.value = v;
  scene?.setDisplayMode(v);
}
function onSetBgColor(v: BgColor) {
  bgColor.value = v;
  scene?.setBackground(v);
}
function onSetLightIntensity(v: number) {
  lightIntensity.value = v;
  scene?.setLightIntensity(v);
}

function onSetEnvRotation(v: number) {
  envRotation.value = v;
  scene?.setEnvironmentRotation(v);
}
function onScreenshot() {
  const dataUrl = scene?.captureScreenshot();
  if (!dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `screenshot-${Date.now()}.png`;
  a.click();
}

/** 通道关键词表：最后一段（分隔符后）匹配则认定该通道。按长度降序避免误匹配。 */
const CHANNEL_KEYWORDS: { kw: string; channel: MapChannel }[] = [
  { kw: "ambientocclusion", channel: "aoMap" },
  { kw: "ambient_occlusion", channel: "aoMap" },
  { kw: "ambient", channel: "aoMap" },
  { kw: "emissive", channel: "emissiveMap" },
  { kw: "emission", channel: "emissiveMap" },
  { kw: "metalness", channel: "metalnessMap" },
  { kw: "metallic", channel: "metalnessMap" },
  { kw: "roughness", channel: "roughnessMap" },
  { kw: "normal", channel: "normalMap" },
  { kw: "opacity", channel: "alphaMap" },
  { kw: "diffuse", channel: "map" },
  { kw: "albedo", channel: "map" },
  { kw: "basecolor", channel: "map" },
  { kw: "base_color", channel: "map" },
  { kw: "metal", channel: "metalnessMap" },
  { kw: "rough", channel: "roughnessMap" },
  { kw: "emit", channel: "emissiveMap" },
  { kw: "alpha", channel: "alphaMap" },
  { kw: "mask", channel: "alphaMap" },
  { kw: "occ", channel: "aoMap" },
  { kw: "mtl", channel: "metalnessMap" },
  { kw: "rgh", channel: "roughnessMap" },
  { kw: "nrm", channel: "normalMap" },
  { kw: "spec", channel: "metalnessMap" },
  { kw: "color", channel: "map" },
  { kw: "colour", channel: "map" },
  { kw: "base", channel: "map" },
  { kw: "ao", channel: "aoMap" },
  { kw: "col", channel: "map" },
];

/**
 * 从文件名提取材质标识 + 通道。
 * 策略：取最后一个分隔符（_ - 空格）后的部分，若命中通道关键词则分离，否则整个文件名作为材质标识。
 * 例：Body_normal.png → {matKey:"body", channel:"normalMap"}
 *     Body_color.png  → {matKey:"body", channel:"map"}
 *     Body.png        → {matKey:"body", channel:"map"}
 */
function extractMaterialAndChannel(fileName: string): { matKey: string; channel: MapChannel } {
  const base = fileName.replace(/\.[^.]+$/, "");
  const lastSep = Math.max(base.lastIndexOf("_"), base.lastIndexOf("-"), base.lastIndexOf(" "));
  if (lastSep === -1) {
    return { matKey: base.toLowerCase(), channel: "map" };
  }
  const lastPart = base.substring(lastSep + 1).toLowerCase();
  const found = CHANNEL_KEYWORDS.find(c => c.kw === lastPart);
  if (found) {
    return { matKey: base.substring(0, lastSep).toLowerCase(), channel: found.channel };
  }
  return { matKey: base.toLowerCase(), channel: "map" };
}

/** 按包含关系（大小写不敏感，双向）匹配材质球。先完全匹配，再包含匹配。 */
function findMaterialByContainment(matKey: string, materialList: { uuid: string; name: string }[]): string | null {
  if (!matKey) return null;
  const key = matKey.toLowerCase();
  for (const m of materialList) {
    if (m.name.toLowerCase() === key) return m.uuid;
  }
  for (const m of materialList) {
    const nameLower = m.name.toLowerCase();
    if (nameLower.includes(key) || key.includes(nameLower)) return m.uuid;
  }
  return null;
}

function onExportTexture() {
  if (!scene || !stats.value?.materialList?.length) return;
  // 尝试导出第一个有颜色贴图的材质
  for (const mat of stats.value.materialList) {
    const dataUrl = scene.exportTexture(mat.uuid, "map", "png");
    if (dataUrl) {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `texture-${mat.name || mat.uuid.slice(0, 8)}.png`;
      a.click();
      return;
    }
  }
  errorMsg.value = "当前材质没有颜色贴图可导出";
  setTimeout(() => { if (errorMsg.value === "当前材质没有颜色贴图可导出") errorMsg.value = ""; }, 3000);
}

// Mesh 选中
function onSelectMesh(uuid: string) {
  if (uuid) scene?.selectMesh(uuid);
  else scene?.clearSelection();
}

// 材质编辑
function onMatColor(uuid: string, hex: string) { scene?.setMaterialColor(uuid, hex); }
function onMatRoughness(uuid: string, v: number) { scene?.setMaterialRoughness(uuid, v); }
function onMatMetalness(uuid: string, v: number) { scene?.setMaterialMetalness(uuid, v); }
function onMatOpacity(uuid: string, v: number) { scene?.setMaterialOpacity(uuid, v); }
function onMatEmissive(uuid: string, hex: string) { scene?.setMaterialEmissive(uuid, hex); }
function onMatEmissiveIntensity(uuid: string, v: number) { scene?.setMaterialEmissiveIntensity(uuid, v); }
function onMatNormalScale(uuid: string, v: number) { scene?.setMaterialNormalScale(uuid, v); }
function onMatAOIntensity(uuid: string, v: number) { scene?.setMaterialAOIntensity(uuid, v); }

async function onMatImportMap(uuid: string, channel: MapChannel) {
  const img = await pickImageFile();
  if (!img) return;
  try {
    await scene?.setMaterialMap(uuid, channel, img.buffer, img.name);
    refreshStats();
  } catch (e: any) {
    errorMsg.value = `贴图加载失败：${e?.message || String(e)}`;
  }
}
function onMatClearMap(uuid: string, channel: MapChannel) {
  scene?.clearMaterialMap(uuid, channel);
  refreshStats();
}

function onMatSelectMat(uuid: string) {
  selectedMatUuid.value = uuid;
}

// 动画控制
function onAnimPlay(index: number) { scene?.playAnimation(index); }
function onAnimPause(paused: boolean) { scene?.setAnimationPaused(paused); }
function onAnimSpeed(speed: number) { scene?.setAnimationSpeed(speed); }
function onAnimStop() { scene?.stopAnimation(); }

function onToggleTheme() {
  isDarkTheme.value = !isDarkTheme.value;
  document.documentElement.setAttribute("data-theme", isDarkTheme.value ? "dark" : "light");
}

function onToggleViewMode(mode: "3d" | "2d") {
  viewMode.value = mode;
  if (mode === "2d" && scene) {
    // 刷新材质列表后获取 UV 数据
    scene.refreshMaterialList();
    uv2dData.value = scene.getUV2DData();
  } else {
    uv2dData.value = [];
  }
}
</script>

<template>
  <div class="app" :class="{ dragging: isDragging }">
    <div class="main-area">
      <div class="preview-area">
        <div class="canvas-card">
          <div ref="canvasContainer" class="canvas-container" :style="{ visibility: viewMode === '2d' ? 'hidden' : 'visible' }"></div>

          <CanvasToolbarTop
            :show-grid="showGrid"
            :display-mode="displayMode"
            :has-model="!!currentFile"
            :view-mode="viewMode"
            @update:show-grid="onToggleGrid"
            @update:display-mode="onSetDisplayMode"
            @set-view="onSetView"
            @reset="onResetView"
            @toggle-view-mode="onToggleViewMode"
            @import="onClickImport"
          />

          <CanvasToolbarBottom
            v-if="viewMode === '3d'"
            :bg-color="bgColor"
            :angle="camAngle"
            :light-intensity="lightIntensity"
            :env-rotation="envRotation"
            :has-model="!!currentFile"
            @update:bg-color="onSetBgColor"
            @update:light-intensity="onSetLightIntensity"
            @update:env-rotation="onSetEnvRotation"
          />

          <AnimationPanel
            v-if="viewMode === '3d'"
            :animations="animList"
            @play="onAnimPlay"
            @pause="onAnimPause"
            @speed="onAnimSpeed"
            @stop="onAnimStop"
          />

          <UV2DViewer v-if="viewMode === '2d'" :data="uv2dData" />

          <div v-if="isDragging" class="drop-overlay">
            <div class="drop-icon">📦</div>
            <div class="drop-text">释放以导入模型或贴图</div>
            <div class="drop-sub">贴图将按文件名自动匹配通道</div>
          </div>

          <div v-if="!currentFile && !loading && !isDragging && viewMode === '3d'" class="empty-hint">
            <svg class="empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#888" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 24 L24 12 L40 24 L24 36 Z" fill="rgba(255,255,255,0.05)"/>
              <path d="M24 12 L24 24 M24 24 L40 24 M24 24 L8 24 M24 24 L24 36"/>
              <circle cx="24" cy="24" r="2" fill="#888"/>
            </svg>
            <p class="empty-text">拖拽或点击导入 3D 模型</p>
            <p class="empty-formats">FBX / GLB / glTF / OBJ / PLY</p>
            <p class="empty-formats" style="margin-top:6px;color:#555">也可拖拽贴图，按文件名自动匹配通道</p>
          </div>

          <div v-if="loading" class="loading-mask">
            <div class="spinner"></div>
            <span>加载中…</span>
          </div>
        </div>
      </div>

      <aside class="right-panel">
        <ModelInfo
          :stats="stats"
          :bbox="bbox"
          :error="errorMsg"
          :get-thumbnail="getThumbnail"
          @select-mesh="onSelectMesh"
          @mat:color="onMatColor"
          @mat:roughness="onMatRoughness"
          @mat:metalness="onMatMetalness"
          @mat:opacity="onMatOpacity"
          @mat:emissive="onMatEmissive"
          @mat:emissiveIntensity="onMatEmissiveIntensity"
          @mat:normalScale="onMatNormalScale"
          @mat:aoIntensity="onMatAOIntensity"
          @mat:importMap="onMatImportMap"
          @mat:clearMap="onMatClearMap"
          @mat:selectMat="onMatSelectMat"
        />
        <div class="right-panel-bottom">
          <div class="bottom-row">
            <button class="export-btn" :disabled="!currentFile" @click="onExportTexture">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-2px">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              导出贴图
            </button>
            <button class="theme-btn" @click="onToggleTheme" :title="isDarkTheme ? '切换到亮色' : '切换到暗色'">
              {{ isDarkTheme ? '☀' : '☾' }}
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}
.app.dragging .canvas-card {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.main-area {
  flex: 1;
  display: flex;
  padding: 10px 20px 10px;
  gap: 20px;
  overflow: hidden;
  min-height: 0;
}

.preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.canvas-card {
  flex: 1;
  position: relative;
  background: var(--canvas-bg);
  border-radius: 6px;
  overflow: hidden;
  min-height: 0;
}
.canvas-container {
  width: 100%;
  height: 100%;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(22, 93, 255, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 25;
  pointer-events: none;
}
.drop-icon { font-size: 48px; }
.drop-text { color: #fff; font-size: 16px; font-weight: 500; }
.drop-sub { color: rgba(255,255,255,0.6); font-size: 12px; }

.empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
  z-index: 5;
}
.empty-icon { opacity: 0.5; margin-bottom: 4px; }
.empty-text { color: #888; font-size: 15px; }
.empty-formats { color: #666; font-size: 12px; letter-spacing: 0.5px; }

.loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ccc;
  z-index: 15;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255,255,255,0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.right-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.right-panel-bottom {
  margin-top: auto;
  padding: 12px 18px;
  border-top: 1px solid var(--border-light);
}
.bottom-row {
  display: flex;
  gap: 8px;
}
.export-btn {
  flex: 1;
  padding: 8px 0;
  border-radius: 4px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  transition: all 0.15s;
  cursor: pointer;
}
.export-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
.export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.theme-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg2);
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
