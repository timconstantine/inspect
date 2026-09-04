<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import SelectorSyntaxInput from '@/entities/selector/ui/SelectorSyntaxInput.vue';
import SelectorText from '@/entities/selector/ui/SelectorText.vue';
import {
  collectSelectorPresetTags,
  filterSelectorPresets,
  getSelectorPresetScopeLabel,
  inferSelectorPresetScope,
  serializeSelectorLibrary,
  type SelectorPreset,
  type SelectorPresetInput,
  type SelectorPresetScope,
} from '@/features/selector-library/library';
import {
  selectorLibrary,
  selectorLibraryActions,
} from '@/features/selector-library/store';
import { message } from '@/shared/services/feedback';
import { copy } from '@/shared/lib/clipboard';
import { saveAs } from 'file-saver';
import * as base64url from 'universal-base64url';
import PageBackButton from '@/features/navigation/PageBackButton.vue';

type ScopeFilter = 'all' | SelectorPresetScope;

const query = shallowRef('');
const scopeFilter = shallowRef<ScopeFilter>('all');
const localFileInput = shallowRef<HTMLInputElement>();
const createInitialForm = () => ({
  id: undefined as string | undefined,
  updatedAt: undefined as number | undefined,
  name: '',
  selector: '',
  description: '',
  tags: [] as string[],
  appId: '',
  activityId: '',
});
const form = shallowReactive(createInitialForm());
const savePending = shallowRef(false);
const importPending = shallowRef(false);
let editorRevision = 0;

const scopeFilterOptions = [
  { label: 'All scopes', value: 'all' },
  { label: 'Global', value: 'global' },
  { label: 'All activities in app', value: 'app' },
  { label: 'Specific activity', value: 'activity' },
];
const visibleItems = computed(() =>
  filterSelectorPresets(selectorLibrary.items, query.value).filter(
    (item) => scopeFilter.value == 'all' || item.scope == scopeFilter.value,
  ),
);
const tagOptions = computed(() =>
  collectSelectorPresetTags(selectorLibrary.items).map((tag) => ({
    label: tag,
    value: tag,
  })),
);
const editorTitle = computed(() =>
  form.id ? 'Edit selector' : 'New selector',
);

const getTestRoute = (selector: string) => ({
  path: '/selector',
  query: { gkd: base64url.encode(selector) },
});
const updateQuery = (value: string) => {
  query.value = value;
};
const updateScopeFilter = (value: ScopeFilter) => {
  scopeFilter.value = value;
};
const updateName = (value: string) => {
  form.name = value;
  editorRevision += 1;
};
const updateSelector = (value: string) => {
  form.selector = value;
  editorRevision += 1;
};
const updateDescription = (value: string) => {
  form.description = value;
  editorRevision += 1;
};
const updateTags = (value: string[]) => {
  form.tags = [
    ...new Set(value.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  ];
  editorRevision += 1;
};
const updateAppId = (value: string) => {
  form.appId = value;
  if (!value.trim()) form.activityId = '';
  editorRevision += 1;
};
const updateActivityId = (value: string) => {
  form.activityId = value;
  editorRevision += 1;
};
const resetEditor = () => {
  Object.assign(form, createInitialForm());
  editorRevision += 1;
};
const editPreset = (preset: SelectorPreset) => {
  form.id = preset.id;
  form.updatedAt = preset.updatedAt;
  form.name = preset.name;
  form.selector = preset.selector;
  form.description = preset.description;
  form.tags = [...preset.tags];
  form.appId = preset.appId || '';
  form.activityId = preset.activityId || '';
  editorRevision += 1;
};
const getFormInput = (): SelectorPresetInput => ({
  name: form.name,
  selector: form.selector,
  description: form.description,
  tags: form.tags,
  scope: inferSelectorPresetScope(form.appId, form.activityId),
  appId: form.appId,
  activityId: form.activityId,
});
const savePreset = async () => {
  if (savePending.value) return;
  const revision = editorRevision;
  const id = form.id;
  const updatedAt = form.updatedAt;
  const input = getFormInput();
  savePending.value = true;
  try {
    const editing = Boolean(id);
    const saved = id
      ? await selectorLibraryActions.update(id, input, updatedAt)
      : await selectorLibraryActions.save(input);
    message.success(editing ? 'Selector updated' : 'Selector saved');
    if (revision == editorRevision) {
      resetEditor();
    } else if (saved && form.id == id) {
      form.updatedAt = saved.updatedAt;
    } else if (
      saved &&
      !id &&
      !form.id &&
      form.selector.trim() == input.selector.trim()
    ) {
      form.id = saved.id;
      form.updatedAt = saved.updatedAt;
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    savePending.value = false;
  }
};
const removePreset = async (id: string) => {
  try {
    await selectorLibraryActions.remove(id);
    if (form.id == id) resetEditor();
    message.success('Selector deleted');
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
};
const copySelector = (selector: string) => {
  void copy(selector);
};
const exportLibrary = () => {
  const content = JSON.stringify(
    serializeSelectorLibrary(selectorLibrary.items),
    undefined,
    2,
  );
  saveAs(
    new Blob([content], { type: 'application/json;charset=utf-8' }),
    'gkd-selector-library.json',
  );
};
const openImportFile = () => {
  localFileInput.value?.click();
};
const importLibrary = async () => {
  if (importPending.value) return;
  const input = localFileInput.value;
  const file = input?.files?.[0];
  if (!input || !file) return;
  input.value = '';
  importPending.value = true;
  try {
    const count = await selectorLibraryActions.importItems(
      JSON.parse(await file.text()),
    );
    message.success(`Imported ${count} selector(s)`);
  } catch (error) {
    message.error(
      `Import failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    importPending.value = false;
  }
};
</script>

<template>
  <div class="page-size flex flex-col gap-12px overflow-hidden p-12px">
    <div class="flex items-center gap-12px">
      <PageBackButton />
      <GkSvg name="selector-library" class="text-24px" />
      <span class="text-20px font-600">Selector library</span>
      <NTag size="small" :bordered="false">
        {{ selectorLibrary.items.length }} item(s)
      </NTag>
      <div flex-1 />
      <NButton :loading="importPending" @click="openImportFile">Import</NButton>
      <NButton
        :disabled="selectorLibrary.items.length == 0"
        @click="exportLibrary"
      >
        Export
      </NButton>
      <input
        ref="localFileInput"
        hidden
        type="file"
        accept=".json,application/json"
        @change="importLibrary"
      />
    </div>

    <div class="library-body flex min-h-0 flex-1 gap-12px">
      <NCard
        :title="editorTitle"
        size="small"
        class="library-editor w-360px shrink-0 overflow-auto"
      >
        <NForm labelPlacement="top">
          <NFormItem label="Name">
            <NInput
              :value="form.name"
              placeholder="e.g. Close button"
              @update:value="updateName"
            />
          </NFormItem>
          <NFormItem label="Selector">
            <SelectorSyntaxInput
              :value="form.selector"
              placeholder="Enter a valid selector"
              :autosize="{ minRows: 4, maxRows: 8 }"
              hint="Syntax is validated automatically as you type"
              @update:value="updateSelector"
            />
          </NFormItem>
          <NFormItem label="Applies to app">
            <NInput
              :value="form.appId"
              placeholder="Leave blank for global"
              @update:value="updateAppId"
            />
          </NFormItem>
          <NFormItem label="Applies to activity">
            <NInput
              :value="form.activityId"
              :disabled="!form.appId.trim()"
              placeholder="Leave blank for all activities in this app"
              @update:value="updateActivityId"
            />
          </NFormItem>
          <NFormItem label="Tags">
            <NSelect
              :value="form.tags"
              :options="tagOptions"
              multiple
              filterable
              tag
              clearable
              maxTagCount="responsive"
              placeholder="Choose an existing tag or type a new one"
              @update:value="updateTags"
            />
          </NFormItem>
          <NFormItem label="Description">
            <NInput
              :value="form.description"
              type="textarea"
              placeholder="Note its purpose or things to watch out for"
              :autosize="{ minRows: 2, maxRows: 5 }"
              @update:value="updateDescription"
            />
          </NFormItem>
        </NForm>
        <div class="flex justify-end gap-8px">
          <NButton v-if="form.id" @click="resetEditor">Cancel edit</NButton>
          <NButton
            type="primary"
            :loading="savePending"
            :disabled="!form.name.trim() || !form.selector.trim()"
            @click="savePreset"
          >
            {{ form.id ? 'Save changes' : 'Add to library' }}
          </NButton>
        </div>
      </NCard>

      <NCard
        size="small"
        class="library-results min-h-0 min-w-0 flex-1 overflow-hidden"
        contentClass="flex min-h-0 flex-col"
      >
        <div class="mb-12px flex shrink-0 items-center gap-8px">
          <NInput
            :value="query"
            clearable
            placeholder="Search name, selector, tags, app, or activity"
            @update:value="updateQuery"
          />
          <NSelect
            :value="scopeFilter"
            :options="scopeFilterOptions"
            class="w-140px shrink-0"
            @update:value="updateScopeFilter"
          />
        </div>

        <NScrollbar class="library-list min-h-0 flex-1">
          <div v-if="visibleItems.length" class="flex flex-col gap-10px pr-8px">
            <div
              v-for="preset in visibleItems"
              :key="preset.id"
              class="app-panel rounded-6px border p-12px"
            >
              <div class="flex flex-wrap items-center gap-8px">
                <span class="text-16px font-600">{{ preset.name }}</span>
                <NTag size="small" :bordered="false">
                  {{ getSelectorPresetScopeLabel(preset) }}
                </NTag>
                <NTag v-for="tag in preset.tags" :key="tag" size="small">
                  {{ tag }}
                </NTag>
                <span class="ml-auto text-12px" style="color: var(--app-muted)">
                  Used {{ preset.useCount }} time(s)
                </span>
              </div>
              <div
                v-if="preset.description"
                class="mt-6px text-13px"
                style="color: var(--app-muted)"
              >
                {{ preset.description }}
              </div>
              <div
                class="app-subtle mt-8px break-all rounded-4px p-8px gkd_code text-13px"
              >
                <SelectorText :source="preset.selector" />
              </div>
              <div class="mt-10px flex justify-end gap-8px">
                <NButton size="small" @click="copySelector(preset.selector)">
                  Copy
                </NButton>
                <RouterLink :to="getTestRoute(preset.selector)">
                  <NButton size="small">Test</NButton>
                </RouterLink>
                <NButton size="small" @click="editPreset(preset)">
                  Edit
                </NButton>
                <NPopconfirm @positiveClick="removePreset(preset.id)">
                  <template #trigger>
                    <NButton size="small" type="error" secondary>
                      Delete
                    </NButton>
                  </template>
                  Delete selector "{{ preset.name }}"?
                </NPopconfirm>
              </div>
            </div>
          </div>
          <NEmpty v-else description="No matching selectors" />
        </NScrollbar>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 800px) {
  .library-body {
    flex-direction: column;
    overflow: auto;
  }

  .library-editor {
    width: auto;
    flex: none;
  }

  .library-results {
    flex: none;
  }

  .library-list {
    height: 60vh;
    flex: none;
  }
}
</style>
