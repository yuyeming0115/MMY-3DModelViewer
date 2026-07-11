<script setup lang="ts">
import { computed } from "vue";
import type { ModelStats } from "../three/ModelLoader";
import MaterialEditor from "./MaterialEditor.vue";
import MeshList from "./MeshList.vue";
import type { MapChannel } from "../three/SceneManager";

const props = defineProps<{
  stats: ModelStats | null;
  bbox: { x: number; y: number; z: number } | null;
  error: string;
  getThumbnail?: (uuid: string, channel: MapChannel) => string | null;
}>();

const emit = defineEmits<{
  "select-mesh": [uuid: string];
  "mat:color": [uuid: string, hex: string];
  "mat:roughness": [uuid: string, v: number];
  "mat:metalness": [uuid: string, v: number];
  "mat:opacity": [uuid: string, v: number];
  "mat:emissive": [uuid: string, hex: string];
  "mat:emissiveIntensity": [uuid: string, v: number];
  "mat:normalScale": [uuid: string, v: number];
  "mat:aoIntensity": [uuid: string, v: number];
  "mat:importMap": [uuid: string, channel: MapChannel];
  "mat:clearMap": [uuid: string, channel: MapChannel];
  "mat:selectMat": [uuid: string];
}>();

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const basicItems = computed(() => {
  if (!props.stats) return [];
  const s = props.stats;
  return [
    { label: "文件名", value: s.fileName },
    { label: "顶点数", value: s.vertices.toLocaleString() },
    { label: "三角面", value: s.triangles.toLocaleString() },
  ];
});

const bboxStr = computed(() => {
  if (!props.bbox) return "-";
  return `${props.bbox.x} × ${props.bbox.y} × ${props.bbox.z}`;
});
</script>

<template>
  <div class="model-info">
    <h3 class="panel-title">模型信息</h3>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="!stats" class="empty">导入模型后显示统计信息</div>

    <template v-else>
      <div class="section">
        <div class="section-title">基本信息</div>
        <ul class="info-list">
          <li v-for="item in basicItems" :key="item.label">
            <span class="label">{{ item.label }}</span>
            <span class="value" :title="item.value">{{ item.value }}</span>
          </li>
        </ul>
      </div>

      <div class="section">
        <ul class="info-list">
          <li>
            <span class="label">包围盒</span>
            <span class="value mono">{{ bboxStr }}</span>
          </li>
        </ul>
      </div>

      <MaterialEditor
        :materials="stats.materialList"
        :get-thumbnail="getThumbnail"
        @update:color="(u, v) => emit('mat:color', u, v)"
        @update:roughness="(u, v) => emit('mat:roughness', u, v)"
        @update:metalness="(u, v) => emit('mat:metalness', u, v)"
        @update:opacity="(u, v) => emit('mat:opacity', u, v)"
        @update:emissive="(u, v) => emit('mat:emissive', u, v)"
        @update:emissiveIntensity="(u, v) => emit('mat:emissiveIntensity', u, v)"
        @update:normalScale="(u, v) => emit('mat:normalScale', u, v)"
        @update:aoIntensity="(u, v) => emit('mat:aoIntensity', u, v)"
        @import-map="(u, c) => emit('mat:importMap', u, c)"
        @clear-map="(u, c) => emit('mat:clearMap', u, c)"
        @select-mat="(u) => emit('mat:selectMat', u)"
      />

      <MeshList
        :meshes="stats.meshList"
        @select="(uuid) => emit('select-mesh', uuid)"
      />
    </template>
  </div>
</template>

<style scoped>
.model-info { padding: 16px 18px; flex: 1; overflow-y: auto; }
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}
.empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 30px 0;
  line-height: 1.8;
}
.error {
  color: var(--danger);
  font-size: 12px;
  padding: 10px 12px;
  background: rgba(245, 63, 63, 0.06);
  border: 1px solid rgba(245, 63, 63, 0.15);
  border-radius: 4px;
}
.section { margin-top: 14px; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.info-list { list-style: none; display: flex; flex-direction: column; }
.info-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 13px;
}
.info-list li:last-child { border-bottom: none; }
.label { color: var(--muted); flex-shrink: 0; }
.value {
  color: var(--text);
  font-size: 12.5px;
  font-weight: 500;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.value.mono {
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 12px;
}
</style>
