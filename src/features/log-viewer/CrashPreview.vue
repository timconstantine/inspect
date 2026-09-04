<script lang="tsx" setup>
import type { DataTableColumns } from 'naive-ui';
import type { CrashDetail, CrashSummary } from './crash_preview';
import { formatCrashTimestamp } from './crash_preview';
import DirectoryPreviewHeader from './DirectoryPreviewHeader.vue';
import RawJsonPreview from './RawJsonPreview.vue';
import type { SourceLinkContext } from './source_links';
import StackRetraceButton from './StackRetraceButton.vue';
import TextSearchInput from './TextSearchInput.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  items: CrashSummary[];
  detail?: CrashDetail;
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
const page = shallowRef(1);
const pageSize = 50;

const filteredItems = computed(() => {
  const actualQuery = query.value.trim();
  if (!actualQuery) return props.items;
  return props.items.filter((item) => {
    const values = [
      item.fileName,
      item.name || ``,
      item.message || ``,
      item.thread || ``,
      item.device || ``,
      item.versionName || ``,
      item.versionCode == null ? `` : String(item.versionCode),
      item.androidVersionName || ``,
      item.androidVersionCode == null ? `` : String(item.androidVersionCode),
      item.error || ``,
    ];
    return values.some((value) =>
      matchesTextSearch(value, actualQuery, searchOptions),
    );
  });
});

const resetPage = () => {
  page.value = 1;
};

const pagedItems = computed(() => {
  const offset = (page.value - 1) * pageSize;
  return filteredItems.value.slice(offset, offset + pageSize);
});

const selectedItem = computed(() => {
  return props.items.find((item) => item.path == selectedPath.value);
});

const getVersionText = (name: string | undefined, code: number | undefined) => {
  if (name && code != null) return `${name} (${code})`;
  return name || code?.toString() || `-`;
};

const getStatusLabel = (status: CrashSummary['status']) => {
  if (status == `valid`) return `Complete`;
  if (status == `incomplete`) return `Incomplete fields`;
  if (status == `invalid`) return `Parse failed`;
  return `Unsupported`;
};

const getStatusType = (status: CrashSummary['status']) => {
  if (status == `valid`) return `success` as const;
  if (status == `incomplete`) return `warning` as const;
  if (status == `invalid`) return `error` as const;
  return `default` as const;
};

const openDetail = (item: CrashSummary) => {
  selectedPath.value = item.path;
  activeTab.value = `detail`;
  emit(`select`, item.path);
};

const columns: DataTableColumns<CrashSummary> = [
  {
    key: `timestamp`,
    title: `Time`,
    width: 190,
    sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    render: (item) => formatCrashTimestamp(item.timestamp),
  },
  {
    key: `name`,
    title: `Exception type`,
    width: 280,
    ellipsis: { tooltip: true },
    render(item) {
      return (
        <div class="min-w-0 flex items-center gap-6px">
          <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {item.name || item.fileName}
          </span>
          {item.status == `valid` ? null : (
            <NTag size="small" type={getStatusType(item.status)}>
              {getStatusLabel(item.status)}
            </NTag>
          )}
        </div>
      );
    },
  },
  {
    key: `message`,
    title: `Exception message`,
    width: 360,
    ellipsis: { tooltip: true },
    render: (item) => item.message || item.error || `-`,
  },
  {
    key: `thread`,
    title: `Thread`,
    width: 100,
    render: (item) => item.thread || `-`,
  },
  {
    key: `version`,
    title: `GKD version`,
    width: 180,
    render: (item) => getVersionText(item.versionName, item.versionCode),
  },
  {
    key: `android`,
    title: `Android`,
    width: 140,
    render: (item) =>
      getVersionText(item.androidVersionName, item.androidVersionCode),
  },
  {
    key: `device`,
    title: `Device`,
    width: 260,
    ellipsis: { tooltip: true },
    render: (item) => item.device || `-`,
  },
];

const rowProps = (item: CrashSummary) => ({
  class: `cursor-pointer`,
  onClick: () => openDetail(item),
});
</script>

