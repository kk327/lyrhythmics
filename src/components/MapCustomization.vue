<script setup>
    import { ref, computed, onUnmounted, watch, watchEffect } from "vue";
    import { useRouter } from "vue-router";
    import config from "@/configs/config.json";
    import PinkHeader from '@/components/PinkHeader.vue';
    import SpeedSelector from "./SpeedSelector.vue";
    import LyricsCustomization from './LyricsCustomization.vue';
    import MenuPanel from './MenuPanel.vue';
    import Switch from './Switch.vue';
    
    const props = defineProps([
        "data",
        "defaultBackground",
        "pausedVariant",
        "continuedWithSettings",
        "dontAnimateTheBackground"
    ]);

    const emit = defineEmits([
        "setData",
        "cancel",
        "continue",
        "showMobileWarning"
    ]);

    const router = useRouter();

    const skipLyricless = ref((localStorage.getItem("skipLyricless") && props.data.partsWithoutLyrics.length && !props.pausedVariant) || (props.pausedVariant && props.data.skipLyricless) ? true : false);
    const autospace = ref((localStorage.getItem("autospaceByDefault") && !props.pausedVariant) || (props.pausedVariant && props.data.autospace) ? true : false);
    const freeVerseChanging = ref((localStorage.getItem("freeVerseChangingByDefault") && !props.pausedVariant) || (props.pausedVariant && props.data.freeVerseChanging) ? true : false);
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
                        : localStorage.getItem("defaultSpeed") ?? 1);
    
    const lyricsSettingList = ["capitalization", "accentLetters", "specialCharacters"];
    const lyricsSettings = ref(props.pausedVariant ? JSON.parse(JSON.stringify(props.data.lyricsSettings)) : {});
    if (!props.pausedVariant) {
        for (let setting of lyricsSettingList) {
            lyricsSettings.value[setting] = localStorage.getItem(setting);
        }
    }

    const highscore = ref(0);
    const continueWithSettings = ref(localStorage.getItem("continueWithRestartSettings") || props.continuedWithSettings);
    const saveHighscores = ref(localStorage.getItem("saveHighscores"));

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

    const theme = localStorage.getItem("theme") ? JSON.parse(localStorage.getItem("theme")) : config.defaultTheme;
    const mobile = navigator.userAgent.match(/Android|iPhone|iPad/);
    const visibleMoreInfo = ref("");

    watch(visibleMoreInfo, () => {
        if (visibleMoreInfo.value) {
            document.activeElement.blur();
        }
    });

    watchEffect(() => {
        highscore.value = localStorage.getItem(props.data.id + "-" + speed.value + "-" + startTime.value + "-" + skipLyricless.value + "-" + lyricsSettingList.map((e) => lyricsSettings.value[e] ? '1' : '0').join("") + (wordLengthLimit.value ? "-wll" + wordLengthLimit.value : "") + (autospace.value ? "-as" : "") + (freeVerseChanging.value ? "-fvc" : ""));
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

    const restartSettingsChanged = computed(() => {
        return props.pausedVariant && (props.data.speed != speed.value || props.data.skipLyricless != skipLyricless.value || JSON.stringify(Object.values(props.data.lyricsSettings).map((e) => e ? true : false)) != JSON.stringify(Object.values(lyricsSettings.value).map((e) => e ? true : false)) || props.data.wordLengthLimit != wordLengthLimit.value || props.data.autospace != autospace.value || props.data.freeVerseChanging != freeVerseChanging.value);
    });

    onUnmounted(() => {
        removeEventListener("keydown", onKeyDown);
        removeEventListener("keyup", onKeyUp);
    });

    function onKeyDown(e) {
        if (e.key == "Enter") {
            enterHeld = true;

            if (visibleMoreInfo.value) {
                visibleMoreInfo.value = "";
                return;
            }
        } else if (e.key == "Control") {
            controlHeld = true;
        } else if (e.key == "Escape") {
            if (visibleMoreInfo.value) {
                visibleMoreInfo.value = "";
            } else if (props.pausedVariant) {
                emit("continue", continueWithSettings.value && restartSettingsChanged ? buildNewData(false) : {});
            } else {
                emit("cancel");
            }
        }

        if (controlHeld && enterHeld) {
            if (props.pausedVariant) {
                emit("continue", continueWithSettings.value && restartSettingsChanged ? buildNewData(false) : {});
            } else {
                emit("setData", buildNewData(true));
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

    function buildNewData(overrideBackgroundFilters) {
        return { ...props.data,
                    speed: speed.value,
                    startTime: startTime.value,
                    skipLyricless: skipLyricless.value,
                    lyricsSettings: lyricsSettings.value,
                    wordLengthLimit: wordLengthLimit.value,
                    autospace: autospace.value,
                    freeVerseChanging: freeVerseChanging.value,
                    backgroundFilters: !props.data.backgroundFilters.length && overrideBackgroundFilters && props.data.backgroundImage == "default" ? [{ start: 0, hue: theme.backgroundHueRotate, brightness: 100, transitionDuration: 0}] : props.data.backgroundFilters,
                    backgroundImage: props.data.backgroundImage == "forcedDefault" ? 
                                        props.defaultBackground
                                        : props.data.backgroundImage == "default" ? 
                                            (theme.backgroundImage == "default" ? 
                                                props.defaultBackground
                                                : theme.backgroundImage)
                                            : props.data.backgroundImage };
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
    <MenuPanel :animationVariant="dontAnimateTheBackground ? 'withoutBackground' : ''">
        <h1
            v-if="pausedVariant"
            class="font-bold text-2xl mb-2 tracking-wider relative bottom-0.75"
        >|| Paused</h1>
            
        <PinkHeader :text="data.name ? data.name : 'Unnamed map'" />

        <div class="flex gap-6">
            <p>Mapped by: {{ data.mapper ? data.mapper : "unknown" }}</p>
            <p>Length: {{ mapLength ? (mapLength >= 60 ? Math.floor(mapLength / 60) + "m " : "") + (mapLength % 60 != 0 ? Math.round(mapLength % 60) + "s" : "") : "0s" }}</p>
            <p>WPM: {{ 
                Math.round(60 * data.lyrics.reduce((sum, e) => sum + e.length, 0) / data.lyrics.reduce((sum, e, idx) => sum + 
                    (e.length == 1 ? 
                        idx == 0 && e[0].delay < 3.5 ?
                            e[0].delay
                            : idx != 0 && e[0].delay - data.lyrics[idx - 1][data.lyrics[idx - 1].length - 1].delay < 3.5 ?
                                e[0].delay - data.lyrics[idx - 1][data.lyrics[idx - 1].length - 1].delay
                                : 3.5
                        : e[e.length - 1].delay - e[0].delay + 
                            (idx != 0 && e[0].delay - data.lyrics[idx - 1][data.lyrics[idx - 1].length - 1].delay < (e[e.length - 1].delay - e[0].delay) / e.length * 1.5 && e[0].delay - data.lyrics[idx - 1][data.lyrics[idx - 1].length - 1].delay < 3.5 ?
                                e[0].delay - data.lyrics[idx - 1][data.lyrics[idx - 1].length - 1].delay
                                : (e[e.length - 1].delay - e[0].delay) / e.length * 1.5 < 3.5 ?
                                    (e[e.length - 1].delay - e[0].delay) / e.length * 1.5
                                    : 3.5)
                ), 0)) }}
            </p>
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
                @click="mobile ? $emit('showMobileWarning', buildNewData(false)) : redirectAndSetData('/editor', { ...buildNewData(false), defaultBackground: props.data.backgroundImage.match(/default|forcedDefault/) ?? '' })"
            >
                Edit
            </button>
                
            <button
                class="button border-[var(--themableWhite)] not-hover:border-pink-500 text-pink-500 bg-[var(--themableWhite)] px-8 text-xl"
                @click="redirectAndSetData('/play', buildNewData(true))"
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
                class="button border-[var(--themableWhite)] not-hover:border-pink-500 text-pink-500 bg-[var(--themableWhite)] px-8 text-xl"
                @click="$emit('continue', continueWithSettings && restartSettingsChanged ? buildNewData(false) : {})"
            >
                Continue
            </button>
                
            <button
                :class="data.downloadButton ? 'button h-fit' : 'button h-fit sm:mr-4'"
                @click="$emit('setData', buildNewData(false))"
            >
                Restart
            </button>
        </div>

        <p 
            v-if="props.continuedWithSettings"
            class="mt-3 text-center"
        >You've continued with restart settings, highscores are disabled.</p>
        <label 
            v-else-if="pausedVariant && restartSettingsChanged"
            class="cursor-pointer mt-3 text-center"
        >
            <input 
                class="mr-1 cursor-pointer disabled:cursor-not-allowed"
                type="checkbox"
                v-model="continueWithSettings"
            >
            Continue with restart settings (disables highscores)
        </label>

        <p
            v-if="saveHighscores && highscore && !props.continuedWithSettings && !restartSettingsChanged"
            class="mt-3"
        >
            Highscore on those settings: 
            <b>{{ highscore }}%</b>
        </p>
        <p 
            v-else-if="saveHighscores && !props.continuedWithSettings && !restartSettingsChanged"
            class="mt-3"
        >
            No highscore on those settings yet.
        </p>

        <p 
            v-if="data.forceskip"
            :class="saveHighscores || props.continuedWithSettings || restartSettingsChanged ? 'mt-1' : 'mt-3'"
        >This map skips {{ data.partsWithoutLyrics.length == 1 ? 'a part' : 'parts' }} of the song. Time-wise, {{ (timeWithoutLyrics >= 60 ? Math.floor(timeWithoutLyrics / 60) + "m " : "") + (timeWithoutLyrics % 60 != 0 ? Math.round(timeWithoutLyrics % 60) + "s" : "") }} of it.</p>

        <p
            v-if="parsedAdditionalInfo"
            :class="saveHighscores || props.continuedWithSettings || restartSettingsChanged || data.forceskip ? 'text-center mt-1 whitespace-pre-wrap' : 'text-center mt-3 whitespace-pre-wrap'" 
            v-html="parsedAdditionalInfo"
        ></p>

        <div class="flex flex-row items-center mt-3 gap-3 max-w-full">
            <hr class="w-25 border-t-3">
            <h1 class="font-bold text-2xl">{{ pausedVariant ? "Restart settings " : "Settings" }}</h1>
            <hr class="w-25 border-t-3">
        </div>

        <SpeedSelector
            :defaultSpeed="speed"
            @changed="(newSpeed) => speed = newSpeed"
        />

        <div class="flex justify-center flex-wrap max-w-160 text-center">
            <label :class="(!timeWithoutLyrics || data.forceskip) && data.lyrics.some((e) => e.some((e2) => e2.word.toLowerCase().replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/Ø/g, 'O').replace(/ø/g, 'o').normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\P{Letter}/gu, '') != e2.word)) ? 'w-80.25' : 'w-80'">
                <h2 class="font-bold text-xl mt-4 mb-2">Start time</h2>
                <input 
                    class="input min-w-27.5"
                    type="number"
                    min="0"
                    :max="Math.round((mapLength - 0.1) * 100) / 100 > 0 ? Math.round((mapLength - 0.1) * 100) / 100 : 0"
                    v-model="startTime"
                    @change="(e) => startTime > Math.round((mapLength - 0.1) * 100) / 100 ? startTime = (Math.round((mapLength - 0.1) * 100) / 100 > 0 ? Math.round((mapLength - 0.1) * 100) / 100 : 0) : e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? startTime = 0 : {}"
                >
            </label>

            <div 
                v-if="timeWithoutLyrics && !data.forceskip"
                class="w-80 flex justify-center"
            >
                <Switch
                    :initialValue="skipLyricless"
                    labelText="Skip parts without lyrics"
                    :labelBottomText="'this map has ' + (timeWithoutLyrics >= 60 ? Math.floor(timeWithoutLyrics / 60) + 'm ' : '') + (timeWithoutLyrics % 60 != 0 ? Math.round(timeWithoutLyrics % 60) + 's' : '') + ' without lyrics'"
                    @valueChanged="(newValue) => skipLyricless = newValue"
                />
            </div>
                
            <LyricsCustomization 
                class="w-80"
                variant="mapCustomization"
                :default="lyricsSettings"
                :lyrics="data.lyrics"
                @settingChanged="(name, value) => lyricsSettings[name] = value"
            />

            <label class="w-80">
                <h2 class="font-bold text-xl mt-4">Word length limit</h2>
                <p class="mb-2">(0 means no limit)</p>

                <input 
                    class="input min-w-27.5"
                    type="number"
                    min="0"
                    :max="Math.max( ...data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length) )) ) - 1"
                    v-model="wordLengthLimit"
                    @change="(e) => wordLengthLimit > Math.max( ...data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length) )) ) - 1 ? wordLengthLimit = Math.max( ...data.lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length) )) ) - 1 : e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? wordLengthLimit = 0 : {}"
                >
            </label>
        </div>

        <div class="flex justify-center flex-wrap max-w-160 text-center">
            <div class="w-80 flex justify-center">
                <Switch
                    :initialValue="autospace"
                    labelText="Autospace"
                    :moreInfoButton="true"
                    @valueChanged="(newValue) => autospace = newValue"
                    @moreInfoClicked="visibleMoreInfo = 'Autospace makes it so you automatically go to the next word when you type a word correctly or the current word passes. Whether this is easier is a preference.'"
                />
            </div>

            <div class="w-80 flex justify-center">
                <Switch
                    :initialValue="freeVerseChanging"
                    labelText="Free verse changing"
                    :moreInfoButton="true"
                    @valueChanged="(newValue) => freeVerseChanging = newValue"
                    @moreInfoClicked="visibleMoreInfo = 'Free verse changing removes verse timestamps, letting you change and type them anytime except during marked lyricless parts. Scoring is unchanged.'"
                />
            </div>
        </div>
    </MenuPanel>

    <MenuPanel 
        v-if="visibleMoreInfo"
        :higherZ="true"
    >
        <PinkHeader text="More information" />
        <p class="z-15 max-w-125">
            {{ visibleMoreInfo }}
        </p>
    
        <button
            class="button mt-2.5"
            @click="visibleMoreInfo = ''"
        >Okay</button>
    </MenuPanel>
</template>