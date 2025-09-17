<script setup>
    import { ref } from 'vue';
    import { useRouter } from 'vue-router';
    import config from '@/configs/config.json';
    import mapList from "@/configs/mapList.json";
    import MenuPanel from '@/components/MenuPanel.vue';
    import PinkHeader from '@/components/PinkHeader.vue';

    const router = useRouter();
    const data = ref({});
    const show = ref(true);
    const cachedMaps = ref({});
    const fullscreen = ref(window.fullScreen);

    const theme = localStorage.getItem("theme") ? JSON.parse(localStorage.getItem("theme")) : JSON.parse(JSON.stringify(config.defaultTheme));
    const loadedAssets = ref([]);
    const loadError = ref("");

    let assetData = [{ source: "background.png", size: 1544 }];
    for (let map of mapList.maps.filter(e => !config.commercial || e.commercialAllowed)) {
        assetData.push({ source: "songSamples/" + map.codeName + ".mp3", size: map.songSampleSize });
    }

    if (config.preloadMaps) {
        for (let map of mapList.maps.filter(e => !config.commercial || e.commercialAllowed)) {
            assetData.push({ source: "maps/" + map.codeName + ".json", size: map.mapSize });
        }
    }

    const hideFullscreenButton = ref(localStorage.getItem("hideFullscreenButton"));
    const reduceTransparency = ref(localStorage.getItem("reduceTransparency"));

    addEventListener("fullscreenchange", () => fullscreen.value = !fullscreen.value);

    if (Array.isArray(JSON.parse(localStorage.getItem("highscores")))) { // 1.5.1 migration
        for (let key of JSON.parse(localStorage.getItem("highscores"))) {
            localStorage.setItem(key + "-as", localStorage.getItem(key));
        }

        localStorage.setItem("highscores", JSON.stringify({
            keys: JSON.parse(localStorage.getItem("highscores")).flatMap(e => [e, e + "-as"]),
            compatibilityVersion: 2
        }));
    }

    if (localStorage.getItem("theme") && theme.inputText.placeholderColor) { // 1.6.0 cleanup
        delete theme.inputText.placeholderColor;
        localStorage.setItem("theme", JSON.stringify(theme));
    }

    function updateSettings(settings) {
        hideFullscreenButton.value = settings.hideFullscreenButton;
        reduceTransparency.value = settings.reduceTransparency;
        setStyles(settings);
    }

    function setStyles(settings) {
        if (reduceTransparency.value) {
            document.documentElement.style.setProperty("--bg-40", "90%");
            document.documentElement.style.setProperty("--bg-60", "90%");
        } else {
            document.documentElement.style.setProperty("--bg-40", "40%");
            document.documentElement.style.setProperty("--bg-60", "60%");
        }

        document.documentElement.style.setProperty("--themableWhite", settings.theme.menuColors.white);
        document.documentElement.style.setProperty("--color-pink-300", settings.theme.menuColors.brightPink);
        document.documentElement.style.setProperty("--color-pink-500", settings.theme.menuColors.pink);
        document.documentElement.style.setProperty("--color-violet-900", settings.theme.menuColors.purple);
    }
    setStyles({ theme: localStorage.getItem("theme") ? JSON.parse(localStorage.getItem("theme")) : JSON.parse(JSON.stringify(config.defaultTheme)) });

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

    function reloadPage() {
        window.location.reload();
    }

    window.addEventListener("load", async () => {
        for (let i in assetData) {
            await fetch(assetData[i].source)
                .then(async (response) => loadedAssets.value.push(config.preloadMaps && i > assetData.length / 2 ? await response.json() : URL.createObjectURL(await response.blob()).toString()))
                .catch((e) => {
                    loadError.value = e.name;
                    return;
                });
        }
    });
</script>

<template>
    <!-- loading screen -->
    <main
        v-if="loadedAssets.length != assetData.length || loadError"
        class="flex w-screen h-dvh flex-col items-center justify-center"
    >
        <img 
            class="fixed h-[calc(100vh+50px)] top-[-25px] w-screen object-cover select-none"
            :src="theme.backgroundImage == 'default' ? 'background.jpg' : theme.backgroundImage"
            alt="Background"
        >

        <MenuPanel 
            v-if="!loadError"
            animationVariant="noAnimation"
        >
            <PinkHeader text="Loading game..." />
            <p>Downloading a {{ Math.round(assetData[loadedAssets.length].size / 10) / 100 }}MB file...</p>
            <p class="mt-0.5">{{ Math.round((assetData.slice(0, loadedAssets.length).reduce((sum, e) => sum + e.size, 0) + 432) / 10) / 100 }}MB / {{ Math.round((assetData.reduce((sum, e) => sum + e.size, 0) + 432) / 10) / 100 }}MB</p>

            <div class="border-2 border-pink-500 outline-2 outline-white skew-x-[-15deg] mt-3 mb-1">
                <div class="w-75 h-3.5 flex items-center">
                    <div
                        class="h-3.5 bg-white"
                        :style="{ width: ((assetData.slice(0, loadedAssets.length).reduce((sum, e) => sum + e.size, 0) + 432) / (assetData.reduce((sum, e) => sum + e.size, 0) + 432)) * 300 + 'px' }"
                    ></div>
                </div>
            </div>
        </MenuPanel>

        <MenuPanel 
            v-else
            animationVariant="withoutBackground"
        >
            <PinkHeader text="Failed to load the game" />
            <p>{{ loadError }}</p>
            <button 
                class="button mt-2.5"
                @click="reloadPage()"
            >Try again</button>
        </MenuPanel>
    </main>
    
    <RouterView
        v-else-if="router.currentRoute.value.path == '/'"
        :cachedMaps="cachedMaps"
        :fullscreen="fullscreen"
        :defaultBackground="loadedAssets[0]"
        :songSamples="config.preloadMaps ? loadedAssets.slice(1, Math.round(loadedAssets.length / 2)) : loadedAssets.slice(1)"
        :preloadedMaps="config.preloadMaps ? loadedAssets.slice(Math.round(loadedAssets.length / 2)) : []"
        @cacheMap="(idx, mapData) => cachedMaps[idx] = mapData"
        @clearCache="cachedMaps = {}"
        @settingsChanged="(settings) => updateSettings(settings)"
        @setData="(newData) => data = newData"
    />

    <RouterView
        v-else-if="router.currentRoute.value.path == '/editor' && Object.keys(data).length"
        :data="data"
        :defaultBackground="loadedAssets[0]"
        @clearData="data = {}"
    />

    <RouterView
        v-else-if="router.currentRoute.value.path == '/editor'"
        :defaultBackground="loadedAssets[0]"
        @clearData="data = {}"
    />

    <!-- play -->
    <RouterView
        v-else-if="show"
        :data="data"
        :defaultBackground="loadedAssets[0]"
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
            :class="reduceTransparency ? 'w-5 brightness-63 group-hover:brightness-100 duration-200' : 'w-5 opacity-50 group-hover:opacity-100 duration-200'"
            src="@/assets/fullscreen.png" 
            alt="Fullscreen icon"
        >
    </button>
</template>