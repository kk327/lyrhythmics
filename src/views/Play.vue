<script setup>
    import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
    import { useRouter } from 'vue-router';
    import MapCustomization from "@/components/MapCustomization.vue";
    import PinkHeader from '@/components/PinkHeader.vue';

    const props = defineProps([
        "data"
    ]);

    const emit = defineEmits([
        "quitPlaytesting",
        "setData"
    ]);

    const router = useRouter();

    const lyrics = ref(props.data.lyrics.map((e) => e.map((e2) => { return props.data.lyricsSettings.capitalization ? e2 : { word: e2.word.toLowerCase(), delay: e2.delay }}).map((e2) => { return props.data.lyricsSettings.accentLetters ? e2 : { word: e2.word.replace(/ł/g, "l").replace(/Ł/g, "L").replace(/Ø/g, "O").replace(/ø/g, "o").normalize("NFKD").replace(/\p{Diacritic}/gu, ""), delay: e2.delay } }).map((e2) => { return props.data.lyricsSettings.specialCharacters ? e2 : { word: e2.word.replace(/\P{Letter}/gu, ""), delay: e2.delay } }).filter((e2) => e2.word).map((e2) => props.data.wordLengthLimit ? { ...e2, word: e2.word.slice(0, props.data.wordLengthLimit) } : e2 )));
    let unfilteredLyrics = lyrics.value;
    lyrics.value = lyrics.value.filter((e) => e.length);

    const finished = ref(false);
    const finalScore = ref(0);

    const speed = ref(props.data.speed);
    let partsWithoutLyrics = props.data.skipLyricless || props.data.forceskip ? props.data.partsWithoutLyrics : [];
    const backgroundFilters = ref(!props.data.backgroundFilters.length ?
                                    [{ start: 0, hue: 0, brightness: 100, transitionDuration: 0}] 
                                    : props.data.backgroundFilters[0].start == 0 ? 
                                        props.data.backgroundFilters 
                                        : [{ start: 0, hue: 0, brightness: 100, transitionDuration: 0}, ...props.data.backgroundFilters]);

    const startTime = ref((partsWithoutLyrics.length && partsWithoutLyrics.some((e) => e.start <= props.data.startTime && e.end > props.data.startTime) ? partsWithoutLyrics.filter((e) => e.start <= props.data.startTime && e.end > props.data.startTime)[0].end : props.data.startTime));
    partsWithoutLyrics = partsWithoutLyrics.filter((e) => e.start > startTime.value);
    
    if (!lyrics.value.length || props.data.startTime > lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay) {
        lyrics.value = lyrics.value.length ? [...lyrics.value, [{ word: "", delay: Infinity }]] : [[{ word: "", delay: Infinity }]];

        if (props.data.playtesting) {
            emit("quitPlaytesting");
        } else {
            finished.value = true;
            finalScore.value = -1;
        }
    }

    const time = ref(startTime.value / speed.value);
    let timeAtStart = 0;
    
    let skippedTime = 0;
    let continueOffset = 0;

    const lyricsId = ref(lyrics.value.findIndex((e) => e.some((e2) => e2.delay >= startTime.value)));
    const checkedWord = ref(lyrics.value[lyricsId.value].findIndex((e) => e.delay >= startTime.value));
    const inputLyrics = ref([]);

    let startedTypingEarly = false;
    let startedVeryEarly = false;
    let startedVeryEarlyNext = false;
    
    const songState = ref("Loading song...");
    const imageState = ref("Loading background image...");
    const imageStateColor = ref(255);
    const currentHue = ref(0);
    const currentBrightness = ref(100);
    const filteredFilters = ref([]);
    const paused = ref(false);
    let pauseStartTime = 0;
    let selectedBeforePause;
    let shiftHeld = false;
    const songPosition = ref(0);
    let previouslyInsideLyricless = false;
    const targetFPS = localStorage.getItem("targetFPS") ? localStorage.getItem("targetFPS") : 60;
    const nonDecimalCurrentTime = localStorage.getItem("nonDecimalCurrentTime");
    const reduceTransparency = localStorage.getItem("reduceTransparency");

    const wordStatistics = ref({
        X: 0,
        Vv: 0,
        Ve: 0,
        V: 0,
        Vl: 0,
        "~v": 0,
        "~e": 0,
        "~": 0,
        "~l": 0
    });

    const additionalWordCorrectnessFeedback = ref(localStorage.getItem("additionalWordCorrectnessFeedback"));
    const scoringData = [
        { code: "", color: "#000000", score: 0 },
        { code: "X", color: "#ff0000", score: 0 },
        { code: "Vv", color: "#00600f", score: 0.333 },
        { code: "Ve", color: "#00b11b", score: 0.75 },
        { code: "V", color: "#38ff56", score: 1 },
        { code: "Vl", color: "#00600f", score: 0.333 },
        { code: "~v", color: "#656200", score: 0.08325 },
        { code: "~e", color: "#aeb000", score: 0.1875 },
        { code: "~", color: "#fffe54", score: 0.25 },
        { code: "~l", color: "#656200", score: 0.08325 },
    ];

    const lyricsSettingList = ["capitalization", "accentLetters", "specialCharacters"];
    const saveHighscores = ref(localStorage.getItem("saveHighscores"));
    const highscoreKey = props.data.id + "-" + speed.value + "-" + startTime.value + "-" + props.data.skipLyricless + "-" + lyricsSettingList.map((e) => props.data.lyricsSettings[e] ? '1' : '0').join("") + (props.data.wordLengthLimit ? "-wll" + props.data.wordLengthLimit : "");
    const highscore = ref(localStorage.getItem(highscoreKey) ? localStorage.getItem(highscoreKey) : -1);
    const continuedWithSettings = ref(false);

    const startWord = lyrics.value.filter((e, idx) => idx < lyricsId.value).reduce((sum, e) => sum + e.length, 0) + checkedWord.value;
    const sizeRefresh = ref(false);
    const correctnessStates = ref([]);
    let inputs;
    let timeInterval;
    let song;
    document.body.style.overflowY = "hidden";
    document.title = "Lyrhythmics - " + (props.data.name ? props.data.name : "Unnamed map");

    const visibleLyrics = computed(() => {
        return lyrics.value.filter((e) => e.some((e2) => window.innerHeight * (e2.delay / speed.value - time.value) / 3.5 >= -30 && window.innerHeight * (e2.delay / speed.value - time.value) / 3.5 <= window.innerHeight));
    });

    const windowHeight = computed(() => {
        sizeRefresh.value;
        return window.innerHeight;
    });

    const score = computed(() => {
        return scoringData.reduce((total, e, idx) => total + (idx == 0 ? 0 : wordStatistics.value[e.code] * e.score), 0);
    });

    onMounted(async () => {
        try {
            song = new Audio(props.data.song);
            await song.play();
            song.pause();
        } catch { 
            songState.value = "Failed to load song.";
            return;
        }

        songState.value = "Loaded";
        if (!finished.value) {
            addEventListener("keydown", play);
            addEventListener("resize", onResize);

            setTimeout(() => {
                correctnessStates.value = new Array(document.querySelectorAll("input").length).fill("");
            }, 0);
        }

        setTimeout(() => {
            window.scrollTo({ top: Math.round(window.innerHeight * time.value / 3.5) })
        }, 0);
    })

    onUnmounted(() => {
        removeEventListener("keydown", play);
        removeEventListener("resize", onResize);
        removeEventListener("keydown", playingKeydown);
        removeEventListener("keyup", playingKeyup);
        clearInterval(timeInterval);
        if (song) {
            song.pause();
        }
    })

    watch(paused, () => {
        if (paused.value) { 
            song.pause();
            pauseStartTime = Date.now();

            if (document.activeElement != document.body) {
                selectedBeforePause = document.activeElement;
                document.activeElement.blur();
            } else {
                selectedBeforePause = null;
            }

            if (props.data.playtesting) {
                emit("quitPlaytesting");
            }
        } else {
            if (selectedBeforePause && !Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement)) {
                selectedBeforePause.focus();
            }
            
            if (timeAtStart) {
                song.play();
                skippedTime -= (Date.now() - pauseStartTime) / 1000;
            }
        }
    });

    watch(inputLyrics, () => {
        if (props.data.autospace && Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement) && inputLyrics.value[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement)] == lyrics.value[lyricsId.value][Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement)].word && Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != lyrics.value[lyricsId.value].length - 1) {
            inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) + 1].focus();
        }
    }, { deep: true });

    function onResize() {
        sizeRefresh.value = !sizeRefresh.value;
    }

    function setBackgroundFilters() {
        if (time.value * speed.value > filteredFilters.value[0].start) {
            filteredFilters.value = backgroundFilters.value.filter((e) => e.start - e.transitionDuration <= time.value * speed.value);
        }

        currentHue.value = filteredFilters.value[filteredFilters.value.length - 1].hue - (filteredFilters.value.length != 1 && time.value * speed.value - filteredFilters.value[filteredFilters.value.length - 1].start < 0 ? (filteredFilters.value[filteredFilters.value.length - 1].hue > filteredFilters.value[filteredFilters.value.length - 2].hue ? filteredFilters.value[filteredFilters.value.length - 1].hue - filteredFilters.value[filteredFilters.value.length - 2].hue : (filteredFilters.value[filteredFilters.value.length - 2].hue - filteredFilters.value[filteredFilters.value.length - 1].hue) * -1) * ((filteredFilters.value[filteredFilters.value.length - 1].start - time.value * speed.value) / filteredFilters.value[filteredFilters.value.length - 1].transitionDuration) : 0);

        currentBrightness.value = filteredFilters.value[filteredFilters.value.length - 1].brightness - (filteredFilters.value.length != 1 && time.value * speed.value - filteredFilters.value[filteredFilters.value.length - 1].start < 0 ? (filteredFilters.value[filteredFilters.value.length - 1].brightness > filteredFilters.value[filteredFilters.value.length - 2].brightness ? filteredFilters.value[filteredFilters.value.length - 1].brightness - filteredFilters.value[filteredFilters.value.length - 2].brightness : (filteredFilters.value[filteredFilters.value.length - 2].brightness - filteredFilters.value[filteredFilters.value.length - 1].brightness) * -1) * ((filteredFilters.value[filteredFilters.value.length - 1].start - time.value * speed.value) / filteredFilters.value[filteredFilters.value.length - 1].transitionDuration) : 0);
    }
    filteredFilters.value = backgroundFilters.value.filter((e) => e.start - e.transitionDuration <= time.value * speed.value);
    setBackgroundFilters();

    function play(e) {
        if (e.key == "Escape") {
            paused.value = true;
            return;
        } else if (paused.value) {
            return;
        }

        song.playbackRate = speed.value;
        song.currentTime = song.currentTime ? song.currentTime : startTime.value;
        song.preservesPitch = !localStorage.getItem("changeThePitch");
        song.play();

        function onSongPause() {
            if (song.currentTime != song.duration) {
                paused.value = true;
            }
        }
        song.addEventListener("pause", onSongPause);

        song.addEventListener("play", () => {
            paused.value = false;
            if (finished.value) {
                song.pause();
            }
        });

        removeEventListener("keydown", play);
        timeAtStart = Date.now();

        timeInterval = setInterval(() => {
            if (paused.value) {
                return;
            }

            time.value = (Date.now() - timeAtStart) / 1000 + startTime.value / speed.value + skippedTime + continueOffset;
            songPosition.value = song.currentTime / speed.value;
            window.scrollTo({ top: Math.round(window.innerHeight * time.value / 3.5)});
            setBackgroundFilters();

            if (partsWithoutLyrics.length && time.value >= partsWithoutLyrics[0].start / speed.value) {                
                skippedTime += partsWithoutLyrics[0].end / speed.value - time.value;
                song.currentTime += (partsWithoutLyrics[0].end / speed.value - time.value) * speed.value;
                partsWithoutLyrics.shift();
            }

            if (time.value >= lyrics.value[lyricsId.value][checkedWord.value].delay / speed.value) {
                if (checkedWord.value != 0 && (correctnessStates.value[checkedWord.value - 1][0] == "~" || correctnessStates.value[checkedWord.value - 1] == "X") && checkedWord.value != 0 && inputLyrics.value[checkedWord.value - 1] == lyrics.value[lyricsId.value][checkedWord.value - 1].word) {
                    wordStatistics.value[correctnessStates.value[checkedWord.value - 1]]--;
                    correctnessStates.value[checkedWord.value - 1] = "Vl";
                    wordStatistics.value.Vl++;
                } else if (checkedWord.value != 0 && correctnessStates.value[checkedWord.value - 1] == "X" && lyrics.value[lyricsId.value][checkedWord.value - 1].word.length >= 3 // checking for typo in 3+ char words
                           && ((inputLyrics.value[checkedWord.value - 1].length == lyrics.value[lyricsId.value][checkedWord.value - 1].word.length && inputLyrics.value[checkedWord.value - 1].split("").filter((e, idx) => e == lyrics.value[lyricsId.value][checkedWord.value - 1].word[idx]).length == lyrics.value[lyricsId.value][checkedWord.value - 1].word.length - 1) // same length, one wrong char
                           || (inputLyrics.value[checkedWord.value - 1].length == lyrics.value[lyricsId.value][checkedWord.value - 1].word.length + 1 && new Array(inputLyrics.value[checkedWord.value - 1].length).fill(inputLyrics.value[checkedWord.value - 1]).map((e, idx) => e.slice(0, idx) + e.slice(idx + 1) == lyrics.value[lyricsId.value][checkedWord.value - 1].word).some(e => e)) // longer by one, additional char
                           || (inputLyrics.value[checkedWord.value - 1].length == lyrics.value[lyricsId.value][checkedWord.value - 1].word.length - 1 && new Array(lyrics.value[lyricsId.value][checkedWord.value - 1].word.length).fill(lyrics.value[lyricsId.value][checkedWord.value - 1].word).map((e, idx) => e.slice(0, idx) + e.slice(idx + 1) == inputLyrics.value[checkedWord.value - 1]).some(e => e)) // shorter by one, missing char) 
                           || (inputLyrics.value[checkedWord.value - 1].length == lyrics.value[lyricsId.value][checkedWord.value - 1].word.length && new Array(inputLyrics.value[checkedWord.value - 1].length - 1).fill(inputLyrics.value[checkedWord.value - 1]).map((e, idx) => e.split("").map((e2, idx2) => idx2 == idx ? e[idx2 + 1] : idx2 == idx + 1 ? e[idx] : e2).join("") == lyrics.value[lyricsId.value][checkedWord.value - 1].word).some(e => e)))) { // same length, swapped chars
                    correctnessStates.value[checkedWord.value - 1] = "~l";
                    wordStatistics.value.X--;
                    wordStatistics.value["~l"]++;
                }

                if (inputLyrics.value[checkedWord.value] == lyrics.value[lyricsId.value][checkedWord.value].word) {
                    correctnessStates.value[checkedWord.value] = startedVeryEarly ? 
                                                                    "Vv" 
                                                                    : startedTypingEarly ? 
                                                                        'Ve' 
                                                                        : 'V';
                    wordStatistics.value[correctnessStates.value[checkedWord.value]]++;
                } else {
                    if (!inputLyrics.value[checkedWord.value]) {
                        inputLyrics.value[checkedWord.value] = "";
                    }

                    if (lyrics.value[lyricsId.value][checkedWord.value].word.length >= 3 // checking for typo in 3+ char words
                        && ((inputLyrics.value[checkedWord.value].length == lyrics.value[lyricsId.value][checkedWord.value].word.length && inputLyrics.value[checkedWord.value].split("").filter((e, idx) => e == lyrics.value[lyricsId.value][checkedWord.value].word[idx]).length == lyrics.value[lyricsId.value][checkedWord.value].word.length - 1) // same length, one wrong char
                        || (inputLyrics.value[checkedWord.value].length == lyrics.value[lyricsId.value][checkedWord.value].word.length + 1 && new Array(inputLyrics.value[checkedWord.value].length).fill(inputLyrics.value[checkedWord.value]).map((e, idx) => e.slice(0, idx) + e.slice(idx + 1) == lyrics.value[lyricsId.value][checkedWord.value].word).some(e => e)) // longer by one, additional char
                        || (inputLyrics.value[checkedWord.value].length == lyrics.value[lyricsId.value][checkedWord.value].word.length - 1 && new Array(lyrics.value[lyricsId.value][checkedWord.value].word.length).fill(lyrics.value[lyricsId.value][checkedWord.value].word).map((e, idx) => e.slice(0, idx) + e.slice(idx + 1) == inputLyrics.value[checkedWord.value]).some(e => e)) // shorter by one, missing char
                        || (inputLyrics.value[checkedWord.value].length == lyrics.value[lyricsId.value][checkedWord.value].word.length && new Array(inputLyrics.value[checkedWord.value].length - 1).fill(inputLyrics.value[checkedWord.value]).map((e, idx) => e.split("").map((e2, idx2) => idx2 == idx ? e[idx2 + 1] : idx2 == idx + 1 ? e[idx] : e2).join("") == lyrics.value[lyricsId.value][checkedWord.value].word).some(e => e)))) { // same length, swapped chars
                        correctnessStates.value[checkedWord.value] = startedVeryEarly ?
                                                                        "~v"
                                                                        : startedTypingEarly ? 
                                                                            '~e' 
                                                                            : '~';
                        wordStatistics.value[correctnessStates.value[checkedWord.value]]++;
                    } else {
                        correctnessStates.value[checkedWord.value] = "X";
                        wordStatistics.value.X++;
                    }
                }

                if (props.data.autospace && inputs[checkedWord.value] == document.activeElement && checkedWord.value != lyrics.value[lyricsId.value].length - 1) {
                    inputs[checkedWord.value + 1].focus();
                }

                if (checkedWord.value == lyrics.value[lyricsId.value].length - 1) {
                    if (lyricsId.value == lyrics.value.length - 1) {
                        time.value = Math.round(lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay / speed.value * 100) / 100;
                        checkedWord.value++;
                        clearInterval(timeInterval);
                        removeEventListener("keydown", playingKeydown);
                        song.removeEventListener("pause", onSongPause);
                        song.pause();

                        if (props.data.playtesting) {
                            emit("quitPlaytesting");
                        } else {
                            finished.value = true;
                            finalScore.value = Math.round(score.value / (lyrics.value.filter((e, idx) => idx < lyricsId.value).reduce((sum, e) => sum + e.length, 0) + checkedWord.value - startWord) * 10000) / 100;
                            document.activeElement.blur();

                            if (!continuedWithSettings.value && finalScore.value > highscore.value && saveHighscores.value) {
                                localStorage.setItem(highscoreKey, finalScore.value);
                                if (localStorage.getItem("highscores")) {
                                    localStorage.setItem("highscores", JSON.stringify([ ...JSON.parse(localStorage.getItem("highscores")), highscoreKey ]));
                                } else {
                                    localStorage.setItem("highscores", JSON.stringify([ highscoreKey ]));
                                }
                            }
                        }
                    } else {
                        lyricsId.value++;
                        checkedWord.value = 0;
                        inputLyrics.value = [];
                        inputs[0].focus();
                        startedTypingEarly = false;
                        startedVeryEarly = false;
                        startedVeryEarlyNext = false;

                        setTimeout(() => {
                            inputs = document.querySelectorAll("input");
                            correctnessStates.value = new Array(document.querySelectorAll("input").length).fill("");
                        })
                    }
                } else {
                    startedVeryEarly = startedVeryEarlyNext;
                    startedVeryEarlyNext = inputLyrics.value[checkedWord.value + 2] ? true : false;
                    startedTypingEarly = inputLyrics.value[checkedWord.value + 1] && !startedVeryEarly ? true : false;
                    checkedWord.value++;
                }
            }
        }, 1000 / targetFPS);

        inputs = document.querySelectorAll("input");
        if (inputs.length && !Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement)) {
            inputs[checkedWord.value].focus();
        }

        addEventListener("keydown", playingKeydown);
        addEventListener("keyup", playingKeyup);
    }

    function enableHighscores() {
        localStorage.setItem(highscoreKey, finalScore.value);
        localStorage.setItem("highscores", JSON.stringify([ highscoreKey ]));
        localStorage.setItem("saveHighscores", true);
        saveHighscores.value = true;
    }

    function playingKeydown(e) {
        if (e.key == "Escape") {
            paused.value = true;
        } else if (!paused.value) {
            if (e.key == " " && Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != Object.keys(inputs).length - 1) {
                inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) + 1].focus();
            } else if (props.data.automapSongSkipping) {
                if (e.key == "Shift") {
                    shiftHeld = true;
                } else if (shiftHeld && e.key == "ArrowLeft") {
                    song.currentTime -= 2 * speed.value;
                    song.play();
                } else if (shiftHeld && e.key == "ArrowRight") {
                    song.currentTime += 2 * speed.value;
                }
            }
        }
    }

    function playingKeyup(e) {
        if (props.data.automapSongSkipping && e.key == "Shift") {
            shiftHeld = false;
        }
    }

    function imageLoadFailed() {
        imageState.value = "Failed to load image.";
        setTimeout(() => {
            const interval = setInterval(() => {
                imageStateColor.value -= 5 * 60 / targetFPS;
                if (imageStateColor.value <= 0) {
                    imageStateColor.value = 0;
                    clearInterval(interval);
                }
            }, 1000 / targetFPS);
        }, 5000);
    }

    function isInsideLyricless() {
        const isInside = !visibleLyrics.value.some((e) => JSON.stringify(e) == JSON.stringify(lyrics.value[lyricsId.value])) && checkedWord.value == 0;

        if (!isInside && previouslyInsideLyricless) {
            setTimeout(() => {
                inputs = document.querySelectorAll("input");
                inputs[0].focus();
                if (checkedWord.value == 0) {
                    correctnessStates.value = new Array(document.querySelectorAll("input").length).fill("");
                }
            }, 0);
        }

        previouslyInsideLyricless = isInside;
        return isInside;  
    };

    function calculateInputWidth(verseLength) { 
        sizeRefresh.value;
        return window.innerWidth / verseLength + "px";
    }

    function calculateTop(delay) {
        sizeRefresh.value;
        return window.innerHeight * delay / speed.value / 3.5;
    }

    function quit() {
        emit("setData", {}, false);
        router.push("/");
    }

    function downloadMap() {
        const blob = new Blob([JSON.stringify({ ...props.data, downloadButton: false })], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (props.data.name ? props.data.name : "Unnamed Lyrhythmics map") + ".json";
        a.click();
    }

    function aOrAnNumber(number) {
        return number[0] == "8" || (number.match(/^(11|18)/) && (number.length - 2) % 3 == 0) ? "an " : "a ";
    }

    function unpause(data) {
        if (Object.keys(data).length) {
            lyrics.value = data.lyrics.map((e, idx) => idx <= lyricsId.value ? unfilteredLyrics[idx] : e.map((e2) => { return data.lyricsSettings.capitalization ? e2 : { word: e2.word.toLowerCase(), delay: e2.delay }}).map((e2) => { return data.lyricsSettings.accentLetters ? e2 : { word: e2.word.replace(/ł/g, "l").replace(/Ł/g, "L").replace(/Ø/g, "O").replace(/ø/g, "o").normalize("NFKD").replace(/\p{Diacritic}/gu, ""), delay: e2.delay } }).map((e2) => { return data.lyricsSettings.specialCharacters ? e2 : { word: e2.word.replace(/\P{Letter}/gu, ""), delay: e2.delay } }).filter((e2) => e2.word).map((e2) => data.wordLengthLimit ? { ...e2, word: e2.word.slice(0, data.wordLengthLimit) } : e2 ));
            unfilteredLyrics = lyrics.value;
            lyrics.value = lyrics.value.filter((e) => e.length);

            if (data.autospace) {
                inputs[checkedWord.value].focus();
            }

            continueOffset -= (time.value - startTime.value / speed.value) - (time.value - startTime.value / speed.value) * speed.value / data.speed;
            speed.value = data.speed;
            song.playbackRate = speed.value
            time.value = (timeAtStart ? (Date.now() - timeAtStart) / 1000 : 0) + startTime.value / speed.value + skippedTime + continueOffset;

            if (data.skipLyricless && !props.data.skipLyricless) {
                partsWithoutLyrics = props.data.partsWithoutLyrics.filter((e) => e.end / speed.value > time.value);
                if (timeAtStart == 0 && partsWithoutLyrics.length && time.value >= partsWithoutLyrics[0].start / speed.value) {
                    skippedTime += partsWithoutLyrics[0].end / speed.value - time.value;
                    song.currentTime = partsWithoutLyrics[0].end;
                    partsWithoutLyrics.shift();   
                    time.value = startTime.value / speed.value + skippedTime + continueOffset;
                    window.scrollTo({ top: Math.round(window.innerHeight * time.value / 3.5)});
                    setBackgroundFilters();
                }
            } else if (!data.skipLyricless && props.data.skipLyricless) {
                partsWithoutLyrics = [];
            }
            emit("setData", data, false);
            continuedWithSettings.value = true;
        }
        paused.value = false;
    }
</script>

<template>
    <main
        v-if="songState != 'Loaded'"
        class="w-screen h-screen flex justify-center items-center text-white font-bold text-4xl bg-neutral-900"
    >{{ songState }}</main>

    <main 
        v-else
        class="flex flex-col items-end min-h-screen text-white"
        :style="{ height: windowHeight + calculateTop(lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay) + 20 + 'px' }"
    >
        <div 
            class="fixed h-screen w-screen select-none font-bold text-3xl bg-neutral-900 flex justify-center items-center"
            :style="{ color: `rgb(${imageStateColor}, ${imageStateColor}, ${imageStateColor})` }"
        >
            <p v-if="imageStateColor != 0">{{ imageState }}</p>
        </div>
        <img
            class="fixed h-screen w-screen object-cover select-none text-black text-[0px]" 
            :style="{ filter: 'hue-rotate(' + currentHue + 'deg) brightness(' + currentBrightness / 100 + ')' }"
            :src="props.data.backgroundImage" 
            alt="Background"
            draggable="false"
            @error="imageLoadFailed()"
        >

        <div 
            v-if="!isInsideLyricless()"
            class="flex z-1 backdrop-blur-md fixed"
        >
            <div 
                :class="reduceTransparency ? 'flex items-center justify-end [-webkit-text-stroke:0.75px_black] font-bold' : 'flex items-center justify-end'"
                v-for="lyric, idx in lyrics[lyricsId]"
            >
                <input 
                    class="p-2 pt-1.5 text-center focus:border-white focus:backdrop-brightness-175 outline-0 border-t-2 border-white/0 placeholder-neutral-400"
                    v-model="inputLyrics[idx]"
                    :style="{ width: calculateInputWidth(lyrics[lyricsId].length),
                              backgroundColor: scoringData.filter((e) => (!e.code && !correctnessStates[idx]) || e.code == correctnessStates[idx])[0].color + (reduceTransparency ? 'E6' : '66') }"
                    :placeholder="lyric.word"
                    :tabindex="paused || finished ? -1 : 0"
                    type="text"
                    @input="inputLyrics[idx] = inputLyrics[idx].trim()"
                >
                
                <p 
                    v-if="additionalWordCorrectnessFeedback"
                    class="absolute pointer-events-none mr-2"
                >
                    {{ correctnessStates[idx] }}
                </p>
            </div>
        </div>

        <div
            v-else-if="time == startTime / speed"
            class="fixed top-1.5 w-full flex justify-center"
        >
            <p class="bg-black/[var(--bg-40)] px-4 py-1.25 rounded-xl backdrop-blur-md max-w-[calc(100vw-375px)] text-center">
                Press any key to start. {{ 
                    (startTime == 0 ? "The map starts with " + (props.data.partsWithoutLyrics.length && props.data.partsWithoutLyrics[0].start == 0 ? aOrAnNumber(Math.round(data.partsWithoutLyrics[0].end / speed).toString()) + Math.round(data.partsWithoutLyrics[0].end / speed) + " second" + (Math.round(props.data.partsWithoutLyrics[0].end / speed) == 1 ? "" : "s") + " long" : aOrAnNumber(Math.round(lyrics[0][0].delay / speed - 3.5).toString()) + Math.round(lyrics[0][0].delay / speed - 3.5) + " second" + (Math.round(lyrics[0][0].delay / speed - 3.5) == 1 ? "" : "s") + " long unmarked") + " lyricless part" 
                    : "You started in a" + (data.partsWithoutLyrics.filter((e) => e.start <= time && e.end > time).length ? " lyricless part. It ends in " + Math.round(data.partsWithoutLyrics.filter((e) => e.start <= time && e.end > time)[0].end / speed - time) + " second" + (Math.round(data.partsWithoutLyrics.filter((e) => e.start <= time && e.end > time)[0].end / speed - time) == 1 ? "" : "s") : "n unmarked lyricless part. It ends in " + Math.round(lyrics.filter(e => e[0].delay / speed > time)[0][0].delay / speed - 3.5 - time) + " second" + (Math.round(lyrics.filter(e => e[0].delay / speed > time)[0][0].delay / speed - 3.5 - time) == 1 ? "" : "s"))) 
                    + (data.skipLyricless || data.forceskip ? ". As it's unmarked, it wasn't skipped." : ".") }}
            </p>
        </div>

        <div 
            v-for="verse in visibleLyrics"
            class="flex"
        >
            <div 
                v-for="lyric in verse" 
                :style="{ width: calculateInputWidth(verse.length) }"
            >
                <p
                    class="absolute select-none flex justify-center text-center break-words"
                    :style="{ width: calculateInputWidth(verse.length), 
                              top: calculateTop(lyric.delay) + 'px' }"
                >
                    <span class="bg-black/[var(--bg-40)] px-4 py-1.25 relative bottom-1 rounded-xl backdrop-blur-md max-w-full">
                        {{ lyric.word }}
                    </span>
                </p>
            </div>
        </div>
        
        <div 
            class="bg-black/[var(--bg-40)] mr-5 px-4 py-2 rounded-xl flex items-center flex-col z-1 backdrop-blur-md fixed"
            :style="{ top: data.playtesting ? 
                            '64px'
                            : isInsideLyricless() ?
                                '16px'
                                : '56px' }"
        >
            <h1 class="font-bold">
                Score: {{ lyrics.filter((e, idx) => idx < lyricsId).reduce((sum, e) => sum + e.length, 0) + checkedWord == startWord ? 
                            "??%" 
                            : Math.round(score / (lyrics.filter((e, idx) => idx < lyricsId).reduce((sum, e) => sum + e.length, 0) + checkedWord - startWord) * 100) + "%" }}
            </h1>
            <p>{{ nonDecimalCurrentTime ? Math.round(time) : (Math.round(time * 100) / 100).toFixed(2) }}s / {{ Math.round(lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay / speed * 100) / 100 }}s</p>
            <p v-if="data.automapSongSkipping">Song: {{ (Math.round(songPosition * 100) / 100).toFixed(2) }}s</p>
        </div>

        <div 
            v-if="paused"
            class="fixed left-0 z-9 w-screen h-screen flex justify-center items-center text-white"
        >
            <MapCustomization 
                :pausedVariant="true"
                :data="data"
                :continuedWithSettings="continuedWithSettings"
                @continue="(data) => unpause(data)"
                @setData="(data) => $emit('setData', data, true)"
            />
        </div>

        <div
            v-if="finished"
            class="fixed left-0 w-screen h-screen flex justify-center items-center text-white z-10 text-center"
        >
            <div class="fixed w-screen h-screen bg-black/[var(--bg-60)] backdrop-blur-xs"></div> 
            <div class="flex flex-col items-center max-h-full w-full py-2 overflow-y-auto z-11">
                <PinkHeader 
                    :text="'Score: ' + (finalScore == -1 ? '??' : finalScore) + '%'" 
                />

                <p class="mb-2">The map ended. {{ checkedWord == 0 ? 'The lyrics customization settings that you chose removed all of its lyrics' + (lyrics.length != 1 ? ' past your start time.' : '.') : '' }}</p>

                <p
                    v-if="checkedWord != 0 && !continuedWithSettings" 
                    :class="finalScore > highscore ? 'font-bold' : ''"
                >
                    {{ finalScore > highscore ? "New highscore!" : "Highscore: " }}
                    <b v-if="finalScore <= highscore">{{ highscore }}%</b>
                </p>

                <table :class="continuedWithSettings ? '' : 'mt-2'">
                    <thead>
                        <tr>
                            <th class="border-t-0 border-l-0"></th>
                            <th class="border-t-0">Very early</th>
                            <th class="border-t-0">Early</th>
                            <th class="border-t-0">Perfect</th>
                            <th class="border-t-0">Late</th>
                            <th class="border-t-0 border-r-0">Total</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <th class="border-l-0">Correct</th>
                            <td>{{ wordStatistics.Vv }}</td>
                            <td>{{ wordStatistics.Ve }}</td>
                            <td>{{ wordStatistics.V }}</td>
                            <td>{{ wordStatistics.Vl }}</td>
                            <td class="border-r-0">{{ wordStatistics.Vv + wordStatistics.Ve + wordStatistics.V + wordStatistics.Vl }}</td>
                        </tr>

                        <tr>
                            <th class="border-l-0">Typo</th>
                            <td>{{ wordStatistics["~v"] }}</td>
                            <td>{{ wordStatistics["~e"] }}</td>
                            <td>{{ wordStatistics["~"] }}</td>
                            <td>{{ wordStatistics["~l"] }}</td>
                            <td class="border-r-0">{{ wordStatistics["~v"] + wordStatistics["~e"] + wordStatistics["~"] + wordStatistics["~l"] }}</td>
                        </tr>

                        <tr>
                            <th class="border-b-0 border-l-0">Wrong</th>
                            <td class="border-b-0">-</td>
                            <td class="border-b-0">-</td>
                            <td class="border-b-0">-</td>
                            <td class="border-b-0">-</td>
                            <td class="border-b-0 border-r-0">{{ wordStatistics.X }}</td>
                        </tr>
                    </tbody>
                </table>

                <p 
                    v-if="!saveHighscores && !continuedWithSettings"
                    class="max-w-150 mt-2"
                >You have saving highscores disabled, you can enable it by pressing the button below. The highscores will be saved in your device's local storage.</p>

                <div class="flex gap-3 mt-2.5 items-center">
                    <button
                        class="button h-fit"
                        @click="quit()"
                    >
                        Main menu
                    </button>

                    <button
                        v-if="data.downloadButton"
                        class="button h-fit"
                        @click="downloadMap()"
                    >
                        Download map
                    </button>

                    <button
                        v-if="!saveHighscores && !continuedWithSettings"
                        class="button h-fit"
                        @click="enableHighscores()"
                    >
                        Enable saving highscores
                    </button>

                    <button
                        class="button h-fit"
                        @click="$emit('setData', data, true)"
                    >
                        Play again
                    </button>
                </div>
            </div>
        </div>
    </main>
</template>