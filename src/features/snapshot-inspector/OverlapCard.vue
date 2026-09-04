<script setup lang="ts">
import GkDraggableCard from '@/shared/ui/GkDraggableCard.vue';
import type { GkDraggableCardValue } from '@/shared/ui/GkDraggableCard.ts';
import { getNodeLabel, getNodeStyle } from '@/entities/snapshot/node';
import { useSnapshotStore } from './snapshot';

const {
  focusNode,
  overlapNodes,
  focusPosition,
  updateFocusNode,
  closeOverlap,
} = useSnapshotStore();
const props = defineProps<{
  layout?: GkDraggableCardValue;
}>();
const emit = defineEmits<{
  updateLayout: [value: GkDraggableCardValue];
}>();
const _1vw = document.documentElement.scrollWidth / 100;
const left = _1vw * 25.5;
const draggableInitialValue = computed(() => ({
  top: 215,
  left,
  ...props.layout,
}));
const updateLayout = (value: GkDraggableCardValue) => {
  emit('updateLayout', value);
};
</script>
<template>
  <GkDraggableCard
    v-slot="{ onRef }"
    :initialValue="draggableInitialValue"
    class="box-shadow-dim w-420px"
    :show="Boolean(overlapNodes && focusPosition)"
    @update:value="updateLayout"
  >
    <NCard
      v-if="overlapNodes && focusPosition"
      size="small"
      closable
      @close="closeOverlap"
    >
      <template #header>
        <div :ref="onRef" cursor-move>
          Position
          <span class="app-subtle" px-2px>{{
            `${focusPosition.x.toFixed(0)},${focusPosition.y.toFixed(0)}`
          }}</span>
          has {{ overlapNodes.length }} overlapping node(s)
        </div>
      </template>
      <NSpace
        style="max-height: 400px; overflow-y: scroll; padding-bottom: 10px"
        class="scrollbar-hidden"
      >
        <NButton
          v-for="resultNode in overlapNodes"
          :key="resultNode.id"
          size="small"
          :style="getNodeStyle(resultNode, focusNode)"
          @click="updateFocusNode(resultNode)"
        >
          {{ getNodeLabel(resultNode) }}
        </NButton>
      </NSpace>
    </NCard>
  </GkDraggableCard>
</template>
