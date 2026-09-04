import type { Snapshot } from '@/entities/snapshot/types';
import {
  showTextDLg,
  waitShareAgree,
} from '@/features/snapshot-management/dialog';
import { dialog, message } from '@/shared/services/feedback';
import {
  batchCreateImageId,
  batchCreateZipUrl,
  batchImageDownloadZip,
  batchZipDownloadZip,
} from '@/features/snapshot-management/export';
import { DELETE_TIMEOUT, withTimeout } from '@/shared/lib/async';
import { snapshotStorage } from '@/entities/snapshot/storage';
import { useTask } from '@/shared/lib/task';
import { getImagUrl, getImportUrl } from '@/entities/snapshot/urls';

export const useBatchActions = (
  checkedRowKeys: Ref<number[]>,
  options: {
    onAfterDelete?: () => void | Promise<void>;
    beforeDeleteItem?: (id: number) => Promise<unknown>;
  } = {},
) => {
  // Device page doesn't support batch operations yet
  const checkedSnapshots = () => {
    return Promise.all(
      checkedRowKeys.value.map(
        (id) => snapshotStorage.getItem(id) as Promise<Snapshot>,
      ),
    );
  };

  const batchDelete = useTask(async () => {
    await new Promise((res, rej) => {
      dialog.error({
        title: `Delete`,
        content: `Batch delete ${checkedRowKeys.value.length} snapshot(s)?`,
        negativeText: `Cancel`,
        positiveText: `Confirm`,
        onClose: rej,
        onEsc: rej,
        onMaskClick: rej,
        onNegativeClick: rej,
        onPositiveClick: res,
      });
    });
    if (options.beforeDeleteItem) {
      const remoteResults = await Promise.allSettled(
        checkedRowKeys.value.map((k) => options.beforeDeleteItem!(k)),
      );
      const remoteFailedIds = checkedRowKeys.value.filter(
        (_, i) => remoteResults[i].status === 'rejected',
      );
      const remoteSuccessIds = checkedRowKeys.value.filter(
        (_, i) => remoteResults[i].status === 'fulfilled',
      );
      const localResults = await Promise.allSettled(
        remoteSuccessIds.map((k) =>
          withTimeout(
            () => snapshotStorage.removeItem(k),
            DELETE_TIMEOUT,
            `Local delete timed out`,
          ),
        ),
      );
      const localFailedIds = remoteSuccessIds.filter(
        (_, i) => localResults[i].status === 'rejected',
      );
      const localSuccessIds = remoteSuccessIds.filter(
        (_, i) => localResults[i].status === 'fulfilled',
      );
      const allFailedIds = [...remoteFailedIds, ...localFailedIds];
      const successCount = localSuccessIds.length;
      const remoteFailCount = remoteFailedIds.length;
      const localFailCount = localFailedIds.length;
      if (successCount) {
        message.success(`Deleted ${successCount} successfully`);
      }
      if (remoteFailCount || localFailCount) {
        message.warning(
          `${remoteFailCount} remote delete failure(s), ${localFailCount} local delete failure(s)`,
        );
      }
      checkedRowKeys.value = allFailedIds;
    } else {
      const localResults = await Promise.allSettled(
        checkedRowKeys.value.map((k) =>
          withTimeout(
            () => snapshotStorage.removeItem(k),
            DELETE_TIMEOUT,
            `Local delete timed out`,
          ),
        ),
      );
      const localFailedIds = checkedRowKeys.value.filter(
        (_, i) => localResults[i].status === 'rejected',
      );
      const localSuccessIds = checkedRowKeys.value.filter(
        (_, i) => localResults[i].status === 'fulfilled',
      );
      if (localFailedIds.length) {
        message.warning(
          `Deleted ${localSuccessIds.length} successfully, ${localFailedIds.length} failed`,
        );
      } else {
        message.success(`Deleted ${localSuccessIds.length} successfully`);
      }
      checkedRowKeys.value = localFailedIds;
    }
    await options.onAfterDelete?.();
  });

  const batchDownloadImage = useTask(async () => {
    await batchImageDownloadZip(await checkedSnapshots());
  });

  const batchDownloadZip = useTask(async () => {
    await batchZipDownloadZip(await checkedSnapshots());
  });

  const batchShareImageUrl = useTask(async () => {
    await waitShareAgree();
    const imageIds = await batchCreateImageId(await checkedSnapshots());
    showTextDLg({
      content: imageIds.map((s) => getImagUrl(s)).join(`\n`) + `\n`,
    });
  });

  const batchShareZipUrl = useTask(async () => {
    await waitShareAgree();
    const zipUrls = await batchCreateZipUrl(await checkedSnapshots());
    showTextDLg({
      content: zipUrls.map((s) => getImportUrl(s)).join(`\n`) + `\n`,
    });
  });

  return {
    batchDelete,
    batchDownloadImage,
    batchDownloadZip,
    batchShareImageUrl,
    batchShareZipUrl,
  };
};
