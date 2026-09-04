<script setup lang="ts">
import { useNetworkAccessStore } from '@/features/network-access/store';

const networkAccessStore = useNetworkAccessStore();
</script>
<template>
  <NModal
    :show="networkAccessStore.state.githubErrorDialogVisible"
    preset="dialog"
    title="Failed to generate share link"
    type="error"
    @update:show="networkAccessStore.setGithubErrorDialogVisible"
  >
    <div>Generating a share link requires the following</div>
    <div>
      Be logged into
      <a href="https://github.com" target="_blank" rel="noopener noreferrer">
        github.com
      </a>
      in this browser
    </div>
  </NModal>
  <NModal
    :show="networkAccessStore.state.networkErrorDialogVisible"
    preset="dialog"
    title="Failed to access resources on other domains"
    type="error"
    @update:show="networkAccessStore.setNetworkErrorDialogVisible"
  >
    <div>Accessing resources on other domains requires the following</div>
    <div>
      1. Install a script manager, such as
      <a
        href="https://violentmonkey.github.io/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Violentmonkey
      </a>
    </div>
    <div>
      2. Install the userscript
      <a
        href="https://github.com/gkd-kit/network-extension"
        target="_blank"
        rel="noopener noreferrer"
      >
        network-extension
      </a>
    </div>
    <div>3. Enable that userscript's API injection for this site</div>
    <div>
      4. Sharing a file or importing a snapshot also requires being logged into
      <a href="https://github.com" target="_blank" rel="noopener noreferrer">
        github.com
      </a>
      in this browser
    </div>
  </NModal>
</template>
