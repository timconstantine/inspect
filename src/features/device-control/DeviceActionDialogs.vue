<script setup lang="ts">
import { message } from '@/shared/services/feedback';
import { errorWrap } from '@/shared/services/error';
import { useTask } from '@/shared/lib/task';
import JSON5 from 'json5';
import type { DeviceApi } from './api';
import SelectorLibraryDialog from '@/features/selector-library/ui/SelectorLibraryDialog.vue';

const props = defineProps<{
  api: DeviceApi;
  selectorShow: boolean;
  subscriptionShow: boolean;
}>();

const emit = defineEmits<{
  'update:selectorShow': [show: boolean];
  'update:subscriptionShow': [show: boolean];
}>();

const subscriptionText = shallowRef(``);
const clickAction = shallowReactive({
  selector: ``,
  action: 'click',
  quickFind: false,
});
const updateSubscriptionText = (value: string) => {
  subscriptionText.value = value;
};
const updateSelector = (value: string) => {
  clickAction.selector = value;
};
const updateQuickFind = (value: boolean) => {
  clickAction.quickFind = value;
};
const updateAction = (value: string) => {
  clickAction.action = value;
};
const selectorLibraryShow = shallowRef(false);
const openSelectorLibrary = () => {
  selectorLibraryShow.value = true;
};
const setSelectorLibraryVisible = (show: boolean) => {
  selectorLibraryShow.value = show;
};
const useLibrarySelector = (selector: string) => {
  updateSelector(selector);
};

const actionOptions: { value?: string; label: string }[] = [
  { label: 'Query only', value: `` },
  { value: 'click', label: 'click' },
  { value: 'clickNode', label: 'clickNode' },
  { value: 'clickCenter', label: 'clickCenter' },
  { value: 'back', label: 'back' },
  { value: 'longClick', label: 'longClick' },
  { value: 'longClickNode', label: 'longClickNode' },
  { value: 'longClickCenter', label: 'longClickCenter' },
];

const updateSubscription = useTask(async () => {
  const data = errorWrap(() => JSON5.parse(subscriptionText.value.trim()));
  if (!data) return;
  if (data.categories || data.globalGroups || data.apps) {
    await props.api.updateSubscription(data);
  } else if (typeof data.id == 'string') {
    await props.api.updateSubscription({ apps: [data] });
  } else if (Array.isArray(data) && typeof data[0].id == 'string') {
    await props.api.updateSubscription({ apps: data });
  } else if (typeof data.key == 'number') {
    await props.api.updateSubscription({ globalGroups: [data] });
  } else if (Array.isArray(data) && typeof data[0].key == 'number') {
    await props.api.updateSubscription({ globalGroups: data });
  } else {
    message.error(`Unrecognized subscription text`);
    return;
  }
  message.success(`Updated successfully`);
});

const executeSelector = useTask(async () => {
  const result = await props.api.execSelector({
    ...clickAction,
    fastQuery: clickAction.quickFind,
  });
  if (result.message) {
    message.success(`Action succeeded: ` + result.message);
    return;
  }
  if (result.action) {
    message.success(
      (result.result ? `Action succeeded: ` : `Action failed: `) +
        result.action,
    );
  } else if (result.result) {
    message.success(`Query succeeded`);
  }
});

const subscriptionPlaceholder = `
Enter subscription text (JSON5 syntax):
Example 1 - update rules for a single app:
{
  id: 'appId',
  groups: []
}

Example 2 - update rules for multiple apps:
[
  {
    id: 'appId1',
    groups: []
  },
  {
    id: 'appId2',
    groups: []
  }
]

Example 3 - update a global rule (1.7.0):
{
  name: 'Global rule 1',
  key: 0,
  rules: []
}

Example 3 - update multiple global rules (1.7.0):
[
  {
    name: 'Global rule 1',
    key: 0,
    rules: []
  },
  {
    name: 'Global rule 2',
    key: 1,
    rules: []
  }
]

Example 4 - update the entire subscription (1.7.0):
{
  apps: [],
  globalGroups: [],
  categories: [],
}
`.trim();
</script>

<template>
  <NModal
    :show="subscriptionShow"
    preset="dialog"
    style="width: 800px"
    title="Edit in-memory subscription"
    :maskClosable="false"
    positiveText="Confirm"
    :positiveButtonProps="{
      loading: updateSubscription.loading,
      onClick: updateSubscription.invoke,
    }"
    @update:show="emit('update:subscriptionShow', $event)"
  >
    <NInput
      :value="subscriptionText"
      :disabled="updateSubscription.loading"
      type="textarea"
      class="gkd_code"
      :autosize="{ minRows: 20, maxRows: 25 }"
      :placeholder="subscriptionPlaceholder"
      @update:value="updateSubscriptionText"
    />
  </NModal>

  <NModal
    :show="selectorShow"
    preset="dialog"
    style="width: 800px"
    title="Execute selector"
    :maskClosable="false"
    positiveText="Confirm"
    :positiveButtonProps="{
      loading: executeSelector.loading,
      onClick: executeSelector.invoke,
    }"
    @update:show="emit('update:selectorShow', $event)"
  >
    <NInput
      :value="clickAction.selector"
      :disabled="executeSelector.loading"
      type="textarea"
      class="gkd_code"
      :autosize="{ minRows: 4, maxRows: 10 }"
      placeholder="Enter a valid selector"
      @update:value="updateSelector"
    />
    <div class="mt-8px flex justify-end">
      <NButton secondary @click="openSelectorLibrary">Selector library</NButton>
    </div>
    <div h-15px />
    <NSpace>
      <NCheckbox
        :checked="clickAction.quickFind"
        @update:checked="updateQuickFind"
      >
        Fast query
      </NCheckbox>
      <a
        href="https://gkd.li/api/interfaces/RawCommonProps.html#quickfind"
        target="_blank"
        rel="noopener noreferrer"
      >
        Query docs
      </a>
    </NSpace>
    <div h-10px />
    <div flex gap-10px flex-items-center>
      <NSelect
        :value="clickAction.action"
        :options="actionOptions"
        class="w-150px"
        @update:value="updateAction"
      />
      <a
        href="https://gkd.li/api/interfaces/RawRuleProps#action"
        target="_blank"
        rel="noopener noreferrer"
      >
        Action docs
      </a>
    </div>
  </NModal>
  <SelectorLibraryDialog
    :show="selectorLibraryShow"
    @use="useLibrarySelector"
    @update:show="setSelectorLibraryVisible"
  />
</template>
