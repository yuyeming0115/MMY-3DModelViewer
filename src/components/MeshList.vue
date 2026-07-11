<script setup lang="ts">
import { ref } from "vue";
import type { MeshInfo } from "../three/ModelLoader";

const props = defineProps<{
  meshes: MeshInfo[];
}>();

const emit = defineEmits<{
  select: [uuid: string];
}>();

const selectedUuid = ref<string>("");

function selectMesh(uuid: string) {
  if (selectedUuid.value === uuid) {
    selectedUuid.value = "";
    emit("select", "");
  } else {
    selectedUuid.value = uuid;
    emit("select", uuid);
  }
}
</script>

<template>
  <div class="mesh-list">
    <div class="section-title">
      网格列表
      <span class="count" v-if="meshes && meshes.length">({{ meshes.length }})</span>
    </div>
    <div v-if="!meshes || meshes.length === 0" class="placeholder">无网格数据</div>
    <ul v-else class="mesh-items">
      <li
        v-for="(mesh, idx) in meshes"
        :key="mesh.uuid"
        :class="{ active: selectedUuid === mesh.uuid }"
        @click="selectMesh(mesh.uuid)"
      >
        <span class="mesh-idx">{{ idx + 1 }}</span>
        <span class="mesh-name" :title="mesh.name">{{ mesh.name }}</span>
        <span class="mesh-pos">X:{{ mesh.position.x }} Y:{{ mesh.position.y }} Z:{{ mesh.position.z }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mesh-list { padding: 0; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
  margin-top: 14px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.section-title .count {
  color: var(--muted);
  font-weight: 400;
  font-size: 11px;
}
.placeholder {
  color: var(--placeholder);
  font-size: 12px;
  padding: 10px 0;
  text-align: center;
}
.mesh-items {
  list-style: none;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 4px;
}
.mesh-items li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.1s;
}
.mesh-items li:last-child { border-bottom: none; }
.mesh-items li:hover { background: var(--bg); }
.mesh-items li.active {
  background: var(--accent-light);
  color: var(--accent);
}
.mesh-idx {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  background: var(--bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--muted);
  flex-shrink: 0;
}
.mesh-items li.active .mesh-idx {
  background: var(--accent);
  color: #fff;
}
.mesh-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.mesh-items li.active .mesh-name { color: var(--accent); }
.mesh-pos {
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 9px;
  color: var(--muted);
  flex-shrink: 0;
}
</style>
