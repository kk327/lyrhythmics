<script setup>
    import { ref, onUnmounted, computed, watch, watchEffect, reactive } from "vue";
    import { useRouter } from 'vue-router';
    import defaultBackground from "@/assets/background.png";
    import changelog from "@/configs/changelog.json";
    import config from "@/configs/config.json";
    import mapList from "@/configs/mapList.json";
    import MapCustomization from "@/components/MapCustomization.vue";
    import PinkButton from "@/components/PinkButton.vue";
    import PinkHeader from "@/components/PinkHeader.vue";
    import SpeedSelector from '@/components/SpeedSelector.vue';
    import LyricsCustomization from "@/components/LyricsCustomization.vue";
    import Automap from "@/components/Automap.vue";

    // uncomment and change "preloadMaps" to true in /src/configs/config.json to preload all the maps
    // Everything above is licensed under AGPLv3, the code below until the comment saying "public domain code ends here" is in public domain
    /*import livinDreamsJSON from "../../public/maps/livinDreams.json";
    import lapseJSON from "../../public/maps/lapse.json";
    import whatUSayIsntJSON from "../../public/maps/whatUSayIsnt.json";
    import youreNotAloneJSON from "../../public/maps/youreNotAlone.json";
    import silverHeartzJSON from "../../public/maps/silverHeartz.json";
    import alwaysJSON from "../../public/maps/always.json";
    import anAngelFallsJSON from "../../public/maps/anAngelFalls.json";
    import reachingHighJSON from "../../public/maps/reachingHigh.json";
    import coolBreezeJSON from "../../public/maps/coolBreeze.json";
    import leavesJSON from "../../public/maps/leaves.json";*/
    // public domain code ends here, everything below is licensed under AGPLv3

    import livinDreams from "@/songSamples/livinDreams.mp3";
    import lapse from "@/songSamples/lapse.mp3";
    import whatUSayIsnt from "@/songSamples/whatUSayIsnt.mp3";
    import youreNotAlone from "@/songSamples/youreNotAlone.mp3";
    import silverHeartz from "@/songSamples/silverHeartz.mp3";
    import always from "@/songSamples/always.mp3";
    import anAngelFalls from "@/songSamples/anAngelFalls.mp3";
    import reachingHigh from "@/songSamples/reachingHigh.mp3";
    import coolBreeze from "@/songSamples/coolBreeze.mp3";
    import leaves from "@/songSamples/leaves.mp3";

    const props = defineProps([
        "cachedMaps",
        "fullscreen"
    ]);

    const emit = defineEmits([
        "setData",
        "cacheMap",
        "clearCache",
        "settingsChanged"
    ]);

    const router = useRouter();

    const platform = config.platform; // used for special text on Newgrounds and itch.io
    const commercial = config.commercial; // removes songs with a license that forbids commercial use. Forbidding commercial use might be forbidding one of the freedoms of free software. Note that it only removes the non-commercially licensed songs from the song list though, and doesn't remove them from the game files.

    let preloadedMaps = [];
    if (config.preloadMaps) {
        preloadedMaps = {
            livinDreams: livinDreamsJSON,
            lapse: lapseJSON,
            whatUSayIsnt: whatUSayIsntJSON,
            youreNotAlone: youreNotAloneJSON,
            silverHeartz: silverHeartzJSON,
            always: alwaysJSON,
            anAngelFalls: anAngelFallsJSON,
            reachingHigh: reachingHighJSON,
            coolBreeze: coolBreezeJSON,
            leaves: leavesJSON
        }
    }

    const songSamples = {
        livinDreams: livinDreams,
        lapse: lapse,
        whatUSayIsnt: whatUSayIsnt,
        youreNotAlone: youreNotAlone,
        silverHeartz: silverHeartz,
        always: always,
        anAngelFalls: anAngelFalls,
        reachingHigh: reachingHigh,
        coolBreeze: coolBreeze,
        leaves: leaves
    };
    const song = ref(new Audio());

    const data = ref({});
    const menu = ref("main");
    const visibleOverlay = ref("");
    const highscoreResetWarning = ref(false);
    const fileLoadError = ref("");
    const forceDefaultBackground = ref(false);
    const fullscreen = ref(props.fullscreen);
    
    const thinScreen = ref(!window.matchMedia("(min-width: 40rem)").matches);
    const mobile = navigator.userAgent.match(/Android|iPhone|iPad/);

    const selectedMapData = ref({});
    let mapDownloadAbortController = new AbortController();

    const sizeRefresh = ref(false);
    const time = ref(0);
    let timeAtStart = Date.now() + 3500;
    let timeInterval;

    const automapBackgroundImage = ref(defaultBackground);
    const automapHueRotate = ref(0);

    const releases = changelog.releases;
    const maps = ref(mapList.maps.sort((a, b) => a.name.localeCompare(b.name)));

    const booleanSettings = ref([
        { codeName: "skipLyricless", displayName: "Skip parts without lyrics" },
        { codeName: "autospaceByDefault", displayName: "Autospace"},
        { codeName: "saveHighscores", displayName: "Save highscores" },
        { codeName: "additionalWordCorrectnessFeedback", displayName: "Additional word correctness feedback", clarification: "more information in the score system section of the about page" },
        { codeName: "changeThePitch", displayName: "Change the pitch along with speed", clarification: "creates a reverb when slowed, makes it sound like nightcore when sped up" },
        { codeName: "disableBackgroundLyrics", displayName: "Disable main menu background lyrics", clarification: "saves resources if you keep the game open in the backround" },
        { codeName: "reduceTransparency", displayName: "Reduce background transparency", clarification: "improves readability, applies to small elements like inputs as well" },
        { codeName: "continueWithRestartSettings", displayName: "Continue with restart settings by default" },
        { codeName: "nonDecimalCurrentTime", displayName: "Non-decimal current time", clarification: "reduces the motion of the time counter" },
        { codeName: "disableCaching", displayName: "Disable storing official maps in RAM", clarification: "by default after you load a map it's saved for later" },
        { codeName: "hideFullscreenButton", displayName: "Hide the fullscreen button"},
        { codeName: "disableVerseBackgroundBlur", displayName: "Disable verse background blur in the editor" },
        { codeName: "capitalization" },
        { codeName: "accentLetters" },
        { codeName: "specialCharacters" },
    ]);
    
    const numberSettings = [
        { name: "defaultSpeed", default: 1 },
        { name: "targetFPS", default: 60 },
        { name: "defaultWordLengthLimit", default: 0 }
    ];

    const settings = reactive({});

    for (let setting of booleanSettings.value) {
        settings[setting.codeName] = localStorage.getItem(setting.codeName);
    }
 
    for (let setting of numberSettings) {
        settings[setting.name] = localStorage.getItem(setting.name) ? localStorage.getItem(setting.name) : setting.default;
    }

    watch(settings, () => {
        for (let setting of booleanSettings.value.map(e => e.codeName)) {
            if (settings[setting] && !localStorage.getItem(setting)) {
                if (setting == "disableCaching" && !localStorage.getItem(setting)) {
                    emit("clearCache");
                }
                localStorage.setItem(setting, true);
            } else if (!settings[setting] && localStorage.getItem(setting)) {
                if (setting == "saveHighscores" && localStorage.getItem("highscores")) {
                    highscoreResetWarning.value = true;
                    setTimeout(() => {
                        settings.saveHighscores = true;
                    });
                } else {
                    localStorage.removeItem(setting);
                }
            }
        }

        for (let setting of numberSettings) {
            if (settings[setting.name] != setting.default) {
                localStorage.setItem(setting.name, settings[setting.name]);
            } else {
                localStorage.removeItem(setting.name);
            }
        }
    });

    watch(() => settings.targetFPS, () => {
        clearInterval(timeInterval);
        setTimeInterval();
    });

    watch(() => settings.hideFullscreenButton + settings.reduceTransparency, () => {
        emit("settingsChanged", { hideFullscreenButton: settings.hideFullscreenButton, reduceTransparency: settings.reduceTransparency });
    });

    watchEffect(() => {
        fullscreen.value = props.fullscreen;
    });

    document.body.style.overflowY = "hidden";
    document.title = "Lyrhythmics";
    window.scrollTo({ top: 0 });

    function setTimeInterval() {
        timeInterval = setInterval(() => {
            time.value = (Date.now() - timeAtStart) / 1000;
            if (time.value >= 155.5) {
                timeAtStart = Date.now() + 3500;
            }

            window.scrollTo({ top: 0 }); // fix for chromium
        }, 1000 / settings.targetFPS);
    }
    setTimeInterval();

    onUnmounted(() => {
        removeEventListener("resize", onResize);
        removeEventListener("keydown", onKeydown);
        clearInterval(timeInterval);
    });


    function askForFile() {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "application/json";
        fileInput.click();
        fileInput.addEventListener("change", (e) => {
            document.activeElement.blur();
            const reader = new FileReader();
            reader.onload = (e2) => {
                const requiredKeys = ["name", "mapper", "additionalInfo", "song", "backgroundImage", "backgroundFilters", "lyrics", "partsWithoutLyrics", "forceskip", "id"];

                let dataTemp;
                try {    
                    dataTemp = { ...JSON.parse(e2.target.result),
                                    startTime: 0,
                                    speed: 1 };
                } catch {
                    fileLoadError.value = "The file is damaged.";
                    return;
                }

                let hasAllKeys = true;
                for (let key of requiredKeys) {
                    if (!(key in dataTemp)) {
                        hasAllKeys = false;
                        fileLoadError.value = "The file doesn't have the required keys.";
                        break;
                    }
                }

                if (hasAllKeys) {
                    forceDefaultBackground.value = false;
                    data.value = dataTemp;
                }
            };

            if (e.target.files[0].name.match(/\.json$/)) {
                reader.readAsText(e.target.files[0]);
            } else {
                fileLoadError.value = "This is not a JSON file.";
            }
        })
    }

    const visibleLyrics = computed(() => {
        return "Lorem ipsum dolor sit amet consectetur adipiscing elit.Semper vel class aptent taciti sociosqu ad litora.Blandit quis suspendisse aliquet nisi sodales consequat magna.Cras eleifend turpis fames primis vulputate ornare sagittis.Sem placerat in id cursus mi pretium tellus.Orci varius natoque penatibus et magnis dis parturient.Finibus facilisis dapibus etiam interdum tortor ligula congue.Proin libero feugiat tristique accumsan maecenas potenti ultricies.Sed diam urna tempor pulvinar vivamus fringilla lacus.Eros lobortis nulla molestie mattis scelerisque maximus eget.Porta elementum a enim euismod quam justo lectus.Curabitur facilisi cubilia curae hac habitasse platea dictumst.Nisl malesuada lacinia integer nunc posuere ut hendrerit.Efficitur laoreet mauris pharetra vestibulum fusce dictum risus.Imperdiet mollis nullam volutpat porttitor ullamcorper rutrum gravida.Adipiscing elit quisque faucibus ex sapien vitae pellentesque.Ad litora torquent per conubia nostra inceptos himenaeos.Consequat magna ante condimentum neque at luctus nibh.Ornare sagittis vehicula praesent dui felis venenatis ultrices.Pretium tellus duis convallis tempus leo eu aenean.Dis parturient montes nascetur ridiculus mus donec rhoncus.Ligula congue sollicitudin erat viverra ac tincidunt nam.Potenti ultricies habitant morbi senectus netus suscipit auctor.Fringilla lacus nec metus bibendum egestas iaculis massa".split(".").map((e, idx) => e.split(" ").map((e2, idx2) => { return { word: e2, delay: idx * 6.5 + idx2 * (6.5 / e.split(" ").length) }})).filter((e) => e.some((e2) => window.innerHeight * (e2.delay - time.value) / 3.5 >= -30 && window.innerHeight * (e2.delay - time.value) / 3.5 <= window.innerHeight));
    })

    const tabindex = computed(() => {
        return visibleOverlay.value || Object.keys(data.value).length != 0 || Object.keys(selectedMapData.value).length != 0 || fileLoadError.value ? -1 : 0;
    })

    function calculateInputWidth(verseLength) { 
        sizeRefresh.value;
        return window.innerWidth / verseLength + "px";
    }

    function calculateTop(delay) {
        sizeRefresh.value;
        return window.innerHeight * delay / 3.5;
    }
    
    function onResize() {
        thinScreen.value = !window.matchMedia("(min-width: 40rem)").matches;
        sizeRefresh.value = !sizeRefresh.value;
        setTimeout(() => {
            stopSongSample();
        }, 0);
    }
    addEventListener("resize", onResize);    

    function onKeydown(e) {
        if (e.key == "Escape" && menu.value == "songList" && Object.keys(selectedMapData.value).length == 0 && !visibleOverlay.value && !fileLoadError.value) {
            menu.value = "main";
            song.value.pause();
        } else if ((e.key == "Escape" || e.key == "Enter") && visibleOverlay.value != "automap") {
            if (!highscoreResetWarning.value) {
                if (visibleOverlay.value == "loadingMap") {
                    mapDownloadAbortController.abort();
                }

                visibleOverlay.value = "";
                fileLoadError.value = "";

                setTimeout(() => {
                    document.activeElement.blur();
                }, 0);
            } else if (e.key == "Escape") {
                highscoreResetWarning.value = false;
            }
        }
    }
    addEventListener("keydown", onKeydown);

    function automapSetData(newData) {
        forceDefaultBackground.value = false;
        data.value = newData;
        visibleOverlay.value = "";   
    }

    function closeAutomap() {
        visibleOverlay.value = "";
        automapBackgroundImage.value = defaultBackground;
        automapHueRotate.value = 0;
    }

    function removeHighscores() {
        for (let key of JSON.parse(localStorage.getItem("highscores"))) {
            localStorage.removeItem(key);
        }
        localStorage.removeItem("highscores");
        highscoreResetWarning.value = false;
        settings.saveHighscores = false;
    }

    async function downloadMap(codeName) {
        document.activeElement.blur();

        if (Object.keys(preloadedMaps).length) {
            selectedMapData.value = preloadedMaps[codeName];
        } else {
            if (props.cachedMaps[codeName]) {
                selectedMapData.value = props.cachedMaps[codeName];
            } else {
                visibleOverlay.value = "loadingMap";
                const signal = mapDownloadAbortController.signal;
                    forceDefaultBackground.value = false;

                await fetch("maps/" + codeName + ".json", { signal: signal })
                    .then(async (response) => { 
                        selectedMapData.value = await response.json();
                        if (!settings.disableCaching) {
                            emit("cacheMap", codeName, selectedMapData.value);
                        }
                    })
                    .catch((e) => e.name == "AbortError" ? mapDownloadAbortController = new AbortController() : fileLoadError.value = e.name)
                    .finally(() => visibleOverlay.value = "");
            }
        }
    }

    function cancelMapDownload() {
        mapDownloadAbortController.abort();
        visibleOverlay.value = "";
    }

    function playSongSample(name) {
        if (Object.keys(selectedMapData.value).length == 0 && !mobile) {
            stopSongSample();
            song.value = new Audio(songSamples[name]);
            song.value.playbackRate = settings.defaultSpeed;
            song.value.preservesPitch = !settings.changeThePitch;
            song.value.play().catch(() => {});
        }
    }

    function stopSongSample() {
        if (!song.value.paused) {
            song.value.pause();
        }
    }
