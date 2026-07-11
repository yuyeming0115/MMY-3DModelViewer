<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import type { UV2DData } from "../three/SceneManager";

const props = defineProps<{
  data: UV2DData[];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const textureImages = ref<Map<string, HTMLImageElement>>(new Map());

function renderAll() {
  nextTick(() => {
    if (!containerRef.value) return;
    const pairs = containerRef.value.querySelectorAll<HTMLDivElement>(".uv-pair");
    pairs.forEach((pairEl, idx) => {
      const data = props.data[idx];
      if (!data) return;
      // Texture pane
      const texCanvas = pairEl.querySelector<HTMLCanvasElement>("canvas.tex-canvas");
      const uvCanvas = pairEl.querySelector<HTMLCanvasElement>("canvas.uv-canvas");
      if (texCanvas) drawTexture(texCanvas, data);
      if (uvCanvas) drawUVWire(uvCanvas, data);
    });
  });
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) return 0;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  const size = Math.min(w, h);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return size;
}

function drawTexture(canvas: HTMLCanvasElement, data: UV2DData) {
  const size = setupCanvas(canvas);
  if (!size) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  if (data.textureUrl) {
    let img = textureImages.value.get(data.textureUrl);
    const renderImg = () => {
      if (!img) return;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };
    if (img && img.complete && img.naturalWidth > 0) {
      renderImg();
    } else {
      img = new Image();
      img.onload = () => {
        textureImages.value.set(data.textureUrl!, img!);
        renderImg();
      };
      img.src = data.textureUrl;
    }
  }
}

function drawUVWire(canvas: HTMLCanvasElement, data: UV2DData) {
  const size = setupCanvas(canvas);
  if (!size) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const checkSize = size / 20;
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#2a2a2a" : "#353535";
      ctx.fillRect(x * checkSize, y * checkSize, checkSize, checkSize);
    }
  }

  ctx.strokeStyle = "rgba(90,90,90,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

  ctx.strokeStyle = "rgba(200,200,200,0.85)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const segs = data.uvSegments;
  const pad = 2;
  const s = size - pad * 2;
  for (let i = 0; i < segs.length; i += 4) {
    const x1 = pad + segs[i] * s;
    const y1 = pad + segs[i + 1] * s;
    const x2 = pad + segs[i + 2] * s;
    const y2 = pad + segs[i + 3] * s;
    if (Math.abs(x1 - x2) > s * 0.6 || Math.abs(y1 - y2) > s * 0.6) continue;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

watch(() => props.data, renderAll, { deep: false });
onMounted(() => {
  setTimeout(renderAll, 50);
  window.addEventListener("resize", renderAll);
});
</script>

<template>
  <div ref="containerRef" class="uv2d-viewer">
    <div v-if="!data || data.length === 0" class="empty">
      当前材质没有 UV 或未导入颜色贴图
    </div>
    <template v-else>
      <div v-for="(d, i) in data" :key="d.materialUuid + '_' + i" class="uv-pair">
        <div class="uv-header">
          <span class="uv-title">{{ d.meshName }} / {{ d.materialName }}</span>
          <span class="uv-count">{{ d.triangleCount.toLocaleString() }} 三角面</span>
        </div>
        <div class="uv-panes">
          <div class="pane">
            <canvas v-if="d.textureUrl" class="tex-canvas"></canvas>
            <div v-else class="no-tex">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
              <span>无颜色贴图</span>
            </div>
          </div>
          <div class="pane">
            <canvas class="uv-canvas"></canvas>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.uv2d-viewer {
  position: absolute;
  inset: 0;
  padding: 50px 20px 50px 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 18;
  background: rgba(26, 26, 26, 0.96);
}
.empty {
  margin: auto;
  color: #888;
  font-size: 13px;
}
.uv-pair {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.uv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #888;
}
.uv-title { color: #bbb; font-weight: 500; }
.uv-count { color: #666; font-family: "Cascadia Code", Consolas, monospace; }
.uv-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  height: min(40vh, 360px);
}
.pane {
  position: relative;
  background: #1e1e1e;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pane canvas {
  display: block;
}
.no-tex {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 12px;
}
</style>
