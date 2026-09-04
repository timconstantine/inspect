<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import { message } from '@/shared/services/feedback';
import { DELETE_TIMEOUT, withTimeout } from '@/shared/lib/async';
import {
  screenshotStorage,
  setSnapshot,
  snapshotStorage,
} from '@/entities/snapshot/storage';
import dayjs from 'dayjs';
import MiniHoverImg from './MiniHoverImg.vue';
import PrivacyRedactionDialog from './PrivacyRedactionDialog.vue';
import {
  createRedactedSnapshotCopy,
  getAvailableSnapshotId,
  renderRedactedScreenshot,
  scaleRedactionRectangles,
  type RedactionSelection,
} from './privacy_redaction';
import { useSharedSnapshotHoverImg, useSnapshotStore } from './snapshot';

const props = defineProps<{
  redactionShow: boolean;
}>();

const emit = defineEmits<{
  'update:redactionShow': [show: boolean];
}>();

const { screenshotUrl, snapshot } = useSnapshotStore();
const router = useRouter();
const { clickImg, imgHover, imgMove, imgLoadTime, positionStyle, imgRef } =
  useSharedSnapshotHoverImg();

const redactionSaving = shallowRef(false);
const deletingSourceSnapshot = shallowRef(false);
const createdSnapshotResult = shallowRef<{
  snapshotId: number;
  sourceSnapshotId: number;
}>();
const createdSnapshotId = computed(
  () => createdSnapshotResult.value?.snapshotId,
);
const createdSnapshotPath = computed(() => {
  if (!createdSnapshotId.value) return '';
  return router.resolve({
    name: 'snapshot',
    params: { snapshotId: createdSnapshotId.value },
  }).href;
});
const createdSnapshotHref = computed(() => {
  if (!createdSnapshotPath.value) return '';
  return new URL(createdSnapshotPath.value, window.location.href).href;
});

const setRedactionVisible = (visible: boolean) => {
  emit('update:redactionShow', visible);
};

const showCreatedSnapshotResult = (
  sourceSnapshotId: number,
  snapshotId: number,
) => {
  createdSnapshotResult.value = { snapshotId, sourceSnapshotId };
};

const closeCreatedSnapshotResult = () => {
  createdSnapshotResult.value = undefined;
};

const updateCreatedSnapshotResult = (visible: boolean) => {
  if (!visible && !deletingSourceSnapshot.value) closeCreatedSnapshotResult();
};

const openCreatedSnapshot = async () => {
  const path = createdSnapshotPath.value;
  if (!path || deletingSourceSnapshot.value) return;
  closeCreatedSnapshotResult();
  await router.push(path);
};

const handleCreatedSnapshotLinkClick = (event: MouseEvent) => {
  if (deletingSourceSnapshot.value) {
    event.preventDefault();
    return;
  }
  closeCreatedSnapshotResult();
};

const deleteSourceSnapshotAndOpen = async () => {
  const result = createdSnapshotResult.value;
  const path = createdSnapshotPath.value;
  if (!result || !path || deletingSourceSnapshot.value) return;
  deletingSourceSnapshot.value = true;
  let deleted = false;
  try {
    await withTimeout(
      () => snapshotStorage.removeItem(result.sourceSnapshotId),
      DELETE_TIMEOUT,
      'Local delete timed out',
    );
    deleted = true;
    await router.push(path);
    closeCreatedSnapshotResult();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    message.error(
      deleted
        ? `Original snapshot deleted, but failed to open the redacted copy: ${detail}`
        : `Failed to delete the original snapshot: ${detail}`,
    );
  } finally {
    deletingSourceSnapshot.value = false;
  }
};

const createRedactedCopy = async (selection: RedactionSelection) => {
  const currentSnapshot = snapshot.value;
  if (!currentSnapshot || redactionSaving.value) return;
  redactionSaving.value = true;
  try {
    const sourceScreenshot = await screenshotStorage.getItem(
      currentSnapshot.id,
    );
    if (!sourceScreenshot) throw new Error(`Original screenshot doesn't exist`);
    const newId = await getAvailableSnapshotId(
      Math.max(Date.now(), currentSnapshot.id + 1),
      (id) => snapshotStorage.hasItem(id),
    );
    const nodeRectangles = scaleRedactionRectangles(
      selection.rectangles,
      currentSnapshot.screenWidth / selection.imageWidth,
      currentSnapshot.screenHeight / selection.imageHeight,
    );
    const redactedScreenshot = await renderRedactedScreenshot(
      sourceScreenshot,
      selection.rectangles,
    );
    const redactedSnapshot = createRedactedSnapshotCopy(
      currentSnapshot,
      newId,
      nodeRectangles,
    );
    await setSnapshot(redactedSnapshot, redactedScreenshot);
    setRedactionVisible(false);
    showCreatedSnapshotResult(currentSnapshot.id, newId);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    redactionSaving.value = false;
  }
};
</script>

