<script setup lang="ts">
import { settingsActions, settingsStore } from './store';
import { useTheme } from '@/features/settings/useTheme';

defineProps<{ show: boolean }>();

const emit = defineEmits<{
  'update:show': [show: boolean];
}>();

const { setThemeMode, themeMode } = useTheme();
const themeOptions = [
  { label: 'Follow system', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];
const closeSettings = () => emit('update:show', false);
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    title="Settings"
    :maskClosable="false"
    :showIcon="false"
    positiveText="Close"
    style="width: 600px"
    @positiveClick="closeSettings"
    @close="closeSettings"
    @esc="closeSettings"
    @update:show="emit('update:show', $event)"
  >
    <div flex items-center justify-between gap-24px>
      <span>Appearance theme</span>
      <NSelect
        :value="themeMode"
        :options="themeOptions"
        class="w-140px shrink-0"
        @update:value="setThemeMode"
      />
    </div>
    <div class="app-divider" />
    <div flex items-center justify-between gap-24px>
      <span>Disable the "generate share link" popup reminder</span>
      <NSwitch
        :value="settingsStore.ignoreUploadWarn"
        aria-label="Disable the generate share link popup reminder"
        class="shrink-0"
        @update:value="settingsActions.update({ ignoreUploadWarn: $event })"
      />
    </div>
    <div class="app-divider" />
    <div flex items-center justify-between gap-24px>
      <span
        >Auto-generate a share link when opening a snapshot page (make sure it
        contains no private info)</span
      >
      <NSwitch
        :value="settingsStore.autoUploadImport"
        aria-label="Auto-generate a share link when opening a snapshot page"
        class="shrink-0"
        @update:value="settingsActions.update({ autoUploadImport: $event })"
      />
    </div>
  </NModal>
</template>
