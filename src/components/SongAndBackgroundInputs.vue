<script setup>
    import { ref, watch, watchEffect, onMounted, onUnmounted } from 'vue';
    import config from "@/configs/config.json";

    const props = defineProps([
        "tabindex",
        "defaultBackground", // background.png
        "defaultBackgroundImage",
        "defaultSong",
        "defaultIncludeTheBackground",
        "minDuration",
        "backgroundImageTheme"
    ]);

    const emit = defineEmits([
        "backgroundImageSet",
        "songLoaded",
        "includeTheBackgroundChanged"
    ]);

    const song = ref("");
    const audio = ref(new Audio());
    const songDuration = ref(0);
    const songName = ref("");
    const targetFPS = localStorage.getItem("targetFPS") ?? 60;

    const theme = localStorage.getItem("theme") ? JSON.parse(localStorage.getItem("theme")) : config.defaultTheme;
    const defaultBackgroundImage = theme.backgroundImage == "default" ? props.defaultBackground : theme.backgroundImage;
    const backgroundImage = ref(props.defaultBackgroundImage);
    const includeTheBackground = ref(props.defaultIncludeTheBackground);

    const songPosition = ref(0);
    const playingSong = ref(false);
    const songStatus = ref("");
    let positionUpdateInterval;

    watch(song, async () => {
        songStatus.value = "Loading song...";
        const songBackup = audio.value;

        try {
            if (!audio.value.paused) {
                audio.value.pause();
            }
            
            if (audio.value.duration) {
                audio.value.currentTime = audio.value.duration;
            }

            audio.value = new Audio(song.value);
            await audio.value.play();
            audio.value.pause();

            audio.value.addEventListener("pause", () => {
                playingSong.value = false;
            });

            audio.value.addEventListener("play", () => {
                playingSong.value = true;
                audio.value.currentTime = songPosition.value;
                    
                positionUpdateInterval = setInterval(() => {
                    if (audio.value.currentTime >= songDuration.value) {
                        clearInterval(positionUpdateInterval);
                        songPosition.value = 0;
                        playingSong.value = false;
                    } else {
                        songPosition.value = audio.value.currentTime;
                    }
                }, 1000 / targetFPS);
            });

            let attemptInterval = setInterval(() => {
                if (audio.value.duration != Infinity) {
                    if (props.minDuration && audio.value.duration < props.minDuration) {
                        audio.value = songBackup;
                        songStatus.value = "Failed. There are parts without lyrics or background effects after the end of the new song.";
                    } else {
                        songStatus.value = "";
                        songDuration.value = Math.floor(audio.value.duration * 100) / 100;
                        emit("songLoaded", song.value, audio.value, songDuration.value, songName.value);
                        songPosition.value = 0;
                    }
                    clearInterval(attemptInterval);  
                }
            }, 1000 / targetFPS);
        } catch {
            songStatus.value = "Failed to load song.";
            audio.value = songBackup;
        }
    });

    watch(backgroundImage, () => {
        emit("backgroundImageSet", backgroundImage.value);
        includeTheBackground.value = false;
        emit("includeTheBackgroundChanged", includeTheBackground.value);
    });

    watch(includeTheBackground, () => {
        if (!includeTheBackground.value && props.defaultBackground == backgroundImage.value && theme.backgroundImage != "default") {
            backgroundImage.value = theme.backgroundImage;
        }
    });

    watchEffect(() => {
        if (backgroundImage.value != props.defaultBackgroundImage) {
            backgroundImage.value = props.defaultBackgroundImage;
        }
    });

    onMounted(() => { // so that the watcher reacts
        if (props.defaultSong) { 
            song.value = props.defaultSong;
        }
    });

    onUnmounted(() => {
        stopSong();
        if (audio.value.duration) {
            audio.value.currentTime = audio.value.duration;
        }
    });

    function loadFromFile(file, toBackground) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (toBackground) {
                if (file.type.includes("image")) {
                    backgroundImage.value = e.target.result;
                }
            } else {
                if (file.type.includes("audio")) {
                    song.value = e.target.result;
                    songName.value = file.name.split(".").slice(0, -1).join(".");
                }
            }
        };
        reader.readAsDataURL(file);
    }

    function playSong() {
        if (songPosition.value != -1) {
            stopSong();
        }
        audio.value.play();
    }

    function stopSong() {
        audio.value.pause();
        clearInterval(positionUpdateInterval);
    }
