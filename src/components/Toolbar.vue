<script setup lang="ts">
defineProps<{
  hasModel: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  import: [];
  screenshot: [];
}>();
</script>

<template>
  <header class="toolbar">
    <div class="toolbar-center">
      <button class="btn" @click="emit('import')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-2px">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        换模型
      </button>
      <button class="btn primary" :disabled="!hasModel" @click="emit('screenshot')">导出模型</button>
      <span class="divider"></span>
      <button class="btn" :disabled="!hasModel">导出贴图</button>
      <select :disabled="!hasModel">
        <option>PNG</option>
        <option>JPG</option>
        <option>WebP</option>
      </select>
      <button class="btn" :disabled="!hasModel">导出贴图</button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  height: 52px;
  flex-shrink: 0;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
}
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}
.divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}
.btn {
  padding: 7px 16px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg2);
  color: var(--text);
  font-size: 13px;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #fff;
}
select {
  font-family: inherit;
  font-size: 13px;
  padding: 6px 28px 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386909c' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 8px center;
  color: var(--text);
  outline: none;
  appearance: none;
  cursor: pointer;
}
select:hover:not(:disabled) {
  border-color: var(--accent);
}
select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
