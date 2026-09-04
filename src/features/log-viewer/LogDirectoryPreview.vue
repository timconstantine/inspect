<script lang="tsx" setup>
import type { DataTableColumns } from 'naive-ui';
import DirectoryPreviewHeader from './DirectoryPreviewHeader.vue';
import { formatLogFileDate, type LogFileSummary } from './directory_preview';
import { formatBytes } from './log';
import type { SourceLinkContext } from './source_links';
import StackRetraceButton from './StackRetraceButton.vue';
import TextSearchInput from './TextSearchInput.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  items: LogFileSummary[];
  detailPath?: string;
  detailText?: string;
  detailError?: string;
  detailLoading?: boolean;
  retraceAvailable?: boolean;
  retraceLoading?: boolean;
  retraceActive?: boolean;
  sourceLinkContext?: SourceLinkContext;
}>();

const emit = defineEmits<{
  select: [path: string];
  toggleRetrace: [];
}>();

const activeTab = shallowRef<`list` | `detail`>(`list`);
const selectedPath = shallowRef(``);
const query = shallowRef(``);
const searchOptions = reactive(createTextSearchOptions());

const filteredItems = computed(() => {
  const actualQuery = query.value.trim();
  if (!actualQuery) return props.items;
  return props.items.filter((item) => {
    return [item.fileName, formatLogFileDate(item.timestamp)].some((value) =>
      matchesTextSearch(value, actualQuery, searchOptions),
    );
  });
});

const selectedItem = computed(() => {
  return props.items.find((item) => item.path == selectedPath.value);
});

const openDetail = (item: LogFileSummary) => {
  selectedPath.value = item.path;
  activeTab.value = `detail`;
  emit(`select`, item.path);
};

const columns: DataTableColumns<LogFileSummary> = [
  {
    key: `date`,
    title: `Date`,
    width: 180,
    sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    render: (item) => formatLogFileDate(item.timestamp),
  },
  { key: `fileName`, title: `File name` },
  {
    key: `size`,
    title: `Size`,
    width: 140,
    sorter: (a, b) => a.size - b.size,
    render: (item) => formatBytes(item.size),
  },
];

const rowProps = (item: LogFileSummary) => ({
  class: `cursor-pointer`,
  onClick: () => openDetail(item),
});
</script>

<template>
  <div name="log-directory-preview" class="h-full min-h-0 flex flex-col">
    <DirectoryPreviewHeader
      title="Runtime logs"
      :count="items.length"
      listLabel="Log list"
      :listActive="activeTab == 'list'"
      :detailText="selectedItem?.fileName"
      :detailTitle="selectedItem?.path"
      :detailMeta="selectedItem ? formatBytes(selectedItem.size) : undefined"
      @selectList="activeTab = 'list'"
    />

    <div
      v-if="activeTab == 'list'"
      class="min-h-0 flex flex-1 flex-col gap-10px"
    >
      <TextSearchInput
        v-model="query"
        v-model:match-case="searchOptions.matchCase"
        v-model:whole-word="searchOptions.wholeWord"
        v-model:use-regex="searchOptions.useRegex"
        placeholder="Search log date or file name"
        class="flex-none"
      />
      <NEmpty
        v-if="filteredItems.length == 0"
        :description="query.trim() ? 'No matching log files' : 'No log files'"
        class="min-h-0 flex-1"
      />
      <NDataTable
        v-else
        striped
        :columns="columns"
        :data="filteredItems"
        :pagination="false"
        :rowKey="(item: LogFileSummary) => item.path"
        :rowProps="rowProps"
        class="min-h-0 flex-1 [&_.n-data-table-wrapper]:h-full"
      />
    </div>

    <div v-else class="min-h-0 flex flex-1 flex-col">
      <NSpin v-if="detailLoading" show class="min-h-0 flex-1" />
      <NAlert
        v-else-if="detailError"
        type="error"
        title="Failed to read log file"
      >
        {{ detailError }}
      </NAlert>
      <TextViewer
        v-else-if="detailPath && detailText != null"
        :key="detailPath"
        :value="detailText"
        search-placeholder="Search current log file"
        allow-wrap
        copyable
        :sourceLinkContext="sourceLinkContext"
        class="min-h-0 flex-1"
      >
        <template #toolbar-start>
          <StackRetraceButton
            :available="retraceAvailable"
            :loading="retraceLoading"
            :retraced="retraceActive"
            @toggle="emit('toggleRetrace')"
          />
        </template>
      </TextViewer>
      <NEmpty v-else description="Select a log file" />
    </div>
  </div>
</template>
