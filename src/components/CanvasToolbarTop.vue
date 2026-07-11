<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import type { ViewPreset, DisplayMode } from "../three/SceneManager";

const props = defineProps<{
  showGrid: boolean;
  displayMode: DisplayMode;
  hasModel: boolean;
  viewMode: "3d" | "2d";
}>();

const emit = defineEmits<{
  "update:showGrid": [v: boolean];
  "update:displayMode": [v: DisplayMode];
  "set-view": [v: ViewPreset];
  reset: [];
  "toggle-view-mode": [v: "3d" | "2d"];
  import: [];
}>();

const showViewMenu = ref(false);
const dropdownEl = ref<HTMLElement | null>(null);

const views: { key: ViewPreset; label: string }[] = [
  { key: "perspective", label: "透视" },
  { key: "front", label: "前" },
  { key: "back", label: "后" },
  { key: "left", label: "左" },
  { key: "right", label: "右" },
  { key: "top", label: "顶" },
  { key: "bottom", label: "底" },
];
const modeLabelMap: Record<DisplayMode, string> = {
  solid: "实体", wireframe: "线框", normals: "法线",
};

function selectView(v: ViewPreset) {
  emit("set-view", v);
  showViewMenu.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (dropdownEl.value && !dropdownEl.value.contains(e.target as Node)) {
    showViewMenu.value = false;
  }
}
onMounted(() => document.addEventListener("mousedown", onClickOutside));
onUnmounted(() => document.removeEventListener("mousedown", onClickOutside));
</script>

<template>
  <div class="canvas-toolbar-top">
    <div class="tool-group">
      <button class="tool-btn icon-only" title="导入模型" @click="emit('import')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>

      <div class="dropdown" ref="dropdownEl">
        <button class="tool-btn" @click="showViewMenu = !showViewMenu" :disabled="!hasModel || viewMode === '2d'">
          <span>视角</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:3px">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div v-if="showViewMenu" class="dropdown-menu">
          <button
            v-for="v in views"
            :key="v.key"
            class="dropdown-item"
            @click="selectView(v.key)"
          >{{ v.label }}</button>
        </div>
      </div>

      <button class="tool-btn icon-only" title="重置视角" @click="emit('reset')" :disabled="!hasModel || viewMode === '2d'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
      </button>

      <button
        class="tool-btn icon-only"
        :class="{ active: showGrid }"
        title="网格"
        @click="emit('update:showGrid', !showGrid)"
        :disabled="viewMode === '2d'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>

      <select class="tool-select" :value="displayMode" @change="emit('update:displayMode', ($event.target as HTMLSelectElement).value as DisplayMode)" :disabled="!hasModel || viewMode === '2d'">
        <option v-for="(label, key) in modeLabelMap" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="tool-group right">
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === '3d' }"
          @click="emit('toggle-view-mode', '3d')"
        >3D</button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === '2d' }"
          :disabled="!hasModel"
          @click="emit('toggle-view-mode', '2d')"
        >2D</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-toolbar-top {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 20;
  pointer-events: none;
}
.tool-group {
  display: flex;
  gap: 4px;
  background: rgba(50, 52, 58, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 6px;
  padding: 4px;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.tool-group.right { gap: 0; padding: 3px; }
.tool-btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 4px;
  color: #ddd;
  font-size: 12px;
  transition: all 0.12s;
  white-space: nowrap;
}
.tool-btn.icon-only {
  padding: 5px;
  width: 28px;
  height: 28px;
  justify-content: center;
}
.tool-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.15);
  color: #fff;
}
.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tool-btn.active {
  background: var(--accent);
  color: #fff;
}
.tool-select {
  padding: 4px 22px 4px 8px;
  border-radius: 4px;
  border: none;
  background: rgba(255,255,255,0.12);
  color: #ddd;
  font-size: 12px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}
.tool-select:hover:not(:disabled) {
  background-color: rgba(255,255,255,0.2);
  color: #fff;
}
.tool-select:disabled { opacity: 0.35; cursor: not-allowed; }
.tool-select option { background: #3a3c42; color: #ddd; }

.dropdown { position: relative; }
.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: rgba(50,52,58,0.96);
  backdrop-filter: blur(10px);
  border-radius: 6px;
  padding: 4px;
  min-width: 80px;
  z-index: 30;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.dropdown-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  border-radius: 4px;
  color: #ddd;
  font-size: 12px;
  text-align: left;
  transition: all 0.1s;
}
.dropdown-item:hover {
  background: rgba(64,128,255,0.25);
  color: #fff;
}

.view-toggle {
  display: flex;
  border-radius: 4px;
  overflow: hidden;
}
.toggle-btn {
  padding: 4px 10px;
  font-size: 12px;
  color: #999;
  background: transparent;
  transition: all 0.12s;
}
.toggle-btn.active {
  background: var(--accent);
  color: #fff;
  border-radius: 4px;
}
.toggle-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.toggle-btn:hover:not(:disabled):not(.active) {
  color: #fff;
  background: rgba(255,255,255,0.12);
}
</style>
