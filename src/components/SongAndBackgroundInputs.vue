<script setup>
    import { ref, watch, onMounted, onUnmounted } from 'vue';
    import defaultBackground from '@/assets/background.png'

    const props = defineProps([
        "tabindex",
        "defaultBackgroundImage",
        "defaultSong",
        "minDuration"
    ]);

    const emit = defineEmits([
        "backgroundImageSet",
        "songLoaded"
    ]);

    const song = ref("");
    const audio = ref(new Audio());
    const songDuration = ref(0);
    const songName = ref("");
    const backgroundImage = ref(props.defaultBackgroundImage ? props.defaultBackgroundImage : defaultBackground);
    const targetFPS = localStorage.getItem("targetFPS") ? localStorage.getItem("targetFPS") : 60;

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

            audio.value = new Audio(song.value);
            await audio.value.play();
            audio.value.pause();

            audio.value.addEventListener("pause", () => {
                playingSong.value = false;
            });

            audio.value.addEventListener("play", () => {
                playingSong.value = true;
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
                    }
                    clearInterval(attemptInterval);  
                }
            }, 1000 / targetFPS);
        } catch {
            songStatus.value = "Failed to load song.";
            audio.value = songBackup;
        }
    });

    onMounted(() => { // so that the watcher reacts
        if (props.defaultSong) { 
            song.value = props.defaultSong;
        }
    });

    onUnmounted(() => {
        stopSong();
    });

    watch(backgroundImage, () => {
        emit("backgroundImageSet", backgroundImage.value);
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

        audio.value.currentTime = songPosition.value;
        audio.value.play();
        
        positionUpdateInterval = setInterval(() => {
            if (audio.value.currentTime >= songDuration.value) {
                clearInterval(positionUpdateInterval);
                songPosition.value = 0;
                playingSong.value = false;
            } else {
                songPosition.value = audio.value.currentTime;
            }
        }, 1000 / targetFPS);
    }

    function stopSong() {
        audio.value.pause();
        clearInterval(positionUpdateInterval);
    }
</script>

<template>
    <h2 class="font-bold text-xl mt-4 mb-2">Song:</h2>
    <label>
        From file:
        <input 
            class="button py-1 font-normal ml-1 mb-1.5"
            type="file"
            accept="audio/*"
            :tabindex="tabindex"
            @change="(e) => loadFromFile(e.target.files[0], false)"
        >
    </label>
    <label>
        From link:
        <input 
            class="input ml-1"
            type="text"
            :tabindex="tabindex"
            @change="(e) => song = e.target.value" 
        >
    </label>

    <p 
        v-if="songStatus"
        class="mt-2"
    >{{ songStatus }}</p>

    <section class="flex gap-3 items-center mt-2">
        <section 
            class="flex flex-col items-center font-bold has-disabled:text-neutral-400 has-disabled:cursor-not-allowed"
            :title="!songDuration ? 'Add a song first.' : ''"
        >
            {{ (Math.round(songPosition * 100) / 100).toFixed(2) + "s / " + songDuration }}s
            <input 
                class="w-100 disabled:cursor-not-allowed"
                type="range"
                min="0"
                step="0.01"
                v-model="songPosition"
                :max="songDuration"
                :disabled="!songDuration"
                :tabindex="tabindex"
                @input="playSong()"
            >
        </section>

        <button
            class="button"
            :disabled="!songDuration"
            :tabindex="tabindex"
            :title="!songDuration ? 'Add a song first.' : ''"
            @click="playingSong ? stopSong() : playSong()"
        >{{ playingSong ? 'Stop song' : 'Play song' }}</button>
    </section>

    <h2 class="font-bold text-xl mt-4 mb-2">Background image:</h2>
    <label>
        From file:
        <input 
            class="button py-1 font-normal ml-1 mb-1.5"
            type="file"
            accept="image/*"
            :tabindex="tabindex"
            @change="(e) => loadFromFile(e.target.files[0], true)"
        >
    </label>
    <label>
        From link:
        <input 
            class="input ml-1"
            type="text"
            :tabindex="tabindex"
            @change="(e) => backgroundImage = e.target.value" 
        >
    </label>
    <button
        class="button mt-1.5"
        :disabled="backgroundImage == defaultBackground"
        :tabindex="tabindex"
        :title="backgroundImage == defaultBackground ? 'This map uses the default background already.' : ''"
        @click="backgroundImage = defaultBackground"
    >Reset to default</button>
</template>