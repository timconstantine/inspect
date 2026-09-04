import { dialog, message } from '@/shared/services/feedback';
import { settingsActions, settingsStore } from '@/features/settings/store';

export const showTextDLg = ({ title = `Batch share links`, content = '' }) => {
  dialog.success({
    title,
    style: {
      width: `800px`,
    },
    content() {
      return (
        <NInput
          type="textarea"
          autosize={{
            minRows: 8,
            maxRows: 16,
          }}
          inputProps={{
            style: `white-space: nowrap;`,
            class: `gkd_code`,
          }}
          value={content}
        />
      );
    },
    positiveText: `Copy`,
    onPositiveClick() {
      navigator.clipboard
        .writeText(content)
        .then(() => {
          message.success(`Copied`);
        })
        .catch(() => {
          message.success(`Copy failed`);
        });
      return false;
    },
  });
};

const NoticeCheckbox = defineComponent(() => {
  return () => {
    return (
      <NCheckbox
        checked={settingsStore.ignoreUploadWarn}
        onUpdateChecked={(value) => {
          settingsActions.update({ ignoreUploadWarn: value });
        }}
        focusable={false}
      >
        Don't show again
      </NCheckbox>
    );
  };
});

export const waitShareAgree = async () => {
  if (settingsStore.ignoreUploadWarn) return;
  return new Promise((resolve, reject) => {
    dialog.warning({
      title: 'Notice about generating share links',
      content() {
        return (
          <div>
            <div>
              All uploaded snapshot share links are public — anyone can access
              them.
            </div>
            <div>
              Make sure the snapshot doesn't contain private information, and
              don't share anything sensitive.
            </div>
            <NoticeCheckbox class="mt-10px" />
          </div>
        );
      },
      closable: false,
      closeOnEsc: false,
      maskClosable: false,
      positiveText: 'Continue uploading',
      negativeText: 'Cancel sharing',
      onPositiveClick: resolve,
      onNegativeClick: reject,
    });
  });
};
