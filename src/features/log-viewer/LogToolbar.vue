<script setup lang="ts">
import type { LogVersionInfo } from './source_links';
import PageBackButton from '@/features/navigation/PageBackButton.vue';

defineProps<{
  archiveLoading: boolean;
  inputUrl: string;
  logVersionInfo?: LogVersionInfo;
}>();

const emit = defineEmits<{
  files: [files: File[]];
  submit: [];
  'update:inputUrl': [value: string];
}>();

const localFileInput = shallowRef<HTMLInputElement>();
const openLocalFile = () => localFileInput.value?.click();
const handleLocalFile = () => {
  const input = localFileInput.value;
  if (!input) return;
  const files = [...(input.files || [])];
  input.value = ``;
  emit('files', files);
};

defineExpose({ openLocalFile });
</script>

<template>
  <div name="log-toolbar" class="h-42px flex items-center gap-10px">
    <PageBackButton />
    <div name="log-title" class="flex-none text-18px font-600">
      Log Archive Viewer
    </div>
    <a
      v-if="logVersionInfo"
      :href="logVersionInfo.commitUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="flex-none text-14px text-[#2563eb] hover:underline"
    >
      {{ logVersionInfo.versionName }} ({{ logVersionInfo.versionCode }})
    </a>
    <NInputGroup class="ml-auto min-w-420px max-w-720px">
      <NInput
        :value="inputUrl"
        clearable
        placeholder="Paste a GitHub, f.gkd.li, or other ZIP link"
        @update:value="emit('update:inputUrl', $event)"
        @keyup.enter="emit('submit')"
      />
      <NButton type="primary" :loading="archiveLoading" @click="emit('submit')">
        Load link
      </NButton>
    </NInputGroup>
    <NButton :disabled="archiveLoading" @click="openLocalFile">
      Choose local ZIP
    </NButton>
    <input
      ref="localFileInput"
      hidden
      type="file"
      accept=".zip,application/zip"
      @change="handleLocalFile"
    />
  </div>
</template>