<template>
  <div name="crash-preview" class="h-full min-h-0 flex flex-col">
    <DirectoryPreviewHeader
      title="Crash records"
      :count="items.length"
      listLabel="Crash list"
      :listActive="activeTab == 'list'"
      :detailText="selectedItem?.fileName"
      :detailTitle="selectedItem?.path"
      @selectList="activeTab = 'list'"
    />

    <div
      v-if="activeTab == 'list'"
      name="crash-list"
      class="min-h-0 flex flex-1 flex-col gap-10px"
    >
      <TextSearchInput
        v-model="query"
        v-model:match-case="searchOptions.matchCase"
        v-model:whole-word="searchOptions.wholeWord"
        v-model:use-regex="searchOptions.useRegex"
        placeholder="Search exception type, message, device, or version"
        class="flex-none"
        @update:modelValue="resetPage"
        @update:matchCase="resetPage"
        @update:wholeWord="resetPage"
        @update:useRegex="resetPage"
      />
      <NEmpty
        v-if="pagedItems.length == 0"
        :description="
          query.trim() ? 'No matching crash records' : 'No crash records'
        "
        class="min-h-0 flex-1"
      />
      <NDataTable
        v-else
        striped
        flexHeight
        virtualScroll
        :columns="columns"
        :data="pagedItems"
        :pagination="false"
        :rowKey="(item: CrashSummary) => item.path"
        :rowProps="rowProps"
        :scrollX="1510"
        class="min-h-0 flex-1 [&_.n-data-table-wrapper]:h-full"
      />
      <NPagination
        v-if="filteredItems.length > pageSize"
        v-model:page="page"
        :pageSize="pageSize"
        :itemCount="filteredItems.length"
        class="flex-none justify-end"
      />
    </div>

    <div
      v-else
      name="crash-detail"
      class="min-h-0 flex flex-1 flex-col gap-10px"
    >
      <NSpin v-if="detailLoading" show class="min-h-0 flex-1" />
      <NEmpty v-else-if="!detail" description="Select a crash record" />
      <template v-else>
        <NAlert
          v-if="detail.error"
          type="warning"
          title="This record couldn't be fully parsed"
          class="flex-none"
        >
          {{ detail.error }}
        </NAlert>
        <NDescriptions
          bordered
          size="small"
          :column="3"
          labelPlacement="left"
          class="flex-none"
        >
          <NDescriptionsItem label="Time">
            {{ formatCrashTimestamp(detail.timestamp) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Thread">
            {{ detail.thread || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="GKD version">
            {{ getVersionText(detail.versionName, detail.versionCode) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Android">
            {{
              getVersionText(
                detail.androidVersionName,
                detail.androidVersionCode,
              )
            }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Device" :span="2">
            {{ detail.device || '-' }}
          </NDescriptionsItem>
        </NDescriptions>

        <NTabs
          type="line"
          animated
          class="min-h-0 flex-1 [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0"
        >
          <NTabPane name="stack" tab="Stack trace">
            <TextViewer
              v-if="detail.stackTrace"
              :key="`${detail.path}:stack`"
              :value="detail.stackTrace"
              :documentKey="detail.path"
              search-placeholder="Search crash stack trace"
              allow-wrap
              copyable
              :sourceLinkContext="sourceLinkContext"
              class="h-full"
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
            <NEmpty v-else description="This record has no stack trace" />
          </NTabPane>
          <NTabPane name="raw" tab="Raw JSON">
            <RawJsonPreview
              v-if="detail.parsed"
              :value="detail.value"
              :raw="detail.raw"
            />
            <TextViewer
              v-else-if="detail.raw"
              :key="`${detail.path}:raw`"
              :value="detail.raw"
              search-placeholder="Search raw content"
              allow-wrap
              copyable
              class="h-full"
            />
            <NEmpty v-else description="Couldn't read raw content" />
          </NTabPane>
        </NTabs>
      </template>
    </div>
  </div>
</template>