</script>

<template>
    <div v-if="!backgroundImageTheme">
        <h2 class="font-bold text-xl mt-4 mb-2">Song</h2>
        <label class="flex flex-row items-center gap-2 flex-wrap justify-center mb-1.5">
            From file:
            <input 
                class="button py-1 font-normal max-w-[calc(100vw-16px)]"
                type="file"
                accept="audio/*"
                :tabindex="tabindex"
                @change="(e) => loadFromFile(e.target.files[0], false)"
            >
        </label>
        <label class="flex flex-row items-center gap-2 flex-wrap justify-center">
            From link:
            <input 
                class="input"
                type="text"
                :tabindex="tabindex"
                @change="(e) => song = e.target.value" 
            >
        </label>

        <p 
            v-if="songStatus"
            class="mt-2"
        >{{ songStatus }}</p>

        <div class="flex gap-3 flex-wrap justify-center mt-2">
            <div 
                class="flex flex-col items-center font-bold has-disabled:text-neutral-400 has-disabled:cursor-not-allowed"
                :title="!songDuration ? 'Add a song first.' : ''"
            >
                {{ (Math.round(songPosition * 100) / 100).toFixed(2) + "s / " + songDuration }}s
                <input 
                    class="w-100 max-w-[calc(100vw-16px)] disabled:cursor-not-allowed"
                    type="range"
                    min="0"
                    step="0.01"
                    v-model="songPosition"
                    :max="songDuration"
                    :disabled="!songDuration"
                    :tabindex="tabindex"
                    @input="playSong()"
                >
            </div>

            <button
                class="button"
                :disabled="!songDuration"
                :tabindex="tabindex"
                :title="!songDuration ? 'Add a song first.' : ''"
                @click="playingSong ? stopSong() : playSong()"
            >{{ playingSong ? 'Stop song' : 'Play song' }}</button>
        </div>
    </div>

    <h2 :class="backgroundImageTheme ? 'font-bold text-xl mt-4' : 'font-bold text-xl mt-4 mb-2'">Background image</h2>
    <p 
        v-if="backgroundImageTheme"
        class="mb-2"
    >(applies in the main menu and in maps that use the default background)</p>

    <label class="flex flex-row items-center gap-2 flex-wrap justify-center mb-1.5">
        From file:
        <input 
            class="button py-1 font-normal max-w-[calc(100vw-16px)]"
            type="file"
            accept="image/*"
            :tabindex="tabindex"
            @change="(e) => loadFromFile(e.target.files[0], true)"
        >
    </label>
    <label class="flex flex-row items-center gap-2 flex-wrap justify-center">
        From link:
        <input 
            class="input"
            type="text"
            :tabindex="tabindex"
            @change="(e) => backgroundImage = e.target.value" 
        >
    </label>

    <button
        class="button mt-1.5"
        :disabled="backgroundImageTheme ? backgroundImage == defaultBackground : backgroundImage == defaultBackgroundImage"
        :tabindex="tabindex"
        :title="(backgroundImageTheme ? backgroundImage == defaultBackground : backgroundImage == defaultBackgroundImage) ? 'This ' + (backgroundImageTheme ? 'theme' : 'map') + ' uses the default background already.' : ''"
        @click="backgroundImageTheme ? backgroundImage = defaultBackground : backgroundImage = defaultBackgroundImage"
    >Reset to default</button>

    <label 
        v-if="!backgroundImageTheme && (backgroundImage == defaultBackgroundImage || backgroundImage == defaultBackground)"
        :class="!includeTheBackground ? 'cursor-pointer text-neutral-200 duration-200 mt-1' : 'cursor-pointer duration-200 mt-1'"
    >
        <input 
            class="mr-1 cursor-pointer disabled:cursor-not-allowed"
            :style="{ 'filter': !includeTheBackground ? 'brightness(0.85)' : '' }"
            type="checkbox"
            v-model="includeTheBackground"
            @change="$emit('includeTheBackgroundChanged', includeTheBackground)"
        >
        {{ defaultBackground != backgroundImage ? 'Include the background image from your theme in the map' : 'Force the default background image' }}
    </label>
</template>