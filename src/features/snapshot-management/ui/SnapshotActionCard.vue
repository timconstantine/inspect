<script setup lang="tsx">
import type { Snapshot } from '@/entities/snapshot/types';

import GkSvg from '@/shared/ui/GkSvg.vue';
import {
  showTextDLg,
  waitShareAgree,
} from '@/features/snapshot-management/dialog';
import { message } from '@/shared/services/feedback';
import {
  exportSnapshotAsImportId,
  exportSnapshotAsImage,
  exportSnapshotAsImageId,
  exportSnapshotAsZip,
} from '@/features/snapshot-management/export';
import { DELETE_TIMEOUT, delay, withTimeout } from '@/shared/lib/async';
import { buildEmptyFn } from '@/shared/lib/function';
import { snapshotStorage } from '@/entities/snapshot/storage';
import { useTask } from '@/shared/lib/task';
import { getImportUrl, getImagUrl } from '@/entities/snapshot/urls';
import { useSnapshotMetadataStore } from '@/entities/snapshot/metadataStore';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    onDelete?: () => void;
    onBeforeDelete?: (snapshot: Snapshot) => Promise<unknown>;
    onPreview?: () => void;
    previewLoading?: boolean;
    showPreview?: boolean;
    showExport?: boolean;
    showDelete?: boolean;
    showShare?: boolean;
    deleteConfirmText?: string;
  }>(),
  {
    showPreview: true,
    showExport: true,
    showDelete: true,
    showShare: true,
    onDelete: buildEmptyFn,
    onBeforeDelete: undefined,
    onPreview: undefined,
    previewLoading: false,
    deleteConfirmText: 'Delete this snapshot?',
  },
);

const router = useRouter();
const { snapshotImportId, snapshotImageId } = useSnapshotMetadataStore();

// 1. Basic download tasks
const exportJpg = useTask(async () => exportSnapshotAsImage(props.snapshot));
const exportZip = useTask(async () => exportSnapshotAsZip(props.snapshot));

// 2. Get the cached import/image URL (empty string if none)
const snapshotImportUrl = computed(() => {
  const id = snapshotImportId[props.snapshot.id];
  return id ? getImportUrl(id) : '';
});

const snapshotImageUrl = computed(() => {
  const id = snapshotImageId[props.snapshot.id];
  return id ? getImagUrl(id) : '';
});

// 3. Preview navigation URL (reuses the shared getImportUrl logic)
const previewUrl = computed(() => {
  const id = snapshotImportId[props.snapshot.id];
  if (id) return getImportUrl(id); // reuse the shared URL generation utility

  return router.resolve({
    name: 'snapshot',
    params: { snapshotId: props.snapshot.id },
  }).href;
});

// 4. Generate remotely and show the link
const exportJpgUrl = useTask(async () => {
  await waitShareAgree();
  const imageId = await exportSnapshotAsImageId(props.snapshot);
  showTextDLg({ title: `Share link`, content: getImagUrl(imageId) });
});

const exportZipUrl = useTask(async () => {
  await waitShareAgree();
  const importId = await exportSnapshotAsImportId(props.snapshot);
  showTextDLg({ title: `Share link`, content: getImportUrl(importId) }); // fixed the duplicated hand-rolled path-concatenation logic
});

// 5. Delete logic
const deleteSnapshot = useTask(async () => {
  // remote
  if (props.onBeforeDelete) {
    try {
      await props.onBeforeDelete!(props.snapshot);
    } catch {
      // src\utils\api.ts already shows a notice
      return;
    }
  }
  // local
  try {
    await withTimeout(
      () => snapshotStorage.removeItem(props.snapshot.id),
      DELETE_TIMEOUT,
      `Local delete timed out`,
    );
  } catch (e: any) {
    message.error(`Local delete failed: ${e?.message}`);
    return;
  }
  await delay(500);
  props.onDelete();
});

// 6. Copy link logic
const copy = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    message.success(`Copied`);
  } catch {
    message.error(`Copy failed`); // fixed the incorrect icon display
  }
};
</script>

<template>
  <div flex gap-16px items-center>
    <template v-if="showPreview">
      <a v-if="!onPreview" flex target="_blank" :href="previewUrl">
        <NButton text title="View">
          <template #icon><GkSvg name="code" /></template>
        </NButton>
      </a>
      <NButton
        v-else
        text
        title="View"
        :loading="previewLoading"
        @click="onPreview"
      >
        <template #icon><GkSvg name="code" /></template>
      </NButton>
    </template>

    <NPopover v-if="showExport">
      <template #trigger>
        <NButton text>
          <template #icon><GkSvg name="export" color="#2080F0" /></template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton :loading="exportZip.loading" @click="exportZip.invoke"
          >Download - Snapshot</NButton
        >
        <NButton :loading="exportJpg.loading" @click="exportJpg.invoke"
          >Download - Image</NButton
        >
      </NSpace>
    </NPopover>

    <NPopover v-if="showShare">
      <template #trigger>
        <NButton text>
          <template #icon><GkSvg name="share" color="#8A2BE2" /></template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton v-if="snapshotImportUrl" @click="copy(snapshotImportUrl)"
          >Copy link - Snapshot</NButton
        >
        <NButton
          v-else
          :loading="exportZipUrl.loading"
          @click="exportZipUrl.invoke"
          >Generate link - Snapshot</NButton
        >

        <NButton v-if="snapshotImageUrl" @click="copy(snapshotImageUrl)"
          >Copy link - Image</NButton
        >
        <NButton
          v-else
          :loading="exportJpgUrl.loading"
          @click="exportJpgUrl.invoke"
          >Generate link - Image</NButton
        >
      </NSpace>
    </NPopover>

    <NPopconfirm
      v-if="showDelete"
      :positive-button-props="{
        type: 'error',
        loading: deleteSnapshot.loading,
      }"
      @positiveClick="deleteSnapshot.invoke"
    >
      <template #icon><GkSvg name="warn" color="red" /></template>
      <span style="color: #d03050; white-space: pre-line">{{
        deleteConfirmText
      }}</span>
      <template #trigger>
        <NTooltip
          :theme-overrides="{
            color: '#D03050', // bubble background color
            textColor: 'white', // text color
          }"
        >
          <template #trigger>
            <NButton text>
              <template #icon><GkSvg name="delete" color="#D03050" /></template>
            </NButton>
          </template>
          Delete snapshot
        </NTooltip>
      </template>
    </NPopconfirm>
  </div>
</template>
