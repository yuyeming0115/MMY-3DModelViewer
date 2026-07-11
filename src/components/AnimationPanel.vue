<script setup lang="ts">
import { ref, watch } from "vue";

interface AnimInfo {
  name: string;
  duration: number;
  index: number;
}

const props = defineProps<{
  animations: AnimInfo[];
}>();

const emit = defineEmits<{
  "play": [index: number];
  "pause": [paused: boolean];
  "speed": [speed: number];
  "stop": [];
}>();

const selectedIndex = ref<number>(-1);
const isPaused = ref(false);
const isStopped = ref(false);
const BASE_FPS = 30;
const MAX_FPS = 90;
const fps = ref(BASE_FPS);

watch(() => props.animations, (anims) => {
  selectedIndex.value = anims.length > 0 ? 0 : -1;
  isPaused.value = false;
  isStopped.value = false;
  fps.value = BASE_FPS;
  if (anims.length > 0) {
    emit("speed", 1.0);
    emit("play", 0);
  }
}, { immediate: true });

function onSelectChange(e: Event) {
  const idx = parseInt((e.target as HTMLSelectElement).value, 10);
  if (isNaN(idx) || idx < 0) return;
  selectedIndex.value = idx;
  isPaused.value = false;
  isStopped.value = false;
  emit("play", idx);
}

function togglePlayPause() {
  if (selectedIndex.value < 0) return;
  if (isStopped.value) {
    // 停止后重新播放
    isStopped.value = false;
    isPaused.value = false;
    emit("play", selectedIndex.value);
    return;
  }
  if (isPaused.value) {
    isPaused.value = false;
    emit("pause", false);
  } else {
    isPaused.value = true;
    emit("pause", true);
  }
}

function onStop() {
  isPaused.value = false;
  isStopped.value = true;
  emit("stop");
}

function onSpeedStep(delta: number) {
  let v = Math.round(fps.value + delta);
  v = Math.max(0, Math.min(MAX_FPS, v));
  fps.value = v;
  emit("speed", v / BASE_FPS);
}

function onSpeedInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  if (raw === "") return; // 输入中，等用户完成
  const v = parseInt(raw, 10);
  if (isNaN(v)) return;
  const clamped = Math.max(0, Math.min(MAX_FPS, v));
  fps.value = clamped;
  emit("speed", clamped / BASE_FPS);
}

function onSpeedBlur(e: Event) {
  // 失焦时回填规范化值
  (e.target as HTMLInputElement).value = String(fps.value);
}
</script>

<template>
  <div v-if="animations.length > 0" class="anim-toolbar">
    <select class="anim-select" :value="selectedIndex" @change="onSelectChange">
      <option v-for="anim in animations" :key="anim.index" :value="anim.index">
        {{ anim.name }}
      </option>
    </select>
    <button class="anim-btn play-btn" :class="{ paused: isPaused, stopped: isStopped }" @click="togglePlayPause" :title="isStopped ? '播放' : (isPaused ? '播放' : '暂停')">
      <svg v-if="isStopped || isPaused" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
      <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </button>
    <button class="anim-btn stop-btn" @click="onStop" title="停止">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14"/></svg>
    </button>
    <div class="speed-group">
      <button class="speed-step-btn" @click="onSpeedStep(-1)" title="减帧">−</button>
      <input
        type="number"
        min="0"
        :max="MAX_FPS"
        step="1"
        :value="fps"
        @input="onSpeedInput"
        @blur="onSpeedBlur"
        class="speed-input"
      />
      <button class="speed-step-btn" @click="onSpeedStep(1)" title="加帧">+</button>
      <span class="speed-label">FPS</span>
    </div>
  </div>
</template>

<style scoped>
.anim-toolbar {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(50, 52, 58, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 6px;
  padding: 4px;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.anim-select {
  max-width: 140px;
  padding: 4px 20px 4px 8px;
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
.anim-select:hover {
  background-color: rgba(255,255,255,0.2);
  color: #fff;
}
.anim-select option { background: #3a3c42; color: #ddd; }
.anim-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
  flex-shrink: 0;
}
.play-btn {
  background: var(--accent);
  color: #fff;
}
.play-btn:hover {
  background: var(--accent-hover);
}
.play-btn.paused {
  background: #52c41a;
}
.play-btn.stopped {
  background: #52c41a;
}
.stop-btn {
  background: rgba(255,255,255,0.12);
  color: #ddd;
}
.stop-btn:hover {
  background: rgba(245,63,63,0.8);
  color: #fff;
}
.speed-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 4px;
  border-left: 1px solid rgba(255,255,255,0.15);
}
.speed-step-btn {
  width: 20px;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: rgba(255,255,255,0.1);
  color: #ddd;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
  flex-shrink: 0;
  line-height: 1;
}
.speed-step-btn:hover {
  background: var(--accent);
  color: #fff;
}
.speed-input {
  width: 46px;
  height: 22px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 3px;
  background: rgba(255,255,255,0.08);
  color: #ddd;
  font-size: 11px;
  font-family: "Cascadia Code", Consolas, monospace;
  text-align: center;
  outline: none;
  padding: 0 2px;
  -moz-appearance: textfield;
}
.speed-input:focus {
  border-color: var(--accent);
  background: rgba(255,255,255,0.12);
}
.speed-input::-webkit-inner-spin-button,
.speed-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.speed-label {
  font-size: 10px;
  color: #999;
  margin-left: 1px;
  flex-shrink: 0;
}
</style>
