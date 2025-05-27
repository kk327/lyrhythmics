<script setup>
    import { ref, watch, computed, onMounted, onUnmounted} from 'vue';
    import { useRouter } from 'vue-router';
    import defaultBackground from '@/assets/background.png'
    import Play from './Play.vue';
    import AddLyricsPanel from '@/components/AddLyricsPanel.vue';
    import InputsAdd from '@/components/InputsAdd.vue';
    import SpeedSelector from '@/components/SpeedSelector.vue';
    import LyricsCustomization from '@/components/LyricsCustomization.vue';
    import SongAndBackgroundInputs from '@/components/SongAndBackgroundInputs.vue';

    const props = defineProps([
        "data"
    ]);

    const emit = defineEmits([
        "clearData"
    ]);

    const router = useRouter();

    const targetFPS = localStorage.getItem("targetFPS") ? localStorage.getItem("targetFPS") : 60;
    const nonDecimalCurrentTime = localStorage.getItem("nonDecimalCurrentTime");
    const settingsVisible = ref(false);
    const scrollY = ref(0);
    let savedScrollY = 0;
    const addLyricsVisible = ref(false);
    const quitWarningVisible = ref(false);
    const backgroundFiltersMode = ref(false);
    const playtesting = ref(false);
    const playtestData = ref({});
    const sizeRefresh = ref(false);
    const currentHue = ref(0);
    const currentBrightness = ref(100);
    const removedVerse = ref(-1);
    const editedVerse = ref(-1);
    const editedVerseData = ref([]);

    const lyrics = ref(props.data ? props.data.lyrics : []);

    const speed = ref(props.data ? 
                        props.data.speed 
                        : localStorage.getItem("defaultSpeed") ?
                            localStorage.getItem("defaultSpeed")
                            : 1);
    
    const disableVerseBackgroundBlur = ref(localStorage.getItem("disableVerseBackgroundBlur"));
    const skipLyricless = ref(props.data && props.data.skipLyricless && props.partsWithoutLyrics.length ? true : false);
    const wordLengthLimit = ref(props.data ? props.data.wordLengthLimit : 0);

    const lyricsSettingList = ["capitalization", "accentLetters", "specialCharacters"];
    const lyricsSettings = ref(props.data ? props.data.lyricsSettings : {});
    if (!props.data) {
        for (let setting of lyricsSettingList) {
            lyricsSettings.value[setting] = localStorage.getItem(setting);
        }
    }

    const testHueRotate = ref(0);
    const testBrightness = ref(100);

    const movedWord = ref({});
    let stretchedVerse = ref({});
    const movedVerse = ref({});
    const stretchedPartWithoutLyrics = ref({});
    const stretchedFilters = ref({});
    let grabPosition = 0;

    let shiftHeld = false;
    let controlHeld = false;
    let nHeld = false;
    let enterHeld = false;

    const songPosition = ref(-1);
    const audio = ref(new Audio());
    let positionUpdateInterval;
    let audioStartDateTime = 0;
    let audioStartTime = 0;
    let playAtMouse = false;

    let autoscrollInterval;
    let intervalId = 0;
    let mouseDown = false;
    let mousePosition = 0;

    const song = ref("");
    const songDuration = ref(0);
    const backgroundImage = ref(props.data ? props.data.backgroundImage : defaultBackground);
    const backgroundFilters = ref(props.data ? props.data.backgroundFilters : []);
    const partsWithoutLyrics = ref(props.data ? props.data.partsWithoutLyrics : []);
    const forceskip = ref(props.data ? props.data.forceskip : false);

    const name = ref(props.data ? props.data.name : "");
    const mapper = ref(props.data ? props.data.mapper : "");
    const additionalInfo = ref(props.data ? props.data.additionalInfo : "");

    document.body.style.overflowY = "auto";
    document.title = "Lyrhythmics - " + (name.value ? name.value : "Unnamed map");

    let lastSave;
    setTimeout(() => {
        lastSave = JSON.stringify({ ...exportData(false), id: "" });
    })

    onMounted(() => { // so that the watcher reacts
        if (props.data) {
            setBackgroundFilters();
            song.value = props.data.song;

            async function loadAudio() {
                audio.value = new Audio(song.value);
                await audio.value.play();
                audio.value.pause();

                let attemptInterval = setInterval(() => {
                    if (audio.value.duration != Infinity) {
                        songDuration.value = Math.floor(audio.value.duration * 100) / 100;
                        clearInterval(attemptInterval);  
                    }
                }, 1000 / targetFPS);
            }
            loadAudio();
        }
    });

    onUnmounted(() => {
        removeEventListener("scroll", onScroll);
        removeEventListener("resize", onResize);
        removeEventListener("keydown", onKeydown);
        removeEventListener("keyup", onKeyUp);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("beforeunload", onBeforeUnload);
    });

    const tabindex = computed(() => {
        return addLyricsVisible.value || quitWarningVisible.value || removedVerse.value != -1 || editedVerse.value != -1 ? -1 : 0;
    });

    const windowHeight = computed(() => {
        sizeRefresh.value;
        return window.innerHeight;
    });

    watch(tabindex, () => {
        if (tabindex.value) {
            document.body.style.overflowY = "hidden";
            audio.value.pause();
            document.activeElement.blur();
        } else {
            document.body.style.overflowY = "auto";
        }
    });

    watch(audio, () => {
        audio.value.addEventListener("play", () => {
            if (!settingsVisible.value && !playtesting.value && !addLyricsVisible.value) {
                playSong();
            }
        });

        audio.value.addEventListener("pause", () => stopSong());
    })

    watch(settingsVisible, () => {
        if (settingsVisible.value) {
            audio.value.pause();
            
            savedScrollY = window.scrollY;
            window.scrollTo({ top: 0 });
        } else {
            setBackgroundFilters();
            setTimeout(() => {
                window.scrollTo({ top: savedScrollY });
            }, 0);
        }
    });

    watch(backgroundFilters, () => {
        if (!settingsVisible.value) {
            setBackgroundFilters();
        }
    }, { deep: true });

    watch(forceskip, () => {
        if (forceskip.value) {
            skipLyricless.value = false;
        }
    });

    watch(partsWithoutLyrics, () => {
        if (!partsWithoutLyrics.value.length) {
            skipLyricless.value = false;
            forceskip.value = false;
        }
    });

    watch(() => movedWord.value + movedVerse.value + stretchedVerse.value + stretchedPartWithoutLyrics.value + stretchedFilters.value, () => {
        if ("id" in movedWord.value || "id" in movedVerse.value) {
            document.body.style.cursor = "grabbing";
        } else if ("id" in stretchedVerse.value || "id" in stretchedPartWithoutLyrics.value || "id" in stretchedFilters.value) {
            document.body.style.cursor = stretchedVerse.value.direction == "up" || stretchedPartWithoutLyrics.value.direction == "up" || stretchedFilters.value.direction == "up" ? "n-resize" : "s-resize";
        }

        grabPosition = mousePosition + window.scrollY - calculateTop(
            "id" in movedWord.value ?
                lyrics.value[movedWord.value.verse][movedWord.value.id].delay
                : movedVerse.value.side == "top" ?
                    lyrics.value[movedVerse.value.id][0].delay
                    : movedVerse.value.side == "bottom" ?
                        lyrics.value[movedVerse.value.id][lyrics.value[movedVerse.value.id].length - 1].delay
                        : stretchedVerse.value.direction == "up"
                            ? lyrics.value[stretchedVerse.value.id][0].delay
                            : stretchedVerse.value.direction == "down" ?
                                lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay
                                : stretchedPartWithoutLyrics.value.direction == "up" ?
                                    partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start 
                                    : stretchedPartWithoutLyrics.value.direction == "down" ?
                                        partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end
                                        : stretchedFilters.value.direction == "up" ?
                                            backgroundFilters.value[stretchedFilters.value.id].start - backgroundFilters.value[stretchedFilters.value.id].transitionDuration 
                                            : stretchedFilters.value.direction == "down" ?
                                                backgroundFilters.value[stretchedFilters.value.id].start
                                                : 0);
    }, { deep: true });

    watch(name, () => {
        document.title = "Lyrhythmics - " + (name.value ? name.value : "Unnamed map");
    });

    watch(songPosition, () => {
        setBackgroundFilters();
    });

    function calculateInputWidth(verseLength) {  
        sizeRefresh.value;
        return window.innerWidth / verseLength + "px";
    }

    function calculateTop(delay) { 
        sizeRefresh.value;
        return window.innerHeight * delay / speed.value / 3.5;
    }

    function topToDelay(top) { 
        sizeRefresh.value;
        return top * speed.value * 3.5 / window.innerHeight;
    }

    function addLyrics(inputLyrics, parsedLyrics, lengthBased) {
        if (!parsedLyrics.length) {
            if (inputLyrics.split("\n").filter(e => e).length == 1 && inputLyrics.split("\n").filter(e => e)[0].split(" ").filter(e => e).length == 1 && lengthBased) {
                lyrics.value = [[{ word: inputLyrics.split("\n").filter(e => e)[0].split(" ").filter(e => e)[0], delay: songDuration.value }]];
                addLyricsVisible.value = false;
                return;
            }

            let skippedIndex = 0;
            let lastSkipIndex = 0; 
            const wordAmount = inputLyrics.split("\n").reduce((sum, verse) => sum += verse.split(" ").filter(e => e).length, 0);

            let wordLength = lengthBased ? (songDuration.value - partsWithoutLyrics.value.reduce((sum, e) => sum + e.end - e.start, 0)) / wordAmount : 1;
            wordLength = lengthBased ? (wordLength * wordAmount - partsWithoutLyrics.value.length * wordLength) / wordAmount : wordLength;

            inputLyrics.split("\n").filter(e => e).map((verse, idx) => {
                let timeToSkip = 0;
                if (lengthBased && skippedIndex != partsWithoutLyrics.value.length && !(skippedIndex == partsWithoutLyrics.value.length - 1 && songDuration.value == partsWithoutLyrics.value[skippedIndex].end) && (lyrics.value.length ? (lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay + wordLength >= partsWithoutLyrics.value[skippedIndex].start || lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay + verse.split(" ").length / 2 * wordLength >= partsWithoutLyrics.value[skippedIndex].start) : (wordLength >= partsWithoutLyrics.value[skippedIndex].start || verse.split(" ").length / 2 * wordLength >= partsWithoutLyrics.value[skippedIndex].start))) { // if the first word or the middle of the verse is after the start of the next lyricless part                
                    lyrics.value = lyrics.value.map((e, idx2) => idx2 < lastSkipIndex ? e : e.map((e2) => { return { word: e2.word, delay: (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0) + (e2.delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / ((lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / (partsWithoutLyrics.value[skippedIndex].start - wordLength * 0.5 - ((skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)))) }})); // start(0 or end of last lyriclesspart) + (delay - start) / ((lastLyricDelayBeforeLyricless - start) / (nextpartwithoutlyrics.start - 0.5wordlength - start))

                    lastSkipIndex = idx;
                    timeToSkip = partsWithoutLyrics.value[skippedIndex].end - (lyrics.value.length ? lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay : 0);
                    skippedIndex += 1;
                };

                lyrics.value.push(verse.split(" ").filter(e => e).map((word, wordId) => {
                    return {
                        word: word,
                        delay: lyrics.value.length ? 
                            lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay + timeToSkip + (1 + wordId) * wordLength
                            : (1 + wordId) * wordLength + timeToSkip
                    }
                }));

                if (lengthBased && skippedIndex == partsWithoutLyrics.value.length - 1 && idx == inputLyrics.split("\n").filter(e => e).length - 1 && songDuration.value == partsWithoutLyrics.value[skippedIndex].end) {
                    lyrics.value = lyrics.value.map((e, idx2) => idx2 < lastSkipIndex ? e : e.map((e2) => { return { word: e2.word, delay: (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0) + (e2.delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / ((lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / (partsWithoutLyrics.value[skippedIndex].start - wordLength * 0.5 - ((skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)))) }}));
                }
            });

            if (lengthBased && skippedIndex && songDuration.value != partsWithoutLyrics.value[partsWithoutLyrics.value.length - 1].end) {
                lyrics.value = lyrics.value.map((e, idx) => idx < lastSkipIndex ? e : e.map((e2) => { return { word: e2.word, delay: partsWithoutLyrics.value[skippedIndex - 1].end + (e2.delay - partsWithoutLyrics.value[skippedIndex - 1].end) / ((lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay - partsWithoutLyrics.value[skippedIndex - 1].end) / (songDuration.value - partsWithoutLyrics.value[skippedIndex - 1].end)) }}));
            }

            lyrics.value = lyrics.value.map((e) => e.map((e2) => e2.delay ? e2 : { word: e2.word, delay: 0 }));
        } else {
            lyrics.value = parsedLyrics.map((e) => e.verse.split(" ").map((e2, idx) => { return { word: e2, delay: e.start + (e.end - e.start) / (e.verse.split(" ").length) * (idx + 1) }}));
        }
        addLyricsVisible.value = false;
    }

    function setBackgroundFilters() {
        const virtualFilters = (!backgroundFilters.value.length ?
                                    [{ start: 0, hue: 0, brightness: 100, transitionDuration: 0}] 
                                    : backgroundFilters.value[0].start == 0 ? 
                                        backgroundFilters.value : 
                                        [{ start: 0, hue: 0, brightness: 100, transitionDuration: 0}, ...backgroundFilters.value]);

        const filteredFilters = virtualFilters.filter((e) => e.start - e.transitionDuration <= topToDelay(songPosition.value != -1 ? songPosition.value : window.scrollY));

        currentHue.value = filteredFilters[filteredFilters.length - 1].hue - (filteredFilters.length != 1 && topToDelay(songPosition.value != -1 ? songPosition.value : window.scrollY) - filteredFilters[filteredFilters.length - 1].start < 0 ? (filteredFilters[filteredFilters.length - 1].hue > filteredFilters[filteredFilters.length - 2].hue ? filteredFilters[filteredFilters.length - 1].hue - filteredFilters[filteredFilters.length - 2].hue : (filteredFilters[filteredFilters.length - 2].hue - filteredFilters[filteredFilters.length - 1].hue) * -1) * ((filteredFilters[filteredFilters.length - 1].start - topToDelay(songPosition.value != -1 ? songPosition.value : window.scrollY)) / filteredFilters[filteredFilters.length - 1].transitionDuration) : 0);

        currentBrightness.value = filteredFilters[filteredFilters.length - 1].brightness - (filteredFilters.length != 1 && topToDelay(songPosition.value != -1 ? songPosition.value : window.scrollY) - filteredFilters[filteredFilters.length - 1].start < 0 ? (filteredFilters[filteredFilters.length - 1].brightness > filteredFilters[filteredFilters.length - 2].brightness ? filteredFilters[filteredFilters.length - 1].brightness - filteredFilters[filteredFilters.length - 2].brightness : (filteredFilters[filteredFilters.length - 2].brightness - filteredFilters[filteredFilters.length - 1].brightness) * -1) * ((filteredFilters[filteredFilters.length - 1].start - topToDelay(songPosition.value != -1 ? songPosition.value : window.scrollY)) / filteredFilters[filteredFilters.length - 1].transitionDuration) : 0);
    }

    function onScroll() {
        scrollY.value = window.scrollY;
        onMouseMove(mousePosition + window.scrollY, false); 
        if (!settingsVisible.value && !playtesting.value) {
            setBackgroundFilters();
        }
    }
    addEventListener("scroll", onScroll);

    function onResize() {
        sizeRefresh.value = !sizeRefresh.value;
    }
    addEventListener("resize", onResize);

    function onKeydown(e) {
        if ((quitWarningVisible.value || removedVerse.value != -1 || editedVerse.value != -1) && e.key == "Escape") {
            quitWarningVisible.value = false;
            removedVerse.value = -1;
            editedVerse.value = -1;
        } else if (e.key == "Shift") {
            shiftHeld = true;
            if (controlHeld && !playtesting.value && !settingsVisible.value && !addLyricsVisible.value && removedVerse.value == -1 && editedVerse.value == -1) {
                audio.value.pause();
            }
        } else if (e.key == "Control" && !playtesting.value && !settingsVisible.value && !addLyricsVisible.value && removedVerse.value == -1) {
            controlHeld = true;

            if (editedVerse.value == -1) {
                if (shiftHeld) {
                    audio.value.pause();
                } else {
                    playAtMouse = true;
                    playClicked();

                    setTimeout(() => {
                        playAtMouse = false;
                    }, 10);
                }
            } else if (enterHeld) {
                confirmVerseEdit();
            }
        } else if (e.key.toLowerCase() == "n" && !nHeld && backgroundFiltersMode.value && !playtesting.value && !settingsVisible.value && !addLyricsVisible.value && topToDelay(window.scrollY + mousePosition) < songDuration.value && !backgroundFilters.value.some((e) => e.start - e.transitionDuration <= Math.round(topToDelay(window.scrollY + mousePosition) * 100) / 100 && e.start >= Math.round(topToDelay(window.scrollY + mousePosition) * 100) / 100)) {
            backgroundFilters.value = [ ...backgroundFilters.value, { start: Math.round(topToDelay(window.scrollY + mousePosition) * 100) / 100, hue: 0, brightness: 100, transitionDuration: 0 }].sort((a,b) => a.start - b.start);
            nHeld = true;
        } else if (e.key == "Enter" && editedVerse.value != -1) {
            enterHeld = true;
            if (controlHeld) {
                confirmVerseEdit();
            }
        }
    }
    addEventListener("keydown", onKeydown);

    function onKeyUp(e) {
        if (e.key == "Shift") {
            shiftHeld = false;
        } else if (e.key == "Control") {
            controlHeld = false;
        } else if (e.key.toLowerCase() == "n") {
            nHeld = false;
        } else if (e.key == "Enter") {
            enterHeld = false;
        }
    }
    addEventListener("keyup", onKeyUp);

    function onMouseUp() {
        clearInterval(autoscrollInterval);
        mouseDown = false;
        document.body.style.cursor = "";
        movedWord.value = {};
        movedVerse.value = {};
        stretchedVerse.value = {};
        stretchedPartWithoutLyrics.value = {};
        stretchedFilters.value = {};
    }
    window.addEventListener("mouseup", onMouseUp);

    function onBeforeUnload(e) {
        if (lastSave != JSON.stringify({ ...exportData(false), id: "" })) {
            e.preventDefault();
        }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    
    function checkSpaceBetweenVerses(delay) {
        if (movedWord.value.verse != lyrics.value.length - 1 && lyrics.value[movedWord.value.verse + 1][0].delay - delay < 0.2) {
            return { delay: lyrics.value[movedWord.value.verse + 1][0].delay - 0.2,
                     preventAutoscrolling: true };
        } else if (movedWord.value.verse != 0 && delay - lyrics.value[movedWord.value.verse - 1][lyrics.value[movedWord.value.verse - 1].length - 1].delay < 0.2) {
            return { delay: lyrics.value[movedWord.value.verse - 1][lyrics.value[movedWord.value.verse - 1].length - 1].delay + 0.2,
                     preventAutoscrolling: true };
        } else {
            return { delay: delay, 
                     preventAutoscrolling: false };
        }
    }

    function onMouseMove(mouseY, skipInterval) {
        mousePosition = mouseY - window.scrollY;
        let preventAutoscrolling = false;
        
        if ("id" in movedWord.value) { // word moving
            lyrics.value[movedWord.value.verse][movedWord.value.id].delay = checkSpaceBetweenVerses(topToDelay(mouseY - grabPosition)).delay;
            preventAutoscrolling = checkSpaceBetweenVerses(topToDelay(mouseY - grabPosition)).preventAutoscrolling;

            if (movedWord.value.id != lyrics.value[movedWord.value.verse].length - 1 && lyrics.value[movedWord.value.verse][movedWord.value.id].delay > lyrics.value[movedWord.value.verse][movedWord.value.id + 1].delay) { // moving others down
                lyrics.value[movedWord.value.verse] = lyrics.value[movedWord.value.verse].map((e, idx) => idx <= movedWord.value.id ? e : {
                    word: e.word, 
                    delay: checkSpaceBetweenVerses(e.delay + lyrics.value[movedWord.value.verse][movedWord.value.id].delay - lyrics.value[movedWord.value.verse][movedWord.value.id + 1].delay).delay
                });
            } else if (movedWord.value.id != 0 && lyrics.value[movedWord.value.verse][movedWord.value.id].delay < lyrics.value[movedWord.value.verse][movedWord.value.id - 1].delay) { // moving others up
                lyrics.value[movedWord.value.verse] = lyrics.value[movedWord.value.verse].map((e, idx) => idx >= movedWord.value.id ? e : {
                    word: e.word,
                    delay: checkSpaceBetweenVerses(e.delay + lyrics.value[movedWord.value.verse][movedWord.value.id].delay - lyrics.value[movedWord.value.verse][movedWord.value.id - 1].delay).delay
                })
            }

            lyrics.value[movedWord.value.verse] = lyrics.value[movedWord.value.verse].map(e => e.delay > 0 ? e : { word: e.word, delay: 0});
        } else if ("id" in stretchedVerse.value) { // verse stretching
            let stretchedLyrics;

            // checking minimum space between verses
            if (stretchedVerse.value.id != lyrics.value.length - 1 && lyrics.value[stretchedVerse.value.id + 1][0].delay - topToDelay(mouseY - grabPosition) < 0.2) { // down
                preventAutoscrolling = true;
                stretchedLyrics = lyrics.value[stretchedVerse.value.id].map((e) => {
                    return { 
                        word: e.word, 
                        delay: lyrics.value[stretchedVerse.value.id][0].delay + (e.delay - lyrics.value[stretchedVerse.value.id][0].delay) / (lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - lyrics.value[stretchedVerse.value.id][0].delay) * (lyrics.value[stretchedVerse.value.id + 1][0].delay - lyrics.value[stretchedVerse.value.id][0].delay - 0.2)
                    }
                });
            } else if (stretchedVerse.value.id != 0 && topToDelay(mouseY - grabPosition) - lyrics.value[stretchedVerse.value.id - 1][lyrics.value[stretchedVerse.value.id - 1].length - 1].delay < 0.2) { // up 
                preventAutoscrolling = true;
                stretchedLyrics = lyrics.value[stretchedVerse.value.id].map((e) => {
                    return {
                        word: e.word,
                        delay: lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - (1 - (e.delay - lyrics.value[stretchedVerse.value.id][0].delay) / (lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - lyrics.value[stretchedVerse.value.id][0].delay)) * (lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - lyrics.value[stretchedVerse.value.id - 1][lyrics.value[stretchedVerse.value.id - 1].length - 1].delay - 0.2)
                    }
                })
            } else if (stretchedVerse.value.direction == "down") { // fits between other verses
                stretchedLyrics = lyrics.value[stretchedVerse.value.id].map((e) => { 
                    return { 
                        word: e.word, 
                        delay: lyrics.value[stretchedVerse.value.id][0].delay + (e.delay - lyrics.value[stretchedVerse.value.id][0].delay) * topToDelay((mouseY - grabPosition - calculateTop(lyrics.value[stretchedVerse.value.id][0].delay))) / topToDelay(calculateTop(lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay) - calculateTop(lyrics.value[stretchedVerse.value.id][0].delay)) 
                    }   
                });
            } else { // up
                stretchedLyrics = lyrics.value[stretchedVerse.value.id].map((e) => { 
                    return { 
                        word: e.word,
                        delay: lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - (lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - e.delay) * topToDelay(calculateTop(lyrics.value[stretchedVerse.value.id][0].delay) - calculateTop(lyrics.value[stretchedVerse.value.id][0].delay) * 2 + calculateTop(lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay)) / topToDelay(mouseY - grabPosition - calculateTop(lyrics.value[stretchedVerse.value.id][0].delay) * 2 + calculateTop(lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay))
                    }   
                });
            }

            // check minimum verse length
            if (stretchedLyrics[stretchedLyrics.length - 1].delay - stretchedLyrics[0].delay <= 0.1 && stretchedLyrics[0].delay > 0) {
                preventAutoscrolling = true;
                if (stretchedVerse.value.direction == "down") {
                    stretchedLyrics = lyrics.value[stretchedVerse.value.id].map((e) => {
                        return { 
                            word: e.word, 
                            delay: lyrics.value[stretchedVerse.value.id][0].delay + (e.delay - lyrics.value[stretchedVerse.value.id][0].delay) / (lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - lyrics.value[stretchedVerse.value.id][0].delay) / 10
                        }   
                    });
                } else {
                    stretchedLyrics = lyrics.value[stretchedVerse.value.id].map((e) => { 
                        return { 
                            word: e.word,
                            delay: lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - 0.1 + (e.delay - lyrics.value[stretchedVerse.value.id][0].delay) / (lyrics.value[stretchedVerse.value.id][lyrics.value[stretchedVerse.value.id].length - 1].delay - lyrics.value[stretchedVerse.value.id][0].delay) / 10
                        }   
                    });
                }
            } else if (stretchedLyrics[0].delay < 0) {
                preventAutoscrolling = true;
            }

            if (stretchedLyrics[0].delay > 0) {
                lyrics.value[stretchedVerse.value.id] = stretchedLyrics;
            } 
        } else if ("id" in movedVerse.value) { // verse moving
            let newVerse;
            if (movedVerse.value.side == "top") {
                newVerse = lyrics.value[movedVerse.value.id].map((e) => { return { word: e.word, delay: topToDelay(mouseY - grabPosition) + e.delay - lyrics.value[movedVerse.value.id][0].delay }});
            } else {
                newVerse = lyrics.value[movedVerse.value.id].map((e) => { return { word: e.word, delay: topToDelay(mouseY - grabPosition) - (lyrics.value[movedVerse.value.id][lyrics.value[movedVerse.value.id].length - 1].delay - e.delay) }});
            }

            // if it doesn't fit
            if (movedVerse.value.id != 0 && newVerse[0].delay - lyrics.value[movedVerse.value.id - 1][lyrics.value[movedVerse.value.id - 1].length - 1].delay < 0.2) {
                preventAutoscrolling = true;
                newVerse = lyrics.value[movedVerse.value.id].map((e) => { return { word: e.word, delay: lyrics.value[movedVerse.value.id - 1][lyrics.value[movedVerse.value.id - 1].length - 1].delay + 0.2 + e.delay - lyrics.value[movedVerse.value.id][0].delay }});
            } else if (movedVerse.value.id != lyrics.value.length - 1 && lyrics.value[movedVerse.value.id + 1][0].delay - newVerse[newVerse.length - 1].delay < 0.2 && !shiftHeld) {
                preventAutoscrolling = true;
                newVerse = lyrics.value[movedVerse.value.id].map((e) => { return { word: e.word, delay: lyrics.value[movedVerse.value.id + 1][0].delay - 0.2 - (lyrics.value[movedVerse.value.id][lyrics.value[movedVerse.value.id].length - 1].delay - e.delay) }});
            }

            const difference = newVerse[0].delay - lyrics.value[movedVerse.value.id][0].delay;
            lyrics.value[movedVerse.value.id] = newVerse;
        
            if (shiftHeld) {
                lyrics.value = lyrics.value.map((e, idx) => idx <= movedVerse.value.id ? e : e.map((e2) => { return { word: e2.word, delay: e2.delay + difference }}));      
            }
        } else if ("id" in stretchedPartWithoutLyrics.value) { // part without lyrics stretching
            if (stretchedPartWithoutLyrics.value.direction == "up") {
                partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start = topToDelay(mouseY - grabPosition);
                if (partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end - partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start < 0.01) {
                    partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start = partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end - 0.01;
                    preventAutoscrolling = true;
                }
            } else {
                partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end = topToDelay(mouseY - grabPosition);
                if (partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end - partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start < 0.01) {
                    partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end = partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start + 0.01;
                    preventAutoscrolling = true;
                }
            }

            if (stretchedPartWithoutLyrics.value.id != partsWithoutLyrics.value.length - 1 && partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id + 1].start - partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end < 0.01) {
                partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end = partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id + 1].start - 0.01;
                preventAutoscrolling = true;
            } else if (stretchedPartWithoutLyrics.value.id != 0 && partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start - partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id - 1].end < 0.01) {
                partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].start = partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id - 1].end + 0.01;
                preventAutoscrolling = true;
            }

            if (partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end > songDuration.value) {
                partsWithoutLyrics.value[stretchedPartWithoutLyrics.value.id].end = songDuration.value;
                preventAutoscrolling = true;
            }
        } else if ("id" in stretchedFilters.value) { // filters stretching
            if (stretchedFilters.value.direction == "up") {
                backgroundFilters.value[stretchedFilters.value.id].transitionDuration = backgroundFilters.value[stretchedFilters.value.id].start - topToDelay(mouseY - grabPosition);
                if (backgroundFilters.value[stretchedFilters.value.id].transitionDuration < 0) {
                    backgroundFilters.value[stretchedFilters.value.id].transitionDuration = 0;
                    preventAutoscrolling = true;
                }
            } else {
                backgroundFilters.value[stretchedFilters.value.id].transitionDuration -= backgroundFilters.value[stretchedFilters.value.id].start - topToDelay(mouseY - grabPosition);
                backgroundFilters.value[stretchedFilters.value.id].start = topToDelay(mouseY - grabPosition);

                if (backgroundFilters.value[stretchedFilters.value.id].transitionDuration < 0) {
                    backgroundFilters.value[stretchedFilters.value.id].start -= backgroundFilters.value[stretchedFilters.value.id].transitionDuration;
                    backgroundFilters.value[stretchedFilters.value.id].transitionDuration = 0;
                    preventAutoscrolling = true;
                } 
            }

            if (stretchedFilters.value.id != backgroundFilters.value.length - 1 && backgroundFilters.value[stretchedFilters.value.id + 1].start - backgroundFilters.value[stretchedFilters.value.id + 1].transitionDuration - backgroundFilters.value[stretchedFilters.value.id].start < 0.01) {
                backgroundFilters.value[stretchedFilters.value.id].transitionDuration -= backgroundFilters.value[stretchedFilters.value.id].start - (backgroundFilters.value[stretchedFilters.value.id + 1].start - backgroundFilters.value[stretchedFilters.value.id + 1].transitionDuration - 0.01);
                backgroundFilters.value[stretchedFilters.value.id].start = backgroundFilters.value[stretchedFilters.value.id + 1].start - backgroundFilters.value[stretchedFilters.value.id + 1].transitionDuration - 0.01;
                preventAutoscrolling = true;
            } else if (stretchedFilters.value.id != 0 && backgroundFilters.value[stretchedFilters.value.id].start - backgroundFilters.value[stretchedFilters.value.id].transitionDuration - backgroundFilters.value[stretchedFilters.value.id - 1].start < 0.01) {
                backgroundFilters.value[stretchedFilters.value.id].transitionDuration = backgroundFilters.value[stretchedFilters.value.id].start - backgroundFilters.value[stretchedFilters.value.id - 1].start - 0.01;
                preventAutoscrolling = true;
            }

            if (backgroundFilters.value[stretchedFilters.value.id].start > songDuration.value) {
                backgroundFilters.value[stretchedFilters.value.id].transitionDuration -= backgroundFilters.value[stretchedFilters.value.id].start - songDuration.value;
                backgroundFilters.value[stretchedFilters.value.id].start = songDuration.value;
                preventAutoscrolling = true;
            }
        }

        if (!skipInterval && mouseDown && !preventAutoscrolling && window.scrollY > 33) {
            clearInterval(autoscrollInterval);
            intervalId = 0;
            if (mouseY - window.scrollY < 33) {
                setAutoscroll(mouseY, -5);
            } else if (window.scrollY + window.innerHeight - mouseY < 33) {
                setAutoscroll(mouseY, 5);
            }
        } else if (preventAutoscrolling) {
            clearInterval(autoscrollInterval);
        }
    }

    function setAutoscroll(mouseY, value) {
        autoscrollInterval = setInterval(() => {
            window.scrollBy({ top: value });
            intervalId++;
            onMouseMove(mouseY + intervalId * value, true);
        }, 1 / 60);
    }

    function changePlaytesting() {
        if(!playtesting.value) {
            playtestData.value = { 
                name: name.value,
                mapper: mapper.value,
                additionalInfo: additionalInfo.value,
                song: song.value,
                backgroundImage: backgroundImage.value,
                backgroundFilters: backgroundFilters.value,
                lyrics: lyrics.value,
                partsWithoutLyrics: partsWithoutLyrics.value,
                forceskip: forceskip.value,
                speed: speed.value,
                startTime: settingsVisible.value ? 0 : topToDelay(window.scrollY),
                skipLyricless: skipLyricless,
                lyricsSettings: lyricsSettings.value,
                wordLengthLimit: wordLengthLimit.value,
                playtesting: true
            };
            audio.value.pause();
            document.activeElement.blur();
        } else {
            document.body.style.overflowY = "auto";
        }
        playtesting.value = !playtesting.value;
    }

    function exportData(download) {
        const data = {
            name: name.value,
            mapper: mapper.value,
            additionalInfo: additionalInfo.value,
            song: song.value,
            backgroundImage: backgroundImage.value,
            backgroundFilters: backgroundFilters.value,
            lyrics: lyrics.value,
            partsWithoutLyrics: partsWithoutLyrics.value,
            forceskip: forceskip.value,
            id: new Array(32).fill("QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890").map((e) => e[Math.floor(Math.random() * e.length)]).join("")
        };
        
        if (download) {
            lastSave = JSON.stringify({ ...data, id: "" });
            const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = (name.value ? name.value : "Unnamed Lyrhythmics map") + ".json";
            a.click();
        } else {
            return data;
        }
    }

    function playSong() {
        audio.value.currentTime = topToDelay(window.scrollY + (playAtMouse ? mousePosition : 0));
        audio.value.playbackRate = speed.value;
        
        audioStartTime = audio.value.currentTime;
        audioStartDateTime = Date.now();

        positionUpdateInterval = setInterval(() => {
            if (audio.value.currentTime >= songDuration.value) {
                clearInterval(positionUpdateInterval);
                songPosition.value = -1;
            } else {
                songPosition.value = calculateTop((Date.now() - audioStartDateTime) / 1000 * speed.value + audioStartTime);
            }
        }, 1000 / targetFPS);
    }

    function stopSong() {
        clearInterval(positionUpdateInterval);
        songPosition.value = -1;
    }

    function onSongLoad(newSong, newAudio, newSongDuration) {
        song.value = newSong;
        audio.value = newAudio;
        songDuration.value = newSongDuration;
    }

    function playClicked() {
        if (songPosition.value != -1) {
            audio.value.pause();
        }
        audio.value.play();
    }

    function removeVerse() {
        lyrics.value = lyrics.value.filter((e, idx) => idx != removedVerse.value);
        removedVerse.value = -1;
    }

    function editVerse(id) {
        editedVerseData.value = JSON.parse(JSON.stringify(lyrics.value.filter((e, idx) => id == idx)[0]));
        editedVerse.value = id;
    }

    function confirmVerseEdit() {
        lyrics.value = lyrics.value.map((e, idx) => idx != editedVerse.value ? e : editedVerseData.value.filter(e => e.word));
        editedVerse.value = -1;
    }

    function switchPlaces(id) {
        lyrics.value = lyrics.value.map((e, idx) => 
            idx == id ?
                lyrics.value[id + 1].map((e2) => { return { word: e2.word, delay: lyrics.value[id][0].delay + e2.delay - lyrics.value[id + 1][0].delay }})
                : idx == id + 1 ?
                    lyrics.value[id].map((e2) => { return { word: e2.word, delay: lyrics.value[id + 1][lyrics.value[id + 1].length - 1].delay - (lyrics.value[id][lyrics.value[id].length - 1].delay - e2.delay) }})
                    : e );
    }

    function quit() {
        emit("clearData");
        router.push("/");
    }