</script>   

<template>
    <div
        v-if="!(tabindex && thinScreen)"
        class="absolute left-0 top-0 z-5 max-w-screen"
    >
        <div class="relative right-4 bottom-2 bg-pink-500 font-bold text-5xl text-white [text-shadow:0.1em_0.06em_var(--color-violet-900)] skew-x-[-20deg] border-white border-4 border-l-0">
            <div class="border-violet-900 border-4 border-l-0 py-4 pr-8 pl-10">
                <p class="skew-x-5">Lyrhythmics</p>
            </div>
        </div>
    </div>

    <!-- background image -->
    <img
        class="fixed h-[calc(100vh+50px)] top-[-25px] w-screen object-cover select-none z-[-10]" 
        :src="forceDefaultBackground ?
                defaultBackground
                : visibleOverlay == 'automap' ?
                    automapBackgroundImage 
                    : Object.keys(data).length != 0 ?
                        data.backgroundImage
                        : Object.keys(selectedMapData).length != 0 ?
                            selectedMapData.backgroundImage
                            : defaultBackground"
        :style="{ filter: 'hue-rotate(' + (
            visibleOverlay == 'automap' ?
                automapHueRotate + 'deg)'
                : Object.keys(data).length != 0 && data.backgroundFilters.length && data.backgroundFilters[0].start == 0 ?
                    data.backgroundFilters[0].hue + 'deg) brightness(' + data.backgroundFilters[0].brightness / 100 + ')'
                    : Object.keys(selectedMapData).length != 0 && selectedMapData.backgroundFilters.length && selectedMapData.backgroundFilters[0].start == 0 ?
                        selectedMapData.backgroundFilters[0].hue + 'deg) brightness(' + selectedMapData.backgroundFilters[0].brightness / 100 + ')'
                        : '0deg)') }"
        @error="forceDefaultBackground = true"
        alt="Background"
        draggable="false"
    >

    <div 
        v-if="menu == 'main' && !(tabindex && thinScreen)"
        class="fixed w-screen h-dvh flex justify-end items-center z-3"
    >
        <nav 
            class="flex flex-col items-end max-h-full w-full gap-4 overflow-x-hidden pb-12 sm:pb-16 pt-26 sm:pt-6"
            :tabindex="tabindex"
        >
            <PinkButton 
                text="Song list"
                :tabindex="tabindex"
                @click="menu = 'songList'"
            />

            <PinkButton 
                text="Automap"
                :tabindex="tabindex"
                @click="visibleOverlay = 'automap'"
            />

            <PinkButton
                text="Map editor"
                :tabindex="tabindex"
                @click="mobile ? visibleOverlay = 'mobileWarning' : router.push('/editor')"
            />

            <PinkButton 
                text="Load map"
                :tabindex="tabindex"
                @click="askForFile()"
            />

            <PinkButton 
                text="Settings"
                :tabindex="tabindex"
                @click="visibleOverlay = 'settings'"
            />

            <PinkButton 
                text="About"
                :tabindex="tabindex"
                @click="visibleOverlay = 'about'"
            />
        </nav>
    </div>

    <div 
        v-else-if="!(tabindex && thinScreen)"
        class="fixed w-screen h-dvh flex flex-col items-center z-3"
    >
        <nav 
            class="flex flex-col items-end max-h-full gap-4 overflow-x-hidden pb-12 sm:pb-16 pt-26 sm:pt-6 w-full z-6"
            :tabindex="tabindex"
        >
            <PinkButton 
                v-for="map in maps.filter((e) => (commercial && e.commercialAllowed) || !commercial)"
                class="sm:max-w-175"
                :text="map.name"
                :bottomText="map.wpm + ' WPM | ' + (map.length >= 60 ? Math.floor(map.length / 60) + 'm ' : '') + (map.length % 60 != 0 ? Math.round(map.length % 60) + 's' : '') + (map.lyriclessLength ? ' - ' + (map.lyriclessLength >= 60 ? Math.floor(map.lyriclessLength / 60) + 'm ' : '') + (map.lyriclessLength % 60 != 0 ? Math.round(map.lyriclessLength % 60) + 's' : '') : '')"
                :tabindex="tabindex"
                @click="downloadMap(map.codeName)"
                @mouseenter="playSongSample(map.codeName)"
                @mouseleave="stopSongSample()"
            />
            
            <button 
                class="relative sm:left-28 w-full sm:w-auto"
                :tabindex="tabindex"
                @click="menu = 'main'"
            >
                <div 
                    class="w-full sm:w-auto cursor-pointer relative bg-white font-bold text-3xl text-violet-900 sm:skew-x-[-20deg] border-white border-y-3 border-x-0 sm:border-l-3 right-0 group hover:sm:scale-133 hover:sm:right-[20%] hover:sm:my-5 duration-300 text-center sm:text-right z-1"
                >
                    <div class="border-violet-900 border-y-3 border-x-0 sm:border-l-3 py-1.75 sm:pr-32 sm:pl-6">
                        <p class="skew-x-[-15deg] sm:skew-x-5">Back</p>
                    </div>
                </div>
            </button>

            <aside :class="config.enableFullscreenButton && !settings.hideFullscreenButton && !fullscreen ? 'sm:fixed text-white bottom-15 left-2 bg-black/[var(--bg-40)] py-1 px-2 sm:rounded-xl backdrop-blur-md z-7 w-full sm:w-193 sm:max-w-[calc(100%-750px)] min-w-50 text-center sm:text-left' : 'sm:fixed text-white bottom-2 left-2 bg-black/[var(--bg-40)] py-1 px-2 sm:rounded-xl backdrop-blur-md z-7 w-full sm:w-193 sm:max-w-[calc(100%-750px)] min-w-50 text-center sm:text-left'">
                This is the official list of mapped songs. Only songs with a license that allows using them are here. If you want to play a map with a song that isn't here, you can use the 
                <button
                    class="cursor-pointer text-pink-300 hover:text-pink-500 duration-100"
                    :tabindex="tabindex"
                    @click="visibleOverlay = 'automap'"
                >automap feature</button>. If you want a song to be added to this list, check the 
                <button
                    class="cursor-pointer text-pink-300 hover:text-pink-500 duration-100"
                    :tabindex="tabindex"
                    @click="visibleOverlay = 'about'"
                >about page</button> for information. More officially mapped songs coming soon!{{ commercial ? ' You\'re playing a version of this game without songs that forbid commercial use, the regular version has more songs.' : '' }}
            </aside>
        </nav>
    </div>

    <!-- from file -->
    <MapCustomization 
        v-if="Object.keys(data).length != 0"
        :data="data"
        @setData="(data) => $emit('setData', data)"
        @cancel="data = {}"
    />

    <!-- from song list -->
    <MapCustomization 
        v-if="Object.keys(selectedMapData).length != 0"
        :data="selectedMapData"
        @setData="(data) => $emit('setData', data)"
        @cancel="selectedMapData = {}"
    />

    <!-- automap, settings, about, changelog, mobile warning, loading map, file load errors -->
    <div
        v-if="visibleOverlay || fileLoadError"
        class="fixed left-0 w-screen h-dvh flex justify-center items-center text-white z-12"
    >   
        <div class="fixed w-screen h-dvh bg-black/[var(--bg-60)] backdrop-blur-xs"></div> 

        <div 
            v-if="visibleOverlay == 'automap'"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13"
        >
            <Automap 
                @hueRotateChanged="(newHueRotate) => automapHueRotate = newHueRotate"
                @backgroundImageChanged="(newBackgroundImage) => automapBackgroundImage = newBackgroundImage"
                @cancel="closeAutomap()"
                @setData="(newData) => automapSetData(newData)"
            />
        </div>

        <div 
            v-else-if="visibleOverlay == 'settings'"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13 text-center"
        >
            <PinkHeader 
                class="mb-[-4px]"
                text="Settings"
            />

            <div class="flex flex-row items-center mt-5 gap-3 max-w-full">
                <hr class="w-25 border-t-3">
                <h1 class="font-bold text-2xl">General</h1>
                <hr class="w-25 border-t-3">
            </div>

            <label 
                v-for="setting in booleanSettings.filter((e, idx) => e.displayName && idx >= 2 && !(Object.keys(preloadedMaps).length && e.codeName == 'disableCaching') && !(!config.enableFullscreenButton && e.codeName == 'hideFullscreenButton'))"
                class="flex flex-col items-center"
            >
                <h2 :class="setting.clarification ? 'font-bold text-xl mt-4' : 'font-bold text-xl mt-4 mb-2'">
                    {{ setting.displayName }}:
                </h2>
                
                <p 
                    v-if="setting.clarification"
                    class="mb-2"    
                >({{ setting.clarification }})</p>
                
                <input 
                    class="cursor-pointer"
                    type="checkbox"
                    v-model="settings[setting.codeName]"
                    :tabindex="highscoreResetWarning ? -1 : 0"
                >
            </label>

            <label class="flex flex-col items-center">
                <h2 class="font-bold text-xl mt-4">Target FPS:</h2>
                <p class="mb-2">(the FPS the game will try to run on)</p>
                <input 
                    class="input"
                    type="number"
                    min="20"
                    max="240"
                    v-model="settings.targetFPS"
                    :tabindex="highscoreResetWarning ? -1 : 0"
                    @change="(e) => e.target.value > 240 ? settings.targetFPS = 240 : e.target.value < 20 || isNaN(parseFloat(e.target.value)) ? settings.targetFPS = 20 : settings.targetFPS = Math.round(e.target.value)"
                >
            </label>

            <div class="flex flex-row items-center mt-8 gap-3 max-w-full">
                <hr class="w-25 border-t-3">
                <h1 class="font-bold text-2xl">Default map customization</h1>
                <hr class="w-25 border-t-3">
            </div>

            <SpeedSelector
                :defaultSpeed="settings.defaultSpeed"
                :tabindex="highscoreResetWarning ? -1 : 0"
                @changed="(newSpeed) => settings.defaultSpeed = newSpeed"
            />

            <label class="flex flex-col items-center">
                <h2 class="font-bold text-xl mt-4 mb-2">Skip parts without lyrics:</h2>
                <input 
                    class="cursor-pointer"
                    type="checkbox"
                    v-model="settings.skipLyricless"
                    :tabindex="highscoreResetWarning ? -1 : 0"
                >
            </label>

            <LyricsCustomization 
                variant="gamewide"
                :default="settings"
                :tabindex="highscoreResetWarning ? -1 : 0"
                :lyrics="[]"
                @settingChanged="(name, value) => settings[name] = value"
            />

            <label class="flex flex-col items-center">
                <h2 class="font-bold text-xl mt-4">Word length limit:</h2>
                <p class="mb-2">(0 means no limit)</p>
                <input 
                    class="input"
                    type="number"
                    min="0"
                    max="25"
                    v-model="settings.defaultWordLengthLimit"
                    :tabindex="highscoreResetWarning ? -1 : 0"
                    @change="(e) => e.target.value > 25 ? settings.defaultWordLengthLimit = 25 : e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? settings.defaultWordLengthLimit = 0 : settings.defaultWordLengthLimit = Math.round(e.target.value)"
                >
            </label>

            <label class="flex flex-col items-center">
                <h2 class="font-bold text-xl mt-4 mb-2">Autospace:</h2>
                <input 
                    class="cursor-pointer"
                    type="checkbox"
                    v-model="settings.autospaceByDefault"
                    :tabindex="highscoreResetWarning ? -1 : 0"
                >
            </label>

            <p class="mb-3 mt-7">
                When you change a setting it will be saved in your device's local storage.
                <br>Highscores will also be saved there if you enable them.
            </p>

            <button
                class="button"
                :tabindex="highscoreResetWarning ? -1 : 0"
                @click="visibleOverlay = ''"
            >Done</button>

            <div
                v-if="highscoreResetWarning"
                class="fixed left-0 top-0 w-screen h-dvh flex justify-center items-center text-white z-14"
            >   
                <div class="fixed w-screen h-dvh bg-black/[var(--bg-60)] backdrop-blur-xs"></div>
                
                <div class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13 text-center"> 
                    <h2 class="font-bold text-lg z-15">Warning!</h2>
                    <p class="z-15">
                        Disabling saving highscores will remove the highscores that you saved since you enabled it.
                        <br>Are you sure you want to remove them and disable saving highscores?
                    </p>

                    <div class="flex gap-3 mt-2.5">
                        <button
                            class="button"
                            @click="highscoreResetWarning = ''"
                        >Cancel</button>

                        <button
                            class="button"
                            @click="removeHighscores()"
                        >Confirm</button>
                    </div>
                </div>
            </div>
        </div>

        <div 
            v-else-if="visibleOverlay == 'about'"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto text-center z-13"
        >
            <PinkHeader text="About" />

            <h2 class="text-xl font-bold mb-1.5">Introduction</h2>
            <p class="max-w-275">
                Lyrhythmics is a game in which you type the lyrics of songs. It's made by k327, and it's free and open source software. On this page I will describe some aspects of the game that should be explained. First, for fast navigation there usually are keyboard shortcuts, either escape, enter or control + enter. {{ config.enableFullscreenButton ? "Although note that on most browsers pressing escape will also make you leave fullscreen if you're in fullscreen mode, and you will have to press escape again after that." : "" }} Secondly, you can go to the next verse if the second last word of the current one has passed and the next verse is visible. Simply press space while having the last word selected to do so, like you'd do to go to the next word. Although note that if you start typing the first word of that verse before the last one of the previous verse passes, that counts as starting typing early. Also, you can see the changelog of updates by clicking on the version number in the corner of the menu.
            </p>

            <h2 class="text-xl font-bold my-1.5">Score system</h2>
            <p class="max-w-275">
                The full score for a perfect word is 1, for a word with a typo it's 0.25, and for a wrong word it's 0. However that is later reduced by the timing. If you start typing during the word and finish before it passes, you get the entirety of that score. If you start typing a word early, that is before the earlier word passed, you get 75% of that score. Although only when the even earlier word has passed, but if that isn't the case, then that's starting typing a word very early, which gives even less score. You can also finish a word late, by the time the next word passes. In both of the cases you get 1/3 of the score. The score that you see is the percentage of how much score you got out of how much was possible to get. When a word passes, the input's color changes. Green is correct, yellow is typo, red is wrong. The brightest shade means perfectly on time, the darker shade is started typing early, and the darkest shade is finished late or started typing very early. Red doesn't have shades. If it's hard for you to differentiate between the colors, you can enable the "Additional word correctness feedback" setting which shows a text indicator on the right side of the input. V is correct, ~ means typo, X is wrong. v means very early, e means early, and l means late. A typo is when you either missed a letter, added an additional letter, typed one wrong letter, or swapped the places of two letters that are next to eachother. It also has to be on a word that has at least 3 characters. Examples on the word score: scre, scoire, sxore, scoer.
            </p>

            <h2 class="text-xl font-bold my-1.5">Song list</h2>
            <p class="max-w-275">
                There's a short description of it on its page, this is the part mostly about adding a song to the list. If you'd want a song with an appropriate license(for example Creative Commons with derivative works allowed) to be added here, you can tell me about it through either of my contact methods listed on 
                <a 
                    class="text-pink-300 hover:text-pink-500 duration-100"
                    href="https://k327.eu"
                >my personal website</a>{{ platform == "Newgrounds" || platform == "itch.io" ? " or here, on " + platform : "" }}. You can also map it yourself using the map editor, and send it to me to add it, but if you're going to be doing that with wanting it added here in mind, ask me first if the song is suitable for this game. Out of the topic of adding new songs, the first time on the buttons is the map length, and the second one after the minus is the length of lyricless parts. WPM = Words Per Minute(calculated excluding the lyricless parts).
            </p>

            <h2 class="text-xl font-bold my-1.5">Automap</h2>
            <p class="max-w-275">
                In addition to this description, there's some information on the automap page itself. Automap lets you bring a .srt, .vtt or .lrc file, or simply text lyrics, as well as a song file and turns it into a map for you. Just input the lyrics file or text lyrics, the song, and optionally other settings. In some cases browsers might get stuck at loading the song, in that case go back to the main menu, then again to automap and try again. If you input text lyrics and the song has parts that are just music without lyrics, make sure to add them to parts without lyrics. If you load the lyrics from a file, the verse delays are loaded from the file. Specific word delays are spread evenly through the verse, the first word is after the average duration of a word in that verse and not at the start time. If you input text lyrics, it spreads the lyrics in even distances through the entire song, except of the parts without lyrics. The distances are even through one part with lyrics, so the distance between words can be slightly different between the parts seperated by parts without lyrics. Before a part without lyrics there's free time that lasts half the length of a word. In addition to that, the parts without lyrics are actually 1 second shorter than you typed them on each side, to provide a transition. These two seconds don't have any lyrics, and are only there in automap without a lyrics file, so not in the proper map editor, although automap with a lyrics file also adds them if the lyricless parts are added by automap and not provided by you. As automap without a lyrics file just places the lyrics evenly without syncing them to the song, in case it gets really desynced it's your job to sync it. The shift + arrows song skipping is there for that. Of course if you upload a lyrics file that's not the case, but the lyrics offset can still be different and if it is then you have to set it, more information about that in the automap menu. If you want a map that's perfectly synced, you can use the map editor.
            </p>

            <h2 class="text-xl font-bold my-1.5">Map editor</h2>
            <p class="max-w-275">
                The map editor allows you to properly create maps. First, like in automap, add the song. After that, if the song has parts without lyrics, add them. In some cases browsers might get stuck at loading the song, in that case reopen the settings and try again. Then add the lyrics. While adding the lyrics you can use the delays based on the song length feature, which will spread the lyrics in even distances just like automap does it. You can also load a .srt, .vtt or .lrc file, you can find more information about them on the automap page from the main menu. You can also add individual verses later on if necessary. You can also change other settings, most of them are self-explainatory. Editor/playtesting settings are the ones that don't affect the exported version of the map, meaning they only apply in the editor including playtesting. One harder setting could be background filters, it allows you to make the background change its color and brightness as the song moves on. You can use the for testing part to try different values. For hue rotate the regular range is 0-360 but you can go beyond that for more advanced transition management, in that case the colors just loop, so for example 480 is the same as 120. Although minus values work like substracting from 360 and then the looping, so for example -90 = 270. There's also brightness which uses percentange. In the main view you can use the play song feature to see the sync of the lyrics in real time, and then adjust the lyrics. You can drag words to move them, stretch them using the element at the center of the border and move entire verses with the element at the left. You can hold shift while moving a verse to also move all the verses below the one you're moving. If you want to change the order of verses, you have to use the buttons at the right to switch the places of two verses. The exact time of the word is at the top of the bubble with it. It's meant to be when the word is finished being sang, or a bit before it. You can also switch to viewing background filters instead of lyrics to stretch and sync them to the song better. To do that click the BG Filters button, and to go back to lyrics click the button again. You can quickly add a new background filter by pressing the N key while in that view. You can playtest the level, and when it's finished - export it. If you're not done but have to go, you can export it, load it in the main menu later and select edit.
            </p>

            <button
                class="button mt-3"
                @click="visibleOverlay = ''"
            >Okay</button>
        </div>

        <div 
            v-else-if="visibleOverlay == 'changelog'"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13 text-center"
        >
            <PinkHeader text="Changelog" />

            <article v-for="release in releases">
                <h2 class="font-bold text-xl">v{{ release.version }} - {{ release.date }}</h2>
                <ul class="mb-4 list-disc flex flex-col items-center max-w-275 list-inside">
                    <li v-for="change in release.changes">
                        {{ change }}
                    </li>
                </ul>
            </article>

            <button
                class="button"
                @click="visibleOverlay = ''"
            >Okay</button>
        </div>

        <div 
            v-else-if="visibleOverlay == 'mobileWarning'"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13"
        >
            <PinkHeader text="Warning" />

            <p class="max-w-175 text-center px-2">
                The map editor doesn't work well on mobile, and it'd be hard to adapt it to make it do. And so, it is highly recommended to use it on a regular computer. Do you wish to continue on mobile anyway?
            </p>

            <div class="flex gap-3 mt-2.5">
                <button
                    class="button"
                    @click="visibleOverlay = ''"
                >Cancel</button>
                
                <button
                    class="button"
                    @click="router.push('/editor')"
                >Continue</button>
            </div>
        </div>

        <div 
            v-else-if="visibleOverlay == 'loadingMap'"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13"
        >
            <PinkHeader text="Loading map..." />

            <button
                class="button"
                @click="cancelMapDownload()"
            >Cancel</button>
        </div>

        <div 
            v-else-if="fileLoadError"
            class="flex flex-col items-center max-h-full w-full p-2 overflow-y-auto z-13"
        >
            <h2 class="font-bold text-lg">An error occured while loading the map.</h2>
            <p>{{ fileLoadError }}</p>
            <button
                class="button mt-2.5"
                @click="fileLoadError = ''"
            >Okay</button>
        </div>
    </div>

    <footer 
        v-if="!(tabindex && thinScreen)"
        class="fixed text-neutral-400 bottom-2 right-2 bg-black/[var(--bg-40)] py-1 px-2 rounded-xl backdrop-blur-md flex gap-1.5 z-5 font-bold"
    >
        <a 
            href="https://codeberg.org/k327/lyrhythmics"
            class="text-white hover:text-pink-300 duration-100"
            :tabindex="tabindex" 
        >Codeberg</a>
        |
        <a 
            href="https://github.com/kk327/lyrhythmics"
            class="text-white hover:text-pink-300 duration-100"
            :tabindex="tabindex"
        >Github</a>
        |
        <button
            class="cursor-pointer text-white hover:text-pink-300 duration-100"
            title="See the changelog."
            :tabindex="tabindex"
            @click="visibleOverlay = 'changelog'"
        >v{{ releases[0].version }}</button>
    </footer>

    <div v-if="!settings.disableBackgroundLyrics && !tabindex && !thinScreen">
        <div 
            v-for="verse in visibleLyrics"
            class="flex"
        >
            <div 
                v-for="lyric in verse" 
                :style="{ width: calculateInputWidth(verse.length) }"
            >
                <p
                    class="absolute select-none flex justify-center text-center break-words text-white"
                    :style="{ width: calculateInputWidth(verse.length), 
                              top: calculateTop(lyric.delay) - calculateTop(time) + 'px' }"
                >
                    <span class="bg-black/[var(--bg-40)] px-4 py-1.25 relative bottom-1 rounded-xl backdrop-blur-md max-w-full">
                        {{ lyric.word }}
                    </span>
                </p>
            </div>
        </div>
    </div>
</template>