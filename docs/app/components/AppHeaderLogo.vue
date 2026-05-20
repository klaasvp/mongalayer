<template>
    <UContextMenu :items="contextMenuItems">
        <div class="flex items-center gap-2">
            <NuxtImg src="/logo.svg" class="h-12 w-auto shrink-0" />
            <h1 class="text-xl font-bold">{{ appConfig.header.title }}</h1>
        </div>
    </UContextMenu>
</template>

<script setup lang="ts">
const appConfig = useAppConfig()
const { contextMenuItems } = useLogoAssets()
</script>