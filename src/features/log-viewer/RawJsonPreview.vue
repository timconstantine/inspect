<script setup lang="ts">
import { formatJsonForPreview } from './json_preview';
import TextViewer from './text_viewer/TextViewer.vue';

const props = defineProps<{
  value: unknown;
  raw: string;
}>();

const formattedText = computed(() =>
  formatJsonForPreview(props.value, props.raw),
);
</script>

<template>
  <div name="raw-json-preview" class="h-full">
    <TextViewer
      :value="formattedText"
      search-placeholder="Search raw JSON"
      class="h-full"
    />
  </div>
</template>
