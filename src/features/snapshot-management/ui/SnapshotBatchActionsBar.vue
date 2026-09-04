<script setup lang="tsx">
import type { TaskLike } from '@/shared/lib/task';

defineProps<{
  checkedCount: number;
  batchDelete: TaskLike;
  batchDownloadImage?: TaskLike;
  batchDownloadZip?: TaskLike;
  batchShareImageUrl?: TaskLike;
  batchShareZipUrl?: TaskLike;
}>();
</script>
<template>
  <div v-if="checkedCount" flex items-center gap-12px>
    <NPopover v-if="batchDownloadZip || batchDownloadImage">
      <template #trigger>
        <NButton> Batch download </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="batchDownloadZip"
          :loading="batchDownloadZip.loading"
          @click="batchDownloadZip.invoke"
        >
          Batch download - Snapshots
        </NButton>
        <NButton
          v-if="batchDownloadImage"
          :loading="batchDownloadImage.loading"
          @click="batchDownloadImage.invoke"
        >
          Batch download - Images
        </NButton>
      </NSpace>
    </NPopover>
    <NPopover v-if="batchShareZipUrl || batchShareImageUrl">
      <template #trigger>
        <NButton> Batch share </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="batchShareZipUrl"
          :loading="batchShareZipUrl.loading"
          @click="batchShareZipUrl.invoke"
        >
          Batch generate links - Snapshots
        </NButton>
        <NButton
          v-if="batchShareImageUrl"
          :loading="batchShareImageUrl.loading"
          @click="batchShareImageUrl.invoke"
        >
          Batch generate links - Images
        </NButton>
      </NSpace>
    </NPopover>
    <NButton
      :loading="batchDelete.loading"
      :theme-overrides="{ color: '#D03050', textColor: 'white' }"
      @click="batchDelete.invoke"
    >
      Batch delete
    </NButton>
    <span whitespace-nowrap>{{ `${checkedCount} snapshot(s) selected` }}</span>
  </div>
</template>