</script>

<template>
    <!-- debug -->
    <p 
        v-if="false"
        class="bg-red-900/50 z-90 p-2 fixed rounded-br-lg py-0 text-white top-0 left-0 max-w-40 max-h-6 text-wrap pointer-events-none"
    >
        {{ }}
    </p>

    <AddLyricsPanel
        v-if="addLyricsVisible"
        :songDuration="songDuration"
        :currentLyrics="lyrics.length"
        @close="addLyricsVisible = false"
        @addLyrics="(inputLyrics, parsedLyrics, lengthBased) => addLyrics(inputLyrics, parsedLyrics, lengthBased)"
    />

    <!-- quit to menu warning -->
    <div
        v-if="quitWarningVisible || removedVerse != -1 || editedVerse != -1"
        class="fixed left-0 w-screen h-screen flex justify-center items-center text-white z-10"
    >
        <div class="fixed w-screen h-screen bg-black/50 backdrop-blur-xs"></div> 

        <div 
            v-if="quitWarningVisible"
            class="flex flex-col items-center max-h-full w-full py-2 overflow-y-auto z-11"
        >
            <h2 class="font-bold text-lg">Are you sure you want to quit?</h2>
            <p>Make sure to export the map first if you want to have it saved.</p>

            <div class="flex gap-3 mt-2.5">
                <button
                    class="button"
                    @click="quitWarningVisible = false"
                >Cancel</button>

                <button
                    class="button"
                    @click="quit()"
                >Quit</button>
            </div>
        </div>

        <div
            v-else-if="removedVerse != -1"
            class="flex flex-col items-center max-h-full w-full py-2 overflow-y-auto z-11"
        >
            <p class="font-bold text-lg">Are you sure you want to remove this verse?</p>
            <p>{{ lyrics[removedVerse].map((e) => e.word).join(" ") }}</p>

            <div class="flex gap-3 mt-2.5">
                <button
                    class="button"
                    @click="removedVerse = -1"
                >Cancel</button>

                <button
                    class="button"
                    @click="removeVerse()"
                >Remove</button>
            </div>
        </div>

        <div
            v-else
            class="flex flex-col items-center max-h-full w-full py-2 overflow-y-auto z-11"
        >
            <p class="font-bold text-lg mb-2">Input the edited verse.</p>
            <div class="flex gap-2 flex-wrap justify-center">
                <button
                    class="button"
                    title="Add new word."
                        @click="editedVerseData.splice(0, 0, { word: '', delay: editedVerseData[0].delay })"
                >+</button>

                <div 
                    v-for="word, idx in editedVerseData"
                    class="flex gap-2 items-center"
                >
                    <input
                        v-model="word.word"
                        class="input w-32 h-fit"
                        type="text"
                        @change="(e) => !e.target.value ? editedVerseData = editedVerseData.filter((e, idx2) => idx != idx2) : {}"
                    ></input>

                    <button
                        class="button"
                        title="Add new word."
                        @click="editedVerseData.splice(idx + 1, 0, { word: '', delay: idx == editedVerseData.length - 1 ? editedVerseData[idx].delay : (editedVerseData[idx].delay + editedVerseData[idx + 1].delay) / 2 })"
                    >+</button>
                </div>
            </div>
            <p class="mt-2">To remove a verse, edit it and leave it empty.</p>

            <div class="flex gap-3 mt-2.5">
                <button
                    class="button"
                    @click="editedVerse = -1"
                >Cancel</button>

                <button
                    class="button"
                    @click="confirmVerseEdit()"
                >Confirm</button>
            </div>
        </div>
    </div>

    <!-- background image -->
    <img
        v-if="!playtesting"
        class="fixed h-[calc(100vh+50px)] top-[-25px] w-screen object-cover select-none z-[-10] bg-neutral-900"  
        :style="{ filter: 'hue-rotate(' + (settingsVisible ? testHueRotate : currentHue) + 'deg) brightness(' + (settingsVisible ? testBrightness : currentBrightness) / 100 + ')' }"
        :src="backgroundImage" 
        alt="background"
        draggable="false"
    >
    <div 
        v-if="settingsVisible && !playtesting"
        class="fixed w-screen h-screen bg-black/50 z-[-9] backdrop-blur-xs"
    ></div>

    <!-- top left buttons -->
    <div 
        v-if="!playtesting && !settingsVisible"
        class="fixed top-3 left-3 flex gap-3 z-9"
    >
        <button
            class="button px-2.5 py-2.5 group"
            :disabled="!songDuration || songPosition == -1"
            :tabindex="tabindex"
            @click="audio.pause()"
            :title="!songDuration ? 
                        'Add a song first.' 
                        : songPosition == -1 ?
                            'Can\'t stop a song that isn\'t playing.'
                            : 'Stop playing song. (Shift + Ctrl)'"
        ><img 
            class="w-5 group-disabled:brightness-63"
            src="@/assets/stop.png" 
            alt="Stop"
        ></button>

        <button
            class="button px-2.5 py-2.5 group flex flex-row gap-2"
            :disabled="!songDuration"
            :tabindex="tabindex"
            @click="playClicked()"
            :title="!songDuration ? 'Add a song first.' : 'Play song. (Ctrl)'"
        >
            <img 
                class="w-5 group-disabled:brightness-63"
                src="@/assets/arrow.png" 
                alt="Play"
            >
            <p
                class="h-0 relative bottom-0.5"
                v-if="songPosition != -1"
            >
                {{ nonDecimalCurrentTime ? Math.round(topToDelay(songPosition)) : (Math.round(topToDelay(songPosition) * 100) / 100).toFixed(2) }}s
            </p>
        </button>
    </div>

    <!-- top right buttons -->
    <div class="fixed top-3 right-3 flex gap-3 z-9">
        <button
            v-if="!playtesting"
            class="button"
            :disabled="!songDuration || lyrics.length == 0"
            :tabindex="tabindex"
            :title="!songDuration ?
                        'Add a song first' :
                        lyrics.length == 0 ?
                            'Input the lyrics first' :
                            ''"
            @click="exportData(true)"
        >Export</button>

        <button
            class="button"
            :disabled="!songDuration || lyrics.length == 0 || topToDelay(scrollY) >= lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay"
            :tabindex="tabindex"
            :title="!songDuration ?
                        'Add a song first'
                        : lyrics.length == 0 ?
                            'Input the lyrics first'
                            : topToDelay(scrollY) >= lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay ?
                                'You can\'t playtest after the end of the lyrics.'
                                : ''"
            @click="changePlaytesting()"
        >{{ playtesting ? "Back" : "Playtest" }}</button>

        <button
            v-if="!playtesting"
            class="button"
            :tabindex="tabindex"
            @click="addLyricsVisible = true"
        >Add lyrics</button>

        <button
            v-if="!playtesting"
            class="button"
            :tabindex="tabindex"
            :title="backgroundFiltersMode ? 'Switch to the lyrics view.' : 'Switch to the background filters view.'"
            @click="backgroundFiltersMode = !backgroundFiltersMode"
        >{{ backgroundFiltersMode ? 'Lyrics' : 'BG Filters' }}</button>

        <button
            v-if="!playtesting"
            class="button"
            :tabindex="tabindex"
            @click="settingsVisible = !settingsVisible"
        >Settings</button>
    </div>

    <!-- settings -->
    <main 
        v-if="settingsVisible && !playtesting"
        class="flex flex-col items-center w-full min-h-screen text-white pb-4"
    >
        <h1 class="mt-8 font-bold text-2xl">Map settings:</h1>
        
        <SongAndBackgroundInputs
            :tabindex="tabindex"
            :defaultBackgroundImage="backgroundImage"
            :defaultSong="song"
            :minDuration="Math.max(partsWithoutLyrics.length ? partsWithoutLyrics[partsWithoutLyrics.length - 1].end : 0, backgroundFilters.length ? backgroundFilters[backgroundFilters.length - 1].start : 0)"
            @backgroundImageSet="(newBackgroundImage) => backgroundImage = newBackgroundImage"
            @songLoaded="(newSong, newAudio, newSongDuration) => onSongLoad(newSong, newAudio, newSongDuration)"
        />

        <h2 class="font-bold text-xl mt-4 mb-2">Background filters:</h2>
        
        <p>
            Hue-rotate for testing: 
            <b>{{ testHueRotate }}°</b>
        </p>
        <div class="flex gap-2 mb-1.5 mt-1">
            <input 
                v-model="testHueRotate"
                min="0"
                max="360"
                type="range"
                :tabindex="tabindex"
            >
            <input 
                class="input w-35"
                v-model="testHueRotate"
                type="number"
                :tabindex="tabindex"
                @change="(e) => isNaN(parseFloat(e.target.value)) ? testHueRotate = 0 : {}"
            >
        </div>

        <p>
            Brightness for testing: 
            <b>{{ testBrightness }}%</b>
        </p>
        <div class="flex gap-2 mb-1.5 mt-1">
            <input 
                v-model="testBrightness"
                min="0"
                max="500"
                type="range"
                :tabindex="tabindex"
            >
            <input 
                class="input w-35"
                v-model="testBrightness"
                type="number"
                :tabindex="tabindex"
                @change="(e) => isNaN(parseFloat(e.target.value)) ? testBrightness = 0 : {}"
            >
        </div>

        <p v-for="filterData, idx in backgroundFilters">
            {{ Math.round(filterData.start * 100) / 100 + "s | " + filterData.hue + "° | " + filterData.brightness + "% | " + Math.round(filterData.transitionDuration * 100) / 100 + (filterData.transitionDuration ? "s (" + Math.round((filterData.start - filterData.transitionDuration) * 100) / 100 + "s - " + Math.round(filterData.start * 100) / 100 + "s)" : "s (instant)") }}
            <button
                class="button p-0 w-8 my-0.75"
                title="Remove."
                :tabindex="tabindex"
                @click="backgroundFilters = backgroundFilters.filter((e, idx2) => idx != idx2)"
            >X</button>
        </p>
        <InputsAdd 
            :labels="['Start time', 'Hue-rotate', 'Brightness', 'Transition duration']"
            :maxValues="[songDuration, Infinity, Infinity, Infinity]"
            limits="transition"
            :array="backgroundFilters"
            :disabledInfo="!songDuration ? 'Add a song first.' : ''"
            :tabindex=tabindex
            @add="(start, hue, brightness, transitionDuration) => backgroundFilters = [ ...backgroundFilters, { start: start, hue: hue, brightness: brightness, transitionDuration: transitionDuration }].sort((a,b) => a.start - b.start)"
        />

        <p class="mt-2">The transition takes place before the start time.</p>

        <h2 class="font-bold text-xl mt-4 mb-2">Metadata:</h2>
        <label>
            Name:
            <input 
                class="input ml-1 mb-1.5"
                type="text"
                :tabindex="tabindex"
                v-model="name"
            >
        </label>
        <label>
            Mapper:
            <input 
                class="input ml-1 mb-1.5"
                type="text"
                :tabindex="tabindex"
                v-model="mapper"
            >
        </label>
        <label class="flex items-center flex-col">
            Additional information (can include links):
            <textarea 
                class="input my-1 w-100 h-20"
                type="text"
                :tabindex="tabindex"
                v-model="additionalInfo"
            ></textarea>
        </label>
        <p>Example link: {{ "<https://example.com example link>" }}</p>

        <h2 
            :class="!songDuration ? 'font-bold text-xl mt-4 mb-2 text-neutral-400 cursor-not-allowed' : 'font-bold text-xl mt-4 mb-2'"
            :title="!songDuration ? 'Add a song first.' : ''"
        >
            Parts without lyrics:
        </h2>
        <p v-for="part, idx in partsWithoutLyrics">
            {{ Math.round(part.start * 100) / 100 + "s - " + Math.round(part.end * 100) / 100 + "s" }}
            <button
                class="button p-0 w-8 my-0.75"
                title="Remove."
                :tabindex="tabindex"
                @click="partsWithoutLyrics = partsWithoutLyrics.filter((e, idx2) => idx != idx2)"
            >X</button>
        </p>
        <InputsAdd 
            :labels="['Start time', 'End time']"
            :maxValues="[songDuration, songDuration]"
            limits="startEnd"
            :array="partsWithoutLyrics"
            :disabledInfo="!songDuration ? 'Add a song first.' : ''"
            :tabindex="tabindex"
            @add="(start, end) => partsWithoutLyrics = [ ...partsWithoutLyrics, { start: start, end: end }].sort((a,b) => a.start - b.start)"
        />

        <label 
            class="flex flex-col items-center has-disabled:text-neutral-400 has-disabled:cursor-not-allowed"
            :title="!partsWithoutLyrics.length ? 'Add a part without lyrics first.' : ''"
        >
            <h2 class="font-bold text-xl mt-4 mb-2">Force-skip parts without lyrics:</h2>
            <input 
                class="cursor-pointer disabled:cursor-not-allowed"
                :disabled="!partsWithoutLyrics.length"
                :tabindex="tabindex"
                type="checkbox"
                v-model="forceskip"
            >
        </label>

        <h1 class="mt-8 font-bold text-2xl">Editor settings:</h1>
        <SpeedSelector
            :defaultSpeed="speed"
            :tabindex="tabindex"
            @changed="(newSpeed) => speed = newSpeed"
        />

        <label 
            class="flex flex-col items-center has-disabled:text-neutral-400 has-disabled:cursor-not-allowed"
            :title="forceskip ?
                        'Force-skip is enabled instead.' 
                        : !partsWithoutLyrics.length ?
                            'Add a part without lyrics first.'
                            : ''"
        >
            <h2 class="font-bold text-xl mt-4 mb-2">Skip parts without lyrics:</h2>
            <input 
                class="cursor-pointer disabled:cursor-not-allowed"
                :disabled="forceskip || !partsWithoutLyrics.length"
                :tabindex="tabindex"
                type="checkbox"
                v-model="skipLyricless"
            >
        </label>

        <LyricsCustomization 
            variant="editor"
            :default="lyricsSettings"
            :lyrics="lyrics"
            :tabindex="tabindex"
            @settingChanged="(name, value) => lyricsSettings[name] = value"
        />
        <p v-if="lyrics.length && !lyrics.map((e) => e.map((e2) => { return lyricsSettings.capitalization ? e2 : { word: e2.word.toLowerCase(), delay: e2.delay }}).map((e2) => { return lyricsSettings.accentLetters ? e2 : { word: e2.word.normalize('NFKD').replace(/\p{Diacritic}/gu, ''), delay: e2.delay } }).map((e2) => { return lyricsSettings.specialCharacters ? e2 : { word: e2.word.replace(/\P{Letter}/gu, ''), delay: e2.delay } }).filter((e2) => e2.word)).filter((e) => e.length).length">
            These settings remove all the lyrics, so playtesting will immediately end.
        </p>

        <label 
            class="text-center has-disabled:text-neutral-400 has-disabled:cursor-not-allowed"
            :title="lyrics.length ? '' : 'Add lyrics first.'"
        >
            <h2 class="font-bold text-xl mt-4">Word length limit:</h2>
            <p class="mb-2">(0 means no limit)</p>
            <input 
                class="input w-27.5"
                type="number"
                min="0"
                :max="Math.max( ...lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1"
                :disabled="!lyrics.length"
                v-model="wordLengthLimit"
                @change="(e) => wordLengthLimit > Math.max( ...lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1 ? wordLengthLimit = Math.max( ...lyrics.map(e => Math.max( ...e.map(e2 => e2.word.length ))) ) - 1 : e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? wordLengthLimit = 0 : {}"
            >
        </label>

        <button
            class="button mt-6"
            :tabindex="tabindex"
            @click="lastSave != JSON.stringify({ ...exportData(false), id: '' }) ? quitWarningVisible = true : quit()"
        >Quit to main menu</button>
    </main>

    <!-- main editor / lyrics mode -->
    <main
        v-else-if="!playtesting && !backgroundFiltersMode"
        class="flex flex-col items-end min-h-screen text-white"
        :style="{ height: calculateTop(Math.max(songDuration, lyrics.length ? lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay : 0)) + windowHeight / 2 + 'px' }"
        @mousemove="(e) => onMouseMove(e.pageY, false)"
        @mousedown="mouseDown = true"
    >
        <div
            v-for="part, idx in partsWithoutLyrics"
            class="flex justify-center"
        >
            <div class="w-screen"></div>
            <div
                class="absolute w-screen border-y-3 z-[-1] border-black bg-[url(@/assets/lyricless.png)]"
                :style="{ top: calculateTop(part.start) + 'px',
                          height: calculateTop(part.end - part.start) + 'px' }"
            ></div>

            <div 
                class="bg-black w-screen absolute h-0.75"
                :style="{ top: calculateTop(part.start) + 'px' }"
            ></div>
            <button
                class="rounded-xl absolute cursor-n-resize tracking-[10px] pl-3 pr-1 select-none bg-black text-white"
                :tabindex="tabindex"
                :style="{ top: calculateTop(part.start) - 12 + 'px' }"
                @mousedown="stretchedPartWithoutLyrics = { id: idx, direction: 'up' }"
            >↕↕↕↕↕↕↕</button>

            <div 
                class="bg-black w-screen absolute h-0.75"
                :style="{ top: calculateTop(part.end) - 4 + 'px' }"
            ></div>
            <button
                class="rounded-xl absolute cursor-s-resize tracking-[10px] pl-3 pr-1 select-none bg-black text-white"
                :tabindex="tabindex"
                :style="{ top: calculateTop(part.end) - 16 + 'px' }"
                @mousedown="stretchedPartWithoutLyrics = { id: idx, direction: 'down' }"
            >↕↕↕↕↕↕↕</button>
        </div>

        <div 
            v-for="verse, verseId in lyrics"
            class="flex justify-center"
            :style="{ '--color': verseId % 2 == 0 ? 'black' : 'white',
                      '--textColor': verseId % 2 == 0 ? 'white' : 'black' }"
        >
            <div
                class="absolute w-screen border-y-2 z-[-1] border-(--color)"
                :style="{ top: calculateTop(verse[0].delay) - 10 + 'px',
                          height: calculateTop(verse[verse.length - 1].delay - verse[0].delay) + 45 + 'px',
                          backdropFilter: disableVerseBackgroundBlur ? '' : 'blur(4px)',
                          backgroundColor: verseId % 2 == 0 ? 'rgb(0, 0, 0, 0.5)' : 'rgb(255, 255, 255, 0.2)' }"
            ></div>

            <div 
                v-for="lyric, lyricId in verse" 
                :style="{ width: calculateInputWidth(verse.length) }"
            >
                <p
                    class="absolute select-none flex justify-center text-center break-words"
                    :style="{ width: calculateInputWidth(verse.length), 
                              top: calculateTop(lyric.delay) + 'px' }"
                >
                    <span 
                        class="bg-black/40 px-4 py-1.25 relative bottom-1 rounded-xl backdrop-blur-md max-w-full"
                        :style="{ cursor: movedWord.verse == verseId && movedWord.id == lyricId ? 'grabbing' : 'grab' }"
                        @mousedown="movedWord = { verse: verseId, id: lyricId }"
                    >
                        {{ lyric.word }}
                    </span>
                </p>
            </div>

            <div 
                class="absolute w-full px-1.5 flex justify-between text-(--textColor)"
                :style="{ top: calculateTop(verse[0].delay) - 22 + 'px' }"
            >
                <!-- top -->
                <button
                    class="rounded-xl bg-(--color) pl-3 tracking-[10px]"
                    :style="{ cursor: movedVerse.id == verseId ? 'grabbing' : 'grab' }"
                    :tabindex="tabindex"
                    @mousedown="movedVerse = { id: verseId, side: 'top' }"
                >•••••••</button>

                <!-- bottom -->
                <button
                    class="rounded-xl bg-(--color) pl-3 tracking-[10px] absolute"
                    :style="{ top: calculateTop(verse[verse.length - 1].delay) - calculateTop(verse[0].delay) + 44 + 'px',
                              cursor: movedVerse.id == verseId ? 'grabbing' : 'grab' }"
                    :tabindex="tabindex"
                    @mousedown="movedVerse = { id: verseId, side: 'bottom' }"
                >•••••••</button>

                <div class="flex items-center gap-1">
                    <button
                        v-if="verseId != 0"
                        class="rounded-xl bg-(--color) px-1.5 cursor-pointer hover:scale-[1.05] duration-100 h-full"
                        title="Switch places with the verse above."
                        :tabindex="tabindex"
                        @click="switchPlaces(verseId - 1)"
                    >
                        <img 
                            :class="verseId % 2 == 0 ? 'w-3 rotate-[-90deg]' : 'w-3 rotate-[-90deg] brightness-0'"
                            src="@/assets/arrow.png" 
                            alt="arrow pointing up"
                        >
                    </button>

                    <button
                        v-if="verseId != lyrics.length - 1"
                        class="rounded-xl bg-(--color) px-1.5 cursor-pointer hover:scale-[1.05] duration-100 h-full"
                        title="Switch places with the verse below."
                        :tabindex="tabindex"
                        @click="switchPlaces(verseId)"
                    >
                        <img 
                            :class="verseId % 2 == 0 ? 'w-3 rotate-90' : 'w-3 rotate-90 brightness-0'"
                            src="@/assets/arrow.png" 
                            alt="arrow pointing down"
                        >
                    </button>

                    <button
                        class="rounded-xl bg-(--color) px-1.5 cursor-pointer hover:scale-[1.05] duration-100 h-full"
                        title="Edit verse."
                        :tabindex="tabindex"
                        @click="editVerse(verseId)"
                    >
                    <img 
                        :class="verseId % 2 == 0 ? 'w-3' : 'w-3 brightness-0'"
                        src="@/assets/edit.png" 
                        alt="edit icon"
                        >
                    </button>

                    <button
                        class="rounded-xl bg-(--color) px-2 cursor-pointer font-bold hover:scale-[1.05] duration-100"
                        title="Remove verse."
                        :tabindex="tabindex"
                        @click="removedVerse = verseId"
                    >X</button>
                </div>
            </div>

            <!-- top -->
            <button
                v-if="verse[0].delay != verse[verse.length - 1].delay"
                class="rounded-xl absolute cursor-n-resize tracking-[10px] pl-3 pr-1 select-none bg-(--color) text-(--textColor)"
                :tabindex="tabindex"
                :style="{ top: calculateTop(verse[0].delay) - 22 + 'px' }"
                @mousedown="stretchedVerse = { id: verseId, direction: 'up' }"
            >↕↕↕↕↕↕↕</button>

            <!-- bottom -->
            <button
                v-if="verse[0].delay != verse[verse.length - 1].delay"
                class="rounded-xl absolute cursor-s-resize tracking-[10px] pl-3 pr-1 select-none bg-(--color) text-(--textColor)"
                :tabindex="tabindex"
                :style="{ top: calculateTop(verse[verse.length - 1].delay) + 22 + 'px' }"
                @mousedown="stretchedVerse = { id: verseId, direction: 'down' }"
            >↕↕↕↕↕↕↕</button>
        </div>
    </main>

    <main
        v-else-if="!playtesting && backgroundFiltersMode"
        class="flex flex-col items-end min-h-screen text-white"
        :style="{ height: calculateTop(songDuration) + windowHeight / 2 + 'px'}"
        @mousemove="(e) => onMouseMove(e.pageY, false)"
        @mousedown="mouseDown = true"
    >
        <div
            v-for="filters, idx in backgroundFilters"
            class="flex justify-center"
            :style="{ '--color': idx % 2 == 0 ? 'black' : 'white',
                      '--textColor': idx % 2 == 0 ? 'white' : 'black' }"
        >
            <div class="w-screen"></div>
            <div
                class="absolute w-screen border-y-3 border-x-20 z-[-1] border-(--color)"
                :style="{ top: calculateTop(filters.start - filters.transitionDuration) + 'px',
                          height: calculateTop(filters.transitionDuration) + 'px' }"
            ></div>

            <div 
                class="absolute w-full px-1.5 flex justify-end gap-1 text-(--textColor)"
                :style="{ top: calculateTop(filters.start - filters.transitionDuration) - 11 + 'px' }"
            >
                <input 
                    class="rounded-xl bg-(--color) px-2 w-20"
                    type="number"
                    title="Hue-rotate"
                    v-model="backgroundFilters[idx].hue"
                    :tabindex="tabindex"
                    @change="(e) => isNaN(parseFloat(e.target.value)) ? backgroundFilters[idx].hue = 0 : {}"
                >

                <input 
                    class="rounded-xl bg-(--color) px-2 w-20"
                    type="number"
                    title="Brightness"
                    v-model="backgroundFilters[idx].brightness"
                    :tabindex="tabindex"
                    @change="(e) => e.target.value < 0 || isNaN(parseFloat(e.target.value)) ? backgroundFilters[idx].brightness = 0 : {}"
                >

                <button
                    class="rounded-xl bg-(--color) px-2 cursor-pointer font-bold hover:scale-[1.05] duration-100"
                    title="Remove filters."
                    :tabindex="tabindex"
                    @click="backgroundFilters = backgroundFilters.filter((e, idx2) => idx != idx2)"
                >X</button>
            </div>

            <button
                class="rounded-xl absolute cursor-n-resize tracking-[10px] pl-3 pr-1 select-none bg-(--color) text-(--textColor)"
                :tabindex="tabindex"
                :style="{ top: calculateTop(filters.start - filters.transitionDuration) - 12 + 'px' }"
                @mousedown="stretchedFilters = { id: idx, direction: 'up' }"
            >↕↕↕↕↕↕↕</button>

            <button
                class="rounded-xl absolute cursor-s-resize tracking-[10px] pl-3 pr-1 select-none bg-(--color) text-(--textColor)"
                :tabindex="tabindex"
                :style="{ top: calculateTop(filters.start) - 16 + 'px' }"
                @mousedown="stretchedFilters = { id: idx, direction: 'down' }"
            >↕↕↕↕↕↕↕</button>
        </div>
    </main>

    <Play 
        v-else-if="playtesting"
        :data="playtestData"
        @quitPlaytesting="changePlaytesting()"
    />

    <div
        v-if="songPosition != -1 && !playtesting && !settingsVisible"
        class="w-full h-2 bg-black border-y-1 border-white absolute"
        :style="{ top: songPosition + 'px' }"
    ></div>
</template>