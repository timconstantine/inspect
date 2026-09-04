<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import { useRouteBack } from '@/features/navigation/useRouteBack';

const { goBack } = useRouteBack();
</script>

<template>
  <div class="flex">
    <NTooltip placement="right">
      <template #trigger>
        <NButton
          text
          style="--n-icon-size: 24px"
          aria-label="Go back"
          @click="goBack"
        >
          <template #icon>
            <GkSvg name="arrow" class="rotate-90" />
          </template>
        </NButton>
      </template>
      Go back
    </NTooltip>
  </div>
</template>
