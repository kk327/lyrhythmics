<script setup>
    import { ref, computed, onUnmounted, watchEffect } from "vue";
    import { useRouter } from "vue-router";
    import PinkHeader from '@/components/PinkHeader.vue';
    import SpeedSelector from "./SpeedSelector.vue";
    import LyricsCustomization from './LyricsCustomization.vue';
    
    const props = defineProps([
        "data",
        "pausedVariant"
    ]);

    const emit = defineEmits([
        "setData",
        "cancel",
        "continue"
    ]);

    const router = useRouter();

    const skipLyricless = ref((localStorage.getItem("skipLyricless") && props.data.partsWithoutLyrics.length && !props.pausedVariant) || (props.pausedVariant && props.data.skipLyricless) ? true : false);
    const autospace = ref((localStorage.getItem("autospaceByDefault") && !props.pausedVariant) || (props.pausedVariant && props.data.autospace));
    const startTime = ref(props.pausedVariant ? props.data.startTime : 0);

    const wordLengthLimit = ref(props.pausedVariant ? 
                                    props.data.wordLengthLimit 
                                    : localStorage.getItem("defaultWordLengthLimit") ?
                                        (localStorage.getItem("defaultWordLengthLimit") < Math.max( ...props.data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) ?
                                            localStorage.getItem("defaultWordLengthLimit")
                                            : Math.max( ...props.data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1)
                                        : 0);

    const speed = ref(props.pausedVariant ? 
                        props.data.speed
                        : localStorage.getItem("defaultSpeed") ? 
                            localStorage.getItem("defaultSpeed") 
                            : 1);
    
    const lyricsSettingList = ["capitalization", "accentLetters", "specialCharacters"];
    const lyricsSettings = ref(props.pausedVariant ? props.data.lyricsSettings : {});
    if (!props.pausedVariant) {
        for (let setting of lyricsSettingList) {
            lyricsSettings.value[setting] = localStorage.getItem(setting);
        }
    }

    const highscore = ref(0);

    let parsedAdditionalInfo = "";
    let i = 0;
    while (i < props.data.additionalInfo.length) {
        if (props.data.additionalInfo[i] != "<") {
            parsedAdditionalInfo += props.data.additionalInfo[i] == ">" ? "" : props.data.additionalInfo[i];
            i++;
        } else {
            let link = "";
            let linkText = "";

            while (i != props.data.additionalInfo.length && props.data.additionalInfo[i] != " ") {
                link += props.data.additionalInfo[i].match(/"|<|>/) ? "" : props.data.additionalInfo[i];
                i++;
            }
            i++;

            while (i < props.data.additionalInfo.length && props.data.additionalInfo[i] != ">") {
                linkText += props.data.additionalInfo[i].match(/"|</) ? "" : props.data.additionalInfo[i];
                i++;
            }
            parsedAdditionalInfo += `<a href="${link}" class="text-pink-300 hover:text-pink-500 duration-100">${linkText}</a>`;
        }
    }

    let controlHeld = false;
    let enterHeld = false;

    watchEffect(() => {
        highscore.value = localStorage.getItem(props.data.id + "-" + speed.value + "-" + startTime.value + "-" + skipLyricless.value + "-" + lyricsSettingList.map((e) => lyricsSettings.value[e] ? '1' : '0').join("") + (wordLengthLimit.value ? "-wll" + wordLengthLimit.value : ""));
    });

    const mapLength = computed(() => {
        return props.data.lyrics[props.data.lyrics.length - 1][props.data.lyrics[props.data.lyrics.length - 1].length - 1].delay;
    });

    const timeWithoutLyrics = computed(() => {
        return props.data.partsWithoutLyrics.reduce((sum, e) => sum + 
            (e.start > mapLength.value ? 
                0 
                : e.end > mapLength.value ?
                    mapLength.value - e.start
                    : e.end - e.start), 
        0);
    });

    onUnmounted(() => {
        removeEventListener("keydown", onKeyDown);
        removeEventListener("keyup", onKeyUp);
    });

    function onKeyDown(e) {
        if (e.key == "Enter") {
            enterHeld = true;
        } else if (e.key == "Control") {
            controlHeld = true;
        } else if (e.key == "Escape" && !props.pausedVariant) {
            emit("cancel");
        }

        if (controlHeld && enterHeld) {
            if (props.pausedVariant) {
                emit("continue");
            } else {
                emit("setData", buildNewData());
                router.push("/play");
            }
        }
    }
    addEventListener("keydown", onKeyDown);

    function onKeyUp(e) {
        if (e.key == "Enter") {
            enterHeld = false;
        } else if (e.key == "Control") {
            controlHeld = false;
        }
    }
    addEventListener("keyup", onKeyUp);

    function buildNewData() {
        return { ...props.data,
                    speed: speed.value,
                    startTime: startTime.value,
                    skipLyricless: skipLyricless.value,
                    lyricsSettings: lyricsSettings.value,
                    wordLengthLimit: wordLengthLimit,
                    autospace: autospace.value };
    }

    function redirectAndSetData(link, data) {
        emit("setData", data);
        router.push(link);
    }

    function downloadMap() {
        const blob = new Blob([JSON.stringify({ ...props.data, downloadButton: false })], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (props.data.name ? props.data.name : "Unnamed Lyrhythmics map") + ".json";
        a.click();
    }
</script>

<template>
    <div class="fixed w-screen h-screen bg-black/60 z-9 backdrop-blur-xs"></div>
    <div class="fixed w-screen h-screen z-10 flex justify-center items-center text-white">   
        <div class="flex flex-col items-center max-h-full w-full py-2 overflow-y-auto">
            <h1
                v-if="pausedVariant"
                class="font-bold text-2xl mb-2 tracking-wider"
            >|| Paused</h1>
            
            <PinkHeader :text="data.name ? data.name : 'Unnamed map'" />

            <div class="flex gap-6">
                <p>Mapped by: {{ data.mapper ? data.mapper : "unknown" }}</p>
                <p>Length: {{ mapLength ? (mapLength >= 60 ? Math.floor(mapLength / 60) + "m " : "") + (mapLength % 60 != 0 ? Math.round(mapLength % 60) + "s" : "") : "0s" }}</p>
                <p>WPM: {{ Math.round(data.lyrics.reduce((sum, e) => sum + e.length, 0) / (mapLength - timeWithoutLyrics) * 60) }}</p>
            </div>

            <div 
                v-if="!pausedVariant"
                class="flex gap-3 mt-2.5 items-center"
            >
                <button
                    v-if="data.downloadButton"
                    class="button h-fit"
                    @click="downloadMap()"
                >
                    Download
                </button>

                <button
                    class="button h-fit"
                    @click="redirectAndSetData('/editor', buildNewData())"
                >
                    Edit
                </button>
                
                <button
                    class="button not-hover:border-pink-500 text-pink-500 bg-white px-8 text-xl"
                    @click="redirectAndSetData('/play', buildNewData())"
                >
                    Play
                </button>
                
                <button
                    class="button h-fit"
                    @click="$emit('cancel')"
                >
                    Cancel
                </button>
            </div>

            <div 
                v-else
                class="flex gap-3 mt-2.5 items-center"
            >
                <button
                    v-if="data.downloadButton"
                    class="button h-fit"
                    @click="downloadMap()"
                >
                    Download
                </button>

                <button
                    class="button h-fit"
                    @click="redirectAndSetData('/', {})"
                >
                    Main menu
                </button>
                
                <button
                    to="/play"
                    class="button not-hover:border-pink-500 text-pink-500 bg-white px-8 text-xl"
                    @click="$emit('continue')"
                >
                    Continue
                </button>
                
                <button
                    class="button h-fit mr-4"
                    @click="$emit('setData', buildNewData())"
                >
                    Restart
                </button>
            </div>

            <p
                v-if="highscore"
                class="mt-3"
            >
                Highscore on those settings: 
                <b>{{ highscore }}%</b>
            </p>

            <p
                v-if="parsedAdditionalInfo"
                :class="highscore ? 'text-center mt-1 whitespace-pre-wrap' : 'text-center mt-3 whitespace-pre-wrap'" 
                v-html="parsedAdditionalInfo"
            ></p>

            <h1 :class="parsedAdditionalInfo ? 'text-2xl font-bold mt-3' : 'text-2xl font-bold mt-5'">{{ pausedVariant ? "Restart settings: " : "Settings:"}}</h1>

            <SpeedSelector
                :defaultSpeed="speed"
                @changed="(newSpeed) => speed = newSpeed"
            />

            <label class="text-center">
                <h2 class="font-bold text-xl mt-4 mb-2">Start time:</h2>
                <input 
                    class="input min-w-27.5"
                    type="number"
                    min="0"
                    :max="Math.round((mapLength - 0.1) * 100) / 100 > 0 ? Math.round((mapLength - 0.1) * 100) / 100 : 0"
                    v-model="startTime"
                    @change="(e) => startTime > Math.round((mapLength - 0.1) * 100) / 100 ? startTime = (Math.round((mapLength - 0.1) * 100) / 100 > 0 ? Math.round((mapLength - 0.1) * 100) / 100 : 0) : e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? startTime = 0 : {}"
                >
            </label>

            <label 
                v-if="timeWithoutLyrics && !data.forceskip"
                class="flex flex-col items-center"
            >
                <h2 class="font-bold text-xl mt-4 mb-2">Skip parts without lyrics:</h2>
                <input 
                    class="cursor-pointer"
                    type="checkbox"
                    v-model="skipLyricless"
                >
            </label>
            <p 
                v-if="timeWithoutLyrics && !data.forceskip"
                class="mt-2"
            >
                This map has {{ (timeWithoutLyrics >= 60 ? Math.floor(timeWithoutLyrics / 60) + "m " : "") + (timeWithoutLyrics % 60 != 0 ? Math.round(timeWithoutLyrics % 60) + "s" : "") }} without lyrics.
            </p>
            
            <LyricsCustomization 
                variant="mapCustomization"
                :default="lyricsSettings"
                :lyrics="data.lyrics"
                @settingChanged="(name, value) => lyricsSettings[name] = value"
            />

            <label class="text-center">
                <h2 class="font-bold text-xl mt-4">Word length limit:</h2>
                <p class="mb-2">(0 means no limit)</p>
                <input 
                    class="input min-w-27.5"
                    type="number"
                    min="0"
                    :max="Math.max( ...data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1"
                    v-model="wordLengthLimit"
                    @change="(e) => wordLengthLimit > Math.max( ...data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1 ? wordLengthLimit = Math.max( ...data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1 : e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? wordLengthLimit = 0 : {}"
                >
            </label>
        
            <label :class="data.forceskip ? 'flex flex-col items-center' : 'flex flex-col items-center mb-1'">
                <h2 class="font-bold text-xl mt-4">Autospace:</h2>
                <p class="mb-2 max-w-125 text-center">(automatically goes to the next word when you type a word correctly or the current word passes. Whether this is easier is a preference)</p>
                <input 
                    class="cursor-pointer"
                    type="checkbox"
                    v-model="autospace"
                >
            </label>

            <p 
                v-if="data.forceskip"
                class="mt-4"
            >This map skips {{ data.partsWithoutLyrics.length == 1 ? 'a part' : 'parts' }} of the song. Time-wise, {{ (timeWithoutLyrics >= 60 ? Math.floor(timeWithoutLyrics / 60) + "m " : "") + (timeWithoutLyrics % 60 != 0 ? Math.round(timeWithoutLyrics % 60) + "s" : "") }} of it.</p>
        </div>
    </div>
</template>