<script setup>
    import { ref } from 'vue';
    import { useRouter } from 'vue-router';
    import config from "@/configs/config.json";

    const router = useRouter();
    const data = ref({});
    const show = ref(true);
    const cachedMaps = ref({});
    const fullscreen = ref(window.fullScreen);

    const hideFullscreenButton = ref(localStorage.getItem("hideFullscreenButton"));
    const reduceTransparency = ref(localStorage.getItem("reduceTransparency"));

    addEventListener("fullscreenchange", () => fullscreen.value = !fullscreen.value);

    function updateSettings(settings) {
        hideFullscreenButton.value = settings.hideFullscreenButton;
        reduceTransparency.value = settings.reduceTransparency;
        setTransparencies();
    }

    function setTransparencies() {
        if (reduceTransparency.value) {
            document.documentElement.style.setProperty("--bg-40", "90%");
            document.documentElement.style.setProperty("--bg-60", "90%");
        } else {
            document.documentElement.style.setProperty("--bg-40", "40%");
            document.documentElement.style.setProperty("--bg-60", "60%");
        }
    }
    setTransparencies();

    function restart(newData) {
        data.value = newData;
        show.value = false;
        setTimeout(() => {
            show.value = true;
        }, 0);
    }

    function enterFullscreen() {
        document.documentElement.requestFullscreen();
    }
</script>

<template>
    <RouterView
        v-if="router.currentRoute.value.path == '/'"
        :cachedMaps="cachedMaps"
        :fullscreen="fullscreen"
        @cacheMap="(idx, mapData) => cachedMaps[idx] = mapData"
        @clearCache="cachedMaps = {}"
        @settingsChanged="(settings) => updateSettings(settings)"
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
        :fullscreenButtonShown="config.enableFullscreenButton && !hideFullscreenButton && !fullscreen"
        @setData="(newData, doARestart) => doARestart ? restart(newData) : data = newData"
    />

    <button
        v-if="!fullscreen && config.enableFullscreenButton && !hideFullscreenButton"
        :class="reduceTransparency ? 'fixed group bottom-2 left-2 bg-black/90 px-2.5 py-2.5 rounded-xl backdrop-blur-sm z-100 cursor-pointer border-white/0 border-2 hover:backdrop-blur-md hover:bg-black hover:border-white hover:opacity-100 hover:brightness-125 duration-200' : 'fixed group bottom-2 left-2 bg-black/20 px-2.5 py-2.5 rounded-xl backdrop-blur-sm z-100 cursor-pointer border-white/0 border-2 hover:backdrop-blur-md hover:bg-black/40 hover:border-white hover:opacity-100 hover:brightness-125 duration-200'"
        title="Enter fullscreen."
        @click="enterFullscreen()"
    >
        <img 
            :class="reduceTransparency ? 'w-5 brightness-63 group-hover:brightness-100' : 'w-5 opacity-50 group-hover:opacity-100'"
            src="@/assets/fullscreen.png" 
            alt="Fullscreen icon"
        >
    </button>
</template>