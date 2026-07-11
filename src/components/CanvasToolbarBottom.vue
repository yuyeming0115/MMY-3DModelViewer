<script setup lang="ts">
import { ref } from "vue";
import type { BgColor } from "../three/SceneManager";

const props = defineProps<{
  bgColor: BgColor;
  angle: number;
  lightIntensity: number;
  envRotation: number;
  hasModel: boolean;
}>();

const emit = defineEmits<{
  "update:bgColor": [v: BgColor];
  "update:lightIntensity": [v: number];
  "update:envRotation": [v: number];
}>();

const bgOptions: { key: BgColor; style: string }[] = [
  { key: "dark", style: "#1a1a1a" },
  { key: "light", style: "#ffffff" },
  { key: "gray", style: "#808080" },
  { key: "transparent", style: "linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%);background-size:8px 8px;background-position:0 0,4px 4px" },
];

const editLight = ref(false);
const editRot = ref(false);
const lightInput = ref("1.00");
const rotInput = ref("0");

function startEditLight() {
  lightInput.value = props.lightIntensity.toFixed(2);
  editLight.value = true;
}
function commitLight() {
  editLight.value = false;
  const v = parseFloat(lightInput.value);
  if (!isNaN(v)) {
    const clamped = Math.max(0, Math.min(3, v));
    emit("update:lightIntensity", clamped);
  }
}
function startEditRot() {
  rotInput.value = String(Math.round(props.envRotation));
  editRot.value = true;
}
function commitRot() {
  editRot.value = false;
  let v = parseFloat(rotInput.value);
  if (!isNaN(v)) {
    v = ((v % 360) + 360) % 360;
    emit("update:envRotation", v);
  }
}
</script>

<template>
  <div class="canvas-toolbar-bottom">
    <div class="tool-group">
      <!-- 背景色 -->
      <div class="bg-colors">
        <button
          v-for="bg in bgOptions"
          :key="bg.key"
          class="bg-btn"
          :class="{ active: bgColor === bg.key }"
          :style="bg.key === 'transparent' ? `background:${bg.style}` : `background:${bg.style}`"
          @click="emit('update:bgColor', bg.key)"
          :title="bg.key === 'dark' ? '深色' : bg.key === 'light' ? '白色' : bg.key === 'gray' ? '灰色' : '透明'"
        />
      </div>

      <div class="sep"></div>

      <!-- 光照强度 -->
      <button class="tool-btn icon-only" title="光照强度">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </button>
      <input
        type="range"
        min="0"
        max="3"
        step="0.05"
        :value="lightIntensity"
        @input="emit('update:lightIntensity', parseFloat(($event.target as HTMLInputElement).value))"
        class="hud-slider"
      />
      <input
        v-if="editLight"
        v-model="lightInput"
        type="number"
        min="0"
        max="3"
        step="0.05"
        class="num-input"
        @blur="commitLight"
        @keydown.enter="commitLight"
        autofocus
      />
      <span v-else class="slider-val" @dblclick="startEditLight">{{ lightIntensity.toFixed(2) }}</span>

      <div class="sep"></div>

      <!-- HDR 水平旋转 -->
      <button class="tool-btn icon-only" title="HDR 旋转">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>
      <input
        type="range"
        min="0"
        max="360"
        step="1"
        :value="envRotation"
        @input="emit('update:envRotation', parseFloat(($event.target as HTMLInputElement).value))"
        class="hud-slider"
      />
      <input
        v-if="editRot"
        v-model="rotInput"
        type="number"
        min="0"
        max="360"
        step="1"
        class="num-input"
        @blur="commitRot"
        @keydown.enter="commitRot"
        autofocus
      />
      <span v-else class="slider-val" @dblclick="startEditRot">{{ Math.round(envRotation) }}°</span>

      <div class="sep"></div>

      <!-- 视角角度 -->
      <span class="angle-display" :title="'水平视角：' + angle + '°'">{{ angle }}°</span>
    </div>
  </div>
</template>

<style scoped>
.canvas-toolbar-bottom {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 20;
  pointer-events: none;
}
.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(50, 52, 58, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 6px;
  padding: 4px 10px;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.bg-colors {
  display: flex;
  gap: 4px;
  padding: 2px;
}
.bg-btn {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  border: 2px solid transparent;
  transition: border-color 0.12s;
  cursor: pointer;
}
.bg-btn.active {
  border-color: var(--accent);
}
.bg-btn:hover {
  border-color: #999;
}
.sep {
  width: 1px;
  height: 18px;
  background: rgba(255,255,255,0.2);
}
.tool-btn.icon-only {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #bbb;
  transition: all 0.12s;
}
.tool-btn.icon-only:hover {
  background: rgba(255,255,255,0.15);
  color: #fff;
}
.hud-slider {
  width: 70px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.25);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.hud-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}
.slider-val {
  font-size: 11px;
  color: #ddd;
  min-width: 38px;
  font-family: "Cascadia Code", Consolas, monospace;
  cursor: text;
  user-select: none;
  padding: 2px 3px;
  border-radius: 2px;
}
.slider-val:hover {
  background: rgba(255,255,255,0.12);
}
.num-input {
  width: 44px;
  font-size: 11px;
  font-family: "Cascadia Code", Consolas, monospace;
  background: rgba(255,255,255,0.15);
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: #fff;
  padding: 2px 4px;
  outline: none;
  text-align: right;
}
.num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
.angle-display {
  font-size: 11px;
  color: #aaa;
  font-family: "Cascadia Code", Consolas, monospace;
  min-width: 36px;
  text-align: right;
  padding-left: 4px;
}
</style>
