<script setup lang="ts">
import type { RawNode, Snapshot } from '@/entities/snapshot/types';

import GkSvg from '@/shared/ui/GkSvg.vue';
import GkDraggableCard from '@/shared/ui/GkDraggableCard.vue';
import type { GkDraggableCardValue } from '@/shared/ui/GkDraggableCard.ts';
import { getNodeLabel, getNodeStyle } from '@/entities/snapshot/node';
import { buildEmptyFn } from '@/shared/lib/function';
import { gkdWidth, vw } from './size';
import type { ShallowRef } from 'vue';
import {
  evaluateRuleText,
  getRuleDiagnosticPresentation,
  type RuleDiagnostic,
} from './rule_diagnostics';
import { useSnapshotStore } from './snapshot';

const props = withDefaults(
  defineProps<{
    show: boolean;
    layout?: GkDraggableCardValue;
    onUpdateShow?: (data: boolean) => void;
  }>(),
  {
    onUpdateShow: buildEmptyFn,
  },
);
const emit = defineEmits<{
  updateLayout: [value: GkDraggableCardValue];
}>();

const draggableInitialValue = computed(() => ({
  top: 40,
  right: Math.max(315, 12 * vw.value + 135),
  width: Math.max(480, gkdWidth.value * 0.3),
  ...props.layout,
}));
const updateLayout = (value: GkDraggableCardValue) => {
  emit('updateLayout', value);
};

const snapshotStore = useSnapshotStore();
const { focusNode } = snapshotStore;
const rootNode = snapshotStore.rootNode as ShallowRef<RawNode>;
const snapshot = snapshotStore.snapshot as ShallowRef<Snapshot>;

const ruleText = shallowRef('');
const diagnostic = shallowRef<RuleDiagnostic>({ status: 'empty' });
const diagnosticPresentation = computed(() =>
  getRuleDiagnosticPresentation(diagnostic.value),
);

const refreshDiagnostic = () => {
  diagnostic.value = evaluateRuleText(
    ruleText.value,
    snapshot.value,
    rootNode.value,
  );
};

const updateRuleText = (value: string) => {
  ruleText.value = value;
  refreshDiagnostic();
};
</script>

<template>
  <GkDraggableCard
    v-slot="{ onRef }"
    :initialValue="draggableInitialValue"
    :minWidth="300"
    sizeDraggable
    class="box-shadow-dim"
    :show="show"
    @update:value="updateLayout"
  >
    <div class="app-panel" b-1px b-solid rounded-4px p-8px>
      <div flex items-center gap-8px m-b-4px pr-4px>
        <div>Static rule diagnostic</div>
        <NTag size="small" :type="diagnosticPresentation.type">
          {{ diagnosticPresentation.label }}
        </NTag>
        <div :ref="onRef" flex-1 cursor-move />
        <NButton
          text
          title="Re-diagnose"
          :disabled="!ruleText"
          @click="refreshDiagnostic"
        >
          <template #icon>
            <GkSvg name="refresh" />
          </template>
        </NButton>
        <NButton text title="Minimize" @click="onUpdateShow(!show)">
          <template #icon>
            <GkSvg name="minus" />
          </template>
        </NButton>
      </div>

      <NInput
        :value="ruleText"
        type="textarea"
        placeholder="Paste a single rule, rule group, app config, or the apps array from a subscription"
        size="small"
        class="gkd_code m-b-8px"
        :autosize="{ minRows: 10, maxRows: 20 }"
        @update:value="updateRuleText"
      />

      <div v-if="diagnostic.status != 'empty'" min-h-24px>
        <NAlert
          v-if="diagnostic.status == 'invalid'"
          type="error"
          :showIcon="false"
        >
          {{ diagnostic.message }}
        </NAlert>

        <template v-else>
          <div flex items-center gap-8px flex-wrap>
            <span>{{ diagnostic.message }}</span>
            <NButton
              v-if="diagnostic.status == 'matched'"
              size="small"
              :style="getNodeStyle(diagnostic.targetNode, focusNode)"
              @click="snapshotStore.updateFocusNode(diagnostic.targetNode)"
            >
              {{ getNodeLabel(diagnostic.targetNode) }}
            </NButton>
          </div>

          <div m-t-6px text-12px color-gray-500>
            <span v-if="diagnostic.details.rulePath">
              Rule location: {{ diagnostic.details.rulePath }};
            </span>
            <span>
              {{ diagnostic.details.matchedSelectors.length }} matched
              condition(s), {{ diagnostic.details.rejectedSelectors.length }}
              unmatched condition(s)
            </span>
          </div>

          <NAlert
            v-if="diagnostic.notes.length"
            type="warning"
            :showIcon="false"
            class="m-t-8px"
          >
            <div>
              The following conditions can't be fully verified from a single
              snapshot:
            </div>
            <div v-for="note in diagnostic.notes" :key="note">· {{ note }}</div>
          </NAlert>
        </template>
      </div>

      <div v-else text-12px color-gray-500>
        Only verifies the selector, screen scope, and exclusion conditions
        against the current snapshot — rule execution timing is not simulated.
      </div>
    </div>
  </GkDraggableCard>
</template>