<template>
  <div
    v-if="snapshot && screenshotUrl"
    flex
    flex-col
    relative
    h-full
    p-2px
    overflow-hidden
  >
    <img
      ref="imgRef"
      :src="screenshotUrl"
      cursor-crosshair
      object-contain
      h-full
      class="max-w-[calc(var(--gkd-w)*0.35)]"
      @click="clickImg"
      @mouseover="imgHover = true"
      @mouseleave="imgHover = false"
      @mousemove="imgMove"
      @load="imgLoadTime = true"
    />
    <div pointer-events-none absolute left-2px top-2px size="[calc(100%-4px)]">
      <div
        :style="positionStyle"
        absolute
        transition-all-300
        b-1px
        b-blue
        b-solid
      >
        <div absolute left-0 top-0 bottom-0 right-0 b-solid b-1px b-red />
      </div>
    </div>
    <div
      absolute
      z-4
      pointer-events-none
      left-4px
      top-4px
      text-12px
      leading="100%"
      flex
      gap-4px
    >
      <div py-1px px-2px bg="#ffffff90" title="Size">
        {{ `${snapshot.screenWidth}x${snapshot.screenHeight}` }}
      </div>
      <div py-1px px-2px bg="#ffffff90" title="Created">
        {{ dayjs(snapshot.id).format('YYYY-MM-DD HH:mm:ss') }}
      </div>
    </div>
    <MiniHoverImg v-if="imgRef" />
    <PrivacyRedactionDialog
      :show="props.redactionShow"
      :sourceUrl="screenshotUrl"
      :imageWidth="snapshot.screenWidth"
      :imageHeight="snapshot.screenHeight"
      @update:show="setRedactionVisible"
      @apply="createRedactedCopy"
    />
    <NModal
      :show="createdSnapshotId != null"
      preset="card"
      title="Copy created"
      class="w-520px max-w-[calc(100vw-48px)]"
      :closable="!deletingSourceSnapshot"
      :closeOnEsc="!deletingSourceSnapshot"
      :maskClosable="!deletingSourceSnapshot"
      @update:show="updateCreatedSnapshotResult"
    >
      <div class="flex flex-col gap-12px">
        <div>
          Redacted copy created; the original snapshot was not modified.
        </div>
        <div class="text-13px text-[#64748b]">New snapshot link</div>
        <RouterLink
          v-if="createdSnapshotPath"
          :to="createdSnapshotPath"
          aria-label="Open the created snapshot"
          class="break-all text-[#2080f0] no-underline hover:underline"
          :class="{
            'pointer-events-none opacity-50': deletingSourceSnapshot,
          }"
          :aria-disabled="deletingSourceSnapshot"
          :tabindex="deletingSourceSnapshot ? -1 : undefined"
          @click="handleCreatedSnapshotLinkClick"
        >
          {{ createdSnapshotHref }}
        </RouterLink>
      </div>
      <template #footer>
        <div class="flex justify-end gap-8px">
          <NPopconfirm
            :positiveButtonProps="{
              type: 'error',
              loading: deletingSourceSnapshot,
            }"
            @positiveClick="deleteSourceSnapshotAndOpen"
          >
            <template #icon>
              <GkSvg name="warn" color="#d03050" />
            </template>
            <div>
              Delete the current original snapshot and open the redacted copy?
            </div>
            <div class="mt-4px text-12px text-[#64748b]">
              Only deletes the local snapshot; this cannot be undone.
            </div>
            <template #trigger>
              <NButton
                secondary
                type="error"
                :disabled="deletingSourceSnapshot"
              >
                Delete original snapshot
              </NButton>
            </template>
          </NPopconfirm>
          <NButton
            type="primary"
            :disabled="deletingSourceSnapshot"
            @click="openCreatedSnapshot"
          >
            Open snapshot
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
