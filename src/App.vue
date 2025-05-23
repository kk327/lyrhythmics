<script setup>
    import { ref } from 'vue';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    const data = ref({});
    const show = ref(true);
    const mobileWarningAccepted = ref(false);
    const cachedMaps = ref({});

    function restart(newData) {
        data.value = newData;
        show.value = false;
        setTimeout(() => {
            show.value = true;
        }, 0);
    }
</script>

<template>
    <RouterView
        v-if="router.currentRoute.value.path == '/'"
        :mobileWarningAccepted="mobileWarningAccepted"
        :cachedMaps="cachedMaps"
        @acceptMobileWarning="mobileWarningAccepted = true"
        @cacheMap="(idx, mapData) => cachedMaps[idx] = mapData"
        @clearCache="cachedMaps = {}"
        @setData="(newData) => data = newData"
    />

    <RouterView
        v-else-if="router.currentRoute.value.path == '/editor' && Object.keys(data).length"
        @clearData="data = {}"
        :data="data"
    />

    <RouterView
        v-else-if="router.currentRoute.value.path == '/editor'"
        @clearData="data = {}"
    />

    <!-- play -->
    <RouterView
        v-else-if="show"
        :data="data"
        @setData="(newData) => restart(newData)"
    />
</template>