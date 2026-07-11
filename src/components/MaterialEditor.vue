<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import type { MaterialInfo } from "../three/ModelLoader";
import type { MapChannel } from "../three/SceneManager";

const props = defineProps<{
  materials: MaterialInfo[];
  getThumbnail?: (uuid: string, channel: MapChannel) => string | null;
}>();

const emit = defineEmits<{
  "update:color": [uuid: string, hex: string];
  "update:roughness": [uuid: string, v: number];
  "update:metalness": [uuid: string, v: number];
  "update:opacity": [uuid: string, v: number];
  "update:emissive": [uuid: string, hex: string];
  "update:emissiveIntensity": [uuid: string, v: number];
  "update:normalScale": [uuid: string, v: number];
  "update:aoIntensity": [uuid: string, v: number];
  "import-map": [uuid: string, channel: MapChannel];
  "clear-map": [uuid: string, channel: MapChannel];
  "select-mat": [uuid: string];
}>();

const selectedMatUuid = ref<string>("");
const thumbnails = ref<Record<string, string | null>>({});
const forceKey = ref(0);
const editingKey = ref<string>("");
const editValue = ref("");

function startEdit(key: string, currentVal: number) {
  editingKey.value = key;
  editValue.value = String(currentVal);
}
function commitEdit(def: ChannelDef) {
  const key = def.sliderKey || "";
  if (!selectedMatUuid.value || !key) { editingKey.value = ""; return; }
  editingKey.value = "";
  const v = parseFloat(editValue.value);
  if (isNaN(v)) return;
  const clamped = Math.max(def.min ?? 0, Math.min(def.max ?? 1, v));
  onSliderInput(def, clamped);
}

watch(() => props.materials, (mats) => {
  if (mats && mats.length > 0 && !selectedMatUuid.value) {
    selectedMatUuid.value = mats[0].uuid;
  }
  if (mats && mats.length > 0 && !mats.find(m => m.uuid === selectedMatUuid.value)) {
    selectedMatUuid.value = mats[0].uuid;
  }
  refreshThumbnails();
}, { immediate: true });

watch(selectedMatUuid, (v) => {
  if (v) emit("select-mat", v);
  refreshThumbnails();
});

function refreshThumbnails() {
  nextTick(() => {
    const channels: MapChannel[] = ["map","normalMap","roughnessMap","metalnessMap","aoMap","alphaMap","emissiveMap"];
    const newThumbs: Record<string, string | null> = {};
    if (selectedMatUuid.value && props.getThumbnail) {
      channels.forEach(ch => {
        newThumbs[ch] = props.getThumbnail!(selectedMatUuid.value, ch);
      });
    }
    thumbnails.value = newThumbs;
    forceKey.value++;
  });
}

function getHasMap(ch: MapChannel, mat: MaterialInfo | null): boolean {
  if (!mat) return false;
  switch (ch) {
    case "map": return mat.hasMap;
    case "normalMap": return mat.hasNormalMap;
    case "roughnessMap": return mat.hasRoughnessMap;
    case "metalnessMap": return mat.hasMetalnessMap;
    case "aoMap": return mat.hasAOMap;
    case "alphaMap": return mat.hasAlphaMap;
    case "emissiveMap": return mat.hasEmissiveMap;
  }
}

function onImportMap(ch: MapChannel) {
  if (!selectedMatUuid.value) return;
  emit("import-map", selectedMatUuid.value, ch);
  // 导入后刷新缩略图（父组件导入完成后会触发响应式更新，此处延迟刷新）
  setTimeout(refreshThumbnails, 500);
}
function onClearMap(ch: MapChannel) {
  if (!selectedMatUuid.value) return;
  emit("clear-map", selectedMatUuid.value, ch);
  thumbnails.value[ch] = null;
  forceKey.value++;
}

const currentMat = computed(() => {
  return props.materials.find(m => m.uuid === selectedMatUuid.value) || null;
});

const currentIndex = computed(() => {
  return props.materials.findIndex(m => m.uuid === selectedMatUuid.value);
});

function switchMat(direction: -1 | 1) {
  if (!props.materials.length) return;
  const idx = currentIndex.value;
  if (idx < 0) {
    selectedMatUuid.value = props.materials[0].uuid;
    return;
  }
  const len = props.materials.length;
  const next = (idx + direction + len) % len; // 循环切换
  selectedMatUuid.value = props.materials[next].uuid;
}

// 颜色通道定义: label, channel, hasSlider, sliderMin, sliderMax, sliderStep, sliderValue prop name, event name, defaultValue
interface ChannelDef {
  label: string;
  channel?: MapChannel;
  hasColor?: boolean;
  hasSlider?: boolean;
  isEmissive?: boolean;
  sliderKey?: "roughness" | "metalness" | "opacity" | "emissiveIntensity" | "normalScale" | "aoIntensity";
  min?: number;
  max?: number;
  step?: number;
  defaultVal?: number;
}

const channels: ChannelDef[] = [
  { label: "颜色", channel: "map", hasColor: true },
  { label: "法线", channel: "normalMap", hasSlider: true, sliderKey: "normalScale", min: 0, max: 2, step: 0.01, defaultVal: 1 },
  { label: "粗糙度", channel: "roughnessMap", hasSlider: true, sliderKey: "roughness", min: 0, max: 1, step: 0.01, defaultVal: 0.5 },
  { label: "金属度", channel: "metalnessMap", hasSlider: true, sliderKey: "metalness", min: 0, max: 1, step: 0.01, defaultVal: 0 },
  { label: "AO", channel: "aoMap", hasSlider: true, sliderKey: "aoIntensity", min: 0, max: 2, step: 0.01, defaultVal: 1 },
  { label: "透明", channel: "alphaMap", hasSlider: true, sliderKey: "opacity", min: 0, max: 1, step: 0.01, defaultVal: 1 },
  { label: "自发光", channel: "emissiveMap", hasColor: true, isEmissive: true, hasSlider: true, sliderKey: "emissiveIntensity", min: 0, max: 3, step: 0.01, defaultVal: 1 },
];

function getSliderValue(def: ChannelDef): number {
  if (!currentMat.value || !def.sliderKey) return def.defaultVal ?? 0;
  const m = currentMat.value as any;
  return m[def.sliderKey] ?? def.defaultVal ?? 0;
}

function onSliderInput(def: ChannelDef, v: number) {
  if (!selectedMatUuid.value) return;
  switch (def.sliderKey) {
    case "roughness": emit("update:roughness", selectedMatUuid.value, v); break;
    case "metalness": emit("update:metalness", selectedMatUuid.value, v); break;
    case "opacity": emit("update:opacity", selectedMatUuid.value, v); break;
    case "emissiveIntensity": emit("update:emissiveIntensity", selectedMatUuid.value, v); break;
    case "normalScale": emit("update:normalScale", selectedMatUuid.value, v); break;
    case "aoIntensity": emit("update:aoIntensity", selectedMatUuid.value, v); break;
  }
}

function onColorInput(hex: string, isEmissive = false) {
  if (!selectedMatUuid.value) return;
  if (isEmissive) {
    emit("update:emissive", selectedMatUuid.value, hex);
  } else {
    emit("update:color", selectedMatUuid.value, hex);
  }
}
</script>

<template>
  <div class="material-editor">
    <div class="section-title">材质编辑</div>

    <div v-if="!materials || materials.length === 0" class="placeholder">
      导入模型后可编辑材质
    </div>

    <template v-else :key="forceKey">
      <div class="mat-nav">
        <button class="nav-btn" :disabled="materials.length <= 1" @click="switchMat(-1)" title="上一个材质">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="mat-name-display" :title="currentMat?.name">
          <span class="mat-idx">{{ currentIndex + 1 }}/{{ materials.length }}</span>
          <span class="mat-name-text">{{ currentMat?.name || '-' }}</span>
        </div>
        <button class="nav-btn" :disabled="materials.length <= 1" @click="switchMat(1)" title="下一个材质">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <div v-for="def in channels" :key="def.label" class="mat-row">
        <!-- 缩略图槽 (有贴图channel的行) -->
        <div v-if="def.channel" class="thumb-slot" :class="{ filled: getHasMap(def.channel, currentMat) }" @click="onImportMap(def.channel)">
          <img v-if="thumbnails[def.channel]" :src="thumbnails[def.channel]!" class="thumb-img" />
          <template v-else>
            <svg v-if="!getHasMap(def.channel, currentMat)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </template>
          <!-- 删除按钮 -->
          <button v-if="getHasMap(def.channel, currentMat)" class="thumb-clear" @click.stop="onClearMap(def.channel!)" title="移除贴图">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- 标签 -->
        <span class="row-label">{{ def.label }}</span>

        <!-- 控件区 -->
        <div class="row-control">
          <!-- 颜色拾取 -->
          <input
            v-if="def.hasColor && !def.isEmissive"
            type="color"
            class="color-picker"
            :value="currentMat?.color || '#cccccc'"
            @input="onColorInput(($event.target as HTMLInputElement).value)"
          />
          <!-- 自发光颜色 -->
          <input
            v-if="def.isEmissive"
            type="color"
            class="color-picker small"
            :value="currentMat?.emissive || '#000000'"
            @input="onColorInput(($event.target as HTMLInputElement).value, true)"
          />
          <!-- 滑块 -->
          <input
            v-if="def.hasSlider"
            type="range"
            :min="def.min"
            :max="def.max"
            :step="def.step"
            :value="getSliderValue(def)"
            @input="onSliderInput(def, parseFloat(($event.target as HTMLInputElement).value))"
            class="mat-slider"
          />
          <!-- 滑块数值（双击可编辑） -->
          <input
            v-if="def.hasSlider && editingKey === def.sliderKey"
            v-model="editValue"
            type="number"
            :min="def.min"
            :max="def.max"
            :step="def.step"
            class="slider-num-input"
            @blur="commitEdit(def)"
            @keydown.enter="commitEdit(def)"
            @keydown.esc="editingKey = ''"
            autofocus
          />
          <span v-else-if="def.hasSlider" class="slider-val" @dblclick="def.sliderKey && startEdit(def.sliderKey, getSliderValue(def))">{{ getSliderValue(def).toFixed(2) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.material-editor { padding: 0; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
  margin-top: 14px;
}
.placeholder {
  color: var(--placeholder);
  font-size: 12px;
  padding: 10px 0;
  text-align: center;
}
.mat-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}
.nav-btn {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg2);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}
.nav-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}
.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.mat-name-display {
  flex: 1;
  min-width: 0;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg2);
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 6px;
  overflow: hidden;
}
.mat-idx {
  font-size: 10px;
  color: var(--muted);
  font-family: "Cascadia Code", Consolas, monospace;
  flex-shrink: 0;
}
.mat-name-text {
  font-size: 12px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mat-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  gap: 6px;
}

/* 缩略图槽 */
.thumb-slot {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 1px dashed var(--border);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: var(--bg);
  transition: all 0.12s;
}
.thumb-slot:hover {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
}
.thumb-slot.filled {
  border-style: solid;
  border-color: var(--border);
}
.thumb-slot.filled:hover {
  border-color: var(--accent);
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-clear {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 14px;
  height: 14px;
  background: rgba(0,0,0,0.65);
  color: #fff;
  border: none;
  border-bottom-left-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.thumb-slot:hover .thumb-clear {
  opacity: 1;
}
.thumb-clear:hover {
  background: var(--danger);
}

.row-label {
  font-size: 12px;
  color: var(--muted);
  width: 42px;
  flex-shrink: 0;
}
.row-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}
.color-picker {
  width: 22px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0;
  cursor: pointer;
  background: none;
  flex-shrink: 0;
}
.color-picker.small { width: 18px; height: 16px; }
.mat-slider {
  flex: 1;
  height: 3px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-light);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.mat-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}
.slider-val {
  font-size: 10px;
  color: var(--muted);
  font-family: "Cascadia Code", Consolas, monospace;
  min-width: 28px;
  text-align: right;
  flex-shrink: 0;
  cursor: text;
  user-select: none;
  padding: 1px 2px;
  border-radius: 2px;
}
.slider-val:hover {
  background: var(--overlay-hover);
  color: var(--text);
}
.slider-num-input {
  width: 38px;
  font-size: 10px;
  font-family: "Cascadia Code", Consolas, monospace;
  background: var(--input-bg);
  border: 1px solid var(--accent);
  border-radius: 2px;
  color: var(--input-text);
  padding: 1px 3px;
  outline: none;
  text-align: right;
  flex-shrink: 0;
}
.slider-num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
</style>
