<script setup>
    import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
    import { useRouter } from 'vue-router';
    import config from "@/configs/config.json";
    import MapCustomization from "@/components/MapCustomization.vue";
    import PinkHeader from '@/components/PinkHeader.vue';
    import MenuPanel from "@/components/MenuPanel.vue";

    const props = defineProps([
        "data",
        "defaultBackground",
        "fullscreenButtonShown"
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
    let additionalFinishInfo = "";
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
            additionalFinishInfo = "The lyrics customization settings that you chose removed all of its lyrics" + (lyrics.value.length != 1 ? " past your start time." : ".");
            finished.value = true;
            finalScore.value = -1;
        }
    }

    const time = ref(startTime.value / speed.value);
    let timeAtStart = 0;
    
    let skippedTime = 0;
    let continueOffset = 0;

    const checkedLyricsId = ref(lyrics.value.findIndex((e) => e.some((e2) => e2.delay >= startTime.value)));
    const typedLyricsId = ref(checkedLyricsId.value);
    const checkedWord = ref(lyrics.value[checkedLyricsId.value].findIndex((e) => e.delay >= startTime.value));
    const inputLyrics = ref(lyrics.value.map((e) => new Array()));
    const correctnessStates = ref(lyrics.value.map((e) => new Array(e.length).fill("")));
    let dontGoToNext = false;

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
    let selectedBeforeLyricless;
    let shiftHeld = false;
    const songPosition = ref(0);
    let previouslyInsideLyricless = false;
    
    const targetFPS = localStorage.getItem("targetFPS") ?? 60;
    const nonDecimalCurrentTime = localStorage.getItem("nonDecimalCurrentTime");
    const decimalScore = localStorage.getItem("decimalScore");
    const reduceTransparency = localStorage.getItem("reduceTransparency");
    let disableBackgroundFilters = localStorage.getItem("disableBackgroundFilters");

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
        { code: "", score: 0 },
        { code: "X", score: 0 },
        { code: "Vv", score: 0.333 },
        { code: "Ve", score: 0.75 },
        { code: "V", score: 1 },
        { code: "Vl", score: 0.333 },
        { code: "~v", score: 0.08325 },
        { code: "~e", score: 0.1875 },
        { code: "~", score: 0.25 },
        { code: "~l", score: 0.08325 },
    ];

    const theme = localStorage.getItem("theme") ? JSON.parse(localStorage.getItem("theme")) : config.defaultTheme;
    for (let i of scoringData) {
        i.color = theme.inputColors[i.code];
    }

    const lyricsSettingList = ["capitalization", "accentLetters", "specialCharacters"];
    const saveHighscores = ref(localStorage.getItem("saveHighscores"));
    const highscoreKey = props.data.id + "-" + speed.value + "-" + startTime.value + "-" + props.data.skipLyricless + "-" + lyricsSettingList.map((e) => props.data.lyricsSettings[e] ? '1' : '0').join("") + (props.data.wordLengthLimit ? "-wll" + props.data.wordLengthLimit : "") + (props.data.autospace ? "-as" : "") + (props.data.freeVerseChanging ? "-fvc" : "");
    const highscore = ref(localStorage.getItem(highscoreKey) ?? -1);
    const continuedWithSettings = ref(false);
    const mobile = navigator.userAgent.match(/Android|iPhone|iPad/);

    const startWord = lyrics.value.filter((e, idx) => idx < checkedLyricsId.value).reduce((sum, e) => sum + e.length, 0) + checkedWord.value;
    const sizeRefresh = ref(false);
    let inputs;
    let timeInterval;
    let song;

    document.body.style.overflowY = "hidden";
    document.title = "Lyrhythmics - " + (props.data.name ? props.data.name : "Unnamed map");

    let previousTimestamp = 0;
    const lagWarning = ref(false);
    let framesWithoutHugeLag = 0;
    const thinScreen = ref(!window.matchMedia("(min-width: 40rem)").matches);

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
        }

        setTimeout(() => {
            window.scrollTo({ top: Math.round(window.innerHeight * time.value / 3.5) })
        }, 0);
    });

    onUnmounted(() => {
        removeEventListener("keydown", play);
        removeEventListener("resize", onResize);
        removeEventListener("keydown", playingKeydown);
        removeEventListener("keyup", playingKeyup);
        clearInterval(timeInterval);
        if (song) {
            song.pause();
            song.currentTime = song.duration;
        }
    });

    watch(paused, () => {
        if (paused.value) { 
            song.pause();
            pauseStartTime = Date.now();

            if (inputs && Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement)) {
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
                previousTimestamp = Date.now();
                skippedTime -= (Date.now() - pauseStartTime) / 1000;

                time.value = (Date.now() - timeAtStart) / 1000 + startTime.value / speed.value + skippedTime + continueOffset;
                song.currentTime = time.value * speed.value;
                song.play();
            }
        }
    });

    watch(inputLyrics, () => {
        if (typedLyricsId.value == checkedLyricsId.value && checkedWord.value != 0) {
            if ((correctnessStates.value[checkedLyricsId.value][checkedWord.value - 1][0] == "~" || correctnessStates.value[checkedLyricsId.value][checkedWord.value - 1] == "X") && inputLyrics.value[checkedLyricsId.value][checkedWord.value - 1] == lyrics.value[checkedLyricsId.value][checkedWord.value - 1].word) {
                wordStatistics.value[correctnessStates.value[checkedLyricsId.value][checkedWord.value - 1]]--;
                correctnessStates.value[checkedLyricsId.value][checkedWord.value - 1] = "Vl";
                wordStatistics.value.Vl++;
            } else if (correctnessStates.value[checkedLyricsId.value][checkedWord.value - 1] == "X" && checkForTypo(inputLyrics.value[checkedLyricsId.value][checkedWord.value - 1], lyrics.value[checkedLyricsId.value][checkedWord.value - 1].word)) {
                correctnessStates.value[checkedLyricsId.value][checkedWord.value - 1] = "~l";
                wordStatistics.value.X--;
                wordStatistics.value["~l"]++;
            }
        } else if (props.data.freeVerseChanging && typedLyricsId.value == checkedLyricsId.value - 1 && checkedWord.value == 0) {
            if ((correctnessStates.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1][0] == "~" || correctnessStates.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1] == "X") && inputLyrics.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1] == lyrics.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1].word) {
                wordStatistics.value[correctnessStates.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1]]--;
                correctnessStates.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1] = "Vl";
                wordStatistics.value.Vl++;
            } else if (correctnessStates.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1] == "X" && checkForTypo(inputLyrics.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1], lyrics.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1].word)) {
                correctnessStates.value[checkedLyricsId.value - 1][lyrics.value[checkedLyricsId.value - 1].length - 1] = "~l";
                wordStatistics.value.X--;
                wordStatistics.value["~l"]++;
            }
        }

        if (props.data.autospace && Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement) && inputLyrics.value[typedLyricsId.value][Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement)] == lyrics.value[typedLyricsId.value][Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement)].word) {
            if (Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != lyrics.value[typedLyricsId.value].length - 1) {
                inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) + 1].focus();
            } else if ((typedLyricsId.value == checkedLyricsId.value && checkedWord.value == lyrics.value[checkedLyricsId.value].length - 1 && visibleLyrics.value.length != 1) || (props.data.freeVerseChanging && typedLyricsId.value != lyrics.value.length - 1)) {
                typedLyricsId.value++;
                inputs[0].focus();

                setTimeout(() => {
                    inputs = document.querySelectorAll("input");
                }, 0);
            }
        }
    }, { deep: true });

    function onResize() {
        thinScreen.value = !window.matchMedia("(min-width: 40rem)").matches;
        sizeRefresh.value = !sizeRefresh.value;
    }

    function setBackgroundFilters() {
        if (!disableBackgroundFilters) {
            if (time.value * speed.value > filteredFilters.value[0].start) {
                filteredFilters.value = backgroundFilters.value.filter((e) => e.start - e.transitionDuration <= time.value * speed.value);
            }

            currentHue.value = filteredFilters.value[filteredFilters.value.length - 1].hue - (filteredFilters.value.length != 1 && time.value * speed.value - filteredFilters.value[filteredFilters.value.length - 1].start < 0 ? (filteredFilters.value[filteredFilters.value.length - 1].hue > filteredFilters.value[filteredFilters.value.length - 2].hue ? filteredFilters.value[filteredFilters.value.length - 1].hue - filteredFilters.value[filteredFilters.value.length - 2].hue : (filteredFilters.value[filteredFilters.value.length - 2].hue - filteredFilters.value[filteredFilters.value.length - 1].hue) * -1) * ((filteredFilters.value[filteredFilters.value.length - 1].start - time.value * speed.value) / filteredFilters.value[filteredFilters.value.length - 1].transitionDuration) : 0);

            currentBrightness.value = filteredFilters.value[filteredFilters.value.length - 1].brightness - (filteredFilters.value.length != 1 && time.value * speed.value - filteredFilters.value[filteredFilters.value.length - 1].start < 0 ? (filteredFilters.value[filteredFilters.value.length - 1].brightness > filteredFilters.value[filteredFilters.value.length - 2].brightness ? filteredFilters.value[filteredFilters.value.length - 1].brightness - filteredFilters.value[filteredFilters.value.length - 2].brightness : (filteredFilters.value[filteredFilters.value.length - 2].brightness - filteredFilters.value[filteredFilters.value.length - 1].brightness) * -1) * ((filteredFilters.value[filteredFilters.value.length - 1].start - time.value * speed.value) / filteredFilters.value[filteredFilters.value.length - 1].transitionDuration) : 0);
        }
    }
    filteredFilters.value = backgroundFilters.value.filter((e) => e.start - e.transitionDuration <= time.value * speed.value);
    setBackgroundFilters();

    function checkForTypo(word, correctWord) {
        return correctWord.length >= 3 // checking for typo in 3+ char words
               && ((word.length == correctWord.length && word.split("").filter((e, idx) => e == correctWord[idx]).length == correctWord.length - 1) // same length, one wrong char
               || (word.length == correctWord.length + 1 && new Array(word.length).fill(word).some((e, idx) => e.slice(0, idx) + e.slice(idx + 1) == correctWord)) // longer by one, additional char
               || (word.length == correctWord.length - 1 && new Array(correctWord.length).fill(correctWord).some((e, idx) => e.slice(0, idx) + e.slice(idx + 1) == word)) // shorter by one, missing char) 
               || (word.length == correctWord.length && new Array(word.length - 1).fill(word).some((e, idx) => e.split("").map((e2, idx2) => idx2 == idx ? e[idx2 + 1] : idx2 == idx + 1 ? e[idx] : e2).join("") == correctWord))); // same length, swapped chars
    }

    function onSongPause() {
        if (song.currentTime != song.duration) {
            paused.value = true;
        }
    }

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

        song.addEventListener("pause", onSongPause);
        song.addEventListener("play", () => {
            paused.value = false;
            if (finished.value) {
                song.pause();
            }
        });

        removeEventListener("keydown", play);
        timeAtStart = Date.now();
        previousTimestamp = Date.now();

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

            if (filteredFilters.value.some(e => time.value >= e.start - e.transitionDuration && time.value <= e.start) && framesWithoutHugeLag < 5 && !disableBackgroundFilters && !localStorage.getItem("disableLagPrevention")) {
                const FPS = 1000 / (Date.now() - previousTimestamp);
                if (FPS >= 15) {
                    framesWithoutHugeLag++;
                }
                
                if (FPS <= 5) {
                    lagWarning.value = true;
                    disableBackgroundFilters = true;
                }
            }
            previousTimestamp = Date.now();

            if (time.value >= lyrics.value[checkedLyricsId.value][checkedWord.value].delay / speed.value) {
                if (inputLyrics.value[checkedLyricsId.value][checkedWord.value] == lyrics.value[checkedLyricsId.value][checkedWord.value].word) {
                    correctnessStates.value[checkedLyricsId.value][checkedWord.value] = startedVeryEarly ? 
                                                                                            "Vv" 
                                                                                            : startedTypingEarly ? 
                                                                                                'Ve' 
                                                                                                : 'V';
                    wordStatistics.value[correctnessStates.value[checkedLyricsId.value][checkedWord.value]]++;
                } else {
                    if (!inputLyrics.value[checkedLyricsId.value][checkedWord.value]) {
                        inputLyrics.value[checkedLyricsId.value][checkedWord.value] = "";
                    }

                    if (checkForTypo(inputLyrics.value[checkedLyricsId.value][checkedWord.value], lyrics.value[checkedLyricsId.value][checkedWord.value].word)) {
                        correctnessStates.value[checkedLyricsId.value][checkedWord.value] = startedVeryEarly ?
                                                                                                "~v"
                                                                                                : startedTypingEarly ? 
                                                                                                    '~e' 
                                                                                                    : '~';
                        wordStatistics.value[correctnessStates.value[checkedLyricsId.value][checkedWord.value]]++;
                    } else {
                        correctnessStates.value[checkedLyricsId.value][checkedWord.value] = "X";
                        wordStatistics.value.X++;
                    }
                }

                if (props.data.autospace && inputs[checkedWord.value] == document.activeElement && checkedWord.value != lyrics.value[checkedLyricsId.value].length - 1 && typedLyricsId.value == checkedLyricsId.value) {
                    inputs[checkedWord.value + 1].focus();
                }

                if (checkedWord.value == lyrics.value[checkedLyricsId.value].length - 1) {
                    if (checkedLyricsId.value == lyrics.value.length - 1) {
                        time.value = Math.round(lyrics.value[lyrics.value.length - 1][lyrics.value[lyrics.value.length - 1].length - 1].delay / speed.value * 100) / 100;
                        checkedWord.value++;
                        finishGame();
                    } else {
                        if (checkedLyricsId.value == typedLyricsId.value && (!props.data.freeVerseChanging || (Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) == checkedWord.value && props.data.autospace))) {
                            typedLyricsId.value++;
                            inputs[0].focus();
                        }

                        checkedLyricsId.value++;
                        checkedWord.value = 0;

                        startedVeryEarly = startedVeryEarlyNext;
                        startedVeryEarlyNext = inputLyrics.value[checkedLyricsId.value][checkedWord.value + 1] ? true : false;
                        startedTypingEarly = inputLyrics.value[checkedLyricsId.value][checkedWord.value] && !startedVeryEarly ? true : false;

                        setTimeout(() => {
                            inputs = document.querySelectorAll("input");
                        });
                    }
                } else {
                    startedVeryEarly = startedVeryEarlyNext;
                    startedVeryEarlyNext = inputLyrics.value[checkedLyricsId.value][checkedWord.value + 2] || (checkedLyricsId.value != lyrics.value.length - 1 && inputLyrics.value[checkedLyricsId.value + 1][0] && checkedWord.value == inputLyrics.value[checkedLyricsId.value].length - 2) ? true : false;
                    startedTypingEarly = inputLyrics.value[checkedLyricsId.value][checkedWord.value + 1] && !startedVeryEarly ? true : false;
                    checkedWord.value++;
                }
            }
        }, 1000 / targetFPS);

        inputs = document.querySelectorAll("input");
        if (inputs.length && !Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement)) {
            inputs[checkedWord.value].focus();
            dontGoToNext = true;
        }

        addEventListener("keydown", playingKeydown);
        addEventListener("keyup", playingKeyup);
    }

    function finishGame() {
        clearInterval(timeInterval);
        removeEventListener("keydown", playingKeydown);
        song.removeEventListener("pause", onSongPause);
        song.pause();

        if (props.data.playtesting) {
            emit("quitPlaytesting");
        } else {
            finished.value = true;
            finalScore.value = Math.round(score.value / (lyrics.value.filter((e, idx) => idx < checkedLyricsId.value).reduce((sum, e) => sum + e.length, 0) + checkedWord.value - startWord) * 10000) / 100;
            document.activeElement.blur();

            if (!continuedWithSettings.value && finalScore.value > highscore.value && saveHighscores.value) {
                localStorage.setItem(highscoreKey, finalScore.value);
                if (localStorage.getItem("highscores")) {
                    localStorage.setItem("highscores", JSON.stringify({ keys: [ ...JSON.parse(localStorage.getItem("highscores")).keys, highscoreKey ], compatibilityVersion: 2 }));
                } else {
                    localStorage.setItem("highscores", JSON.stringify({ keys: [ highscoreKey ], compatibilityVersion: 2 }));
                }
            }
        }
    }

    function disableDontGoToNext() {
        dontGoToNext = false;
        if (inputLyrics.value[checkedLyricsId.value][checkedWord.value] == " ") {
            inputLyrics.value[checkedLyricsId.value][checkedWord.value] = "";
        }
    }

    function enableHighscores() {
        localStorage.setItem(highscoreKey, finalScore.value);
        localStorage.setItem("highscores", JSON.stringify({ keys: [ highscoreKey ], compatibilityVersion: 2 }));
        localStorage.setItem("saveHighscores", true);
        saveHighscores.value = true;
    }

    function playingKeydown(e) {     
        if (paused.value) {
            return;
        }

        if (e.key == "Escape") {
            paused.value = true;
        } else if (e.key == "Backspace" && Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != -1 && document.activeElement.selectionStart == 0 && document.activeElement.selectionEnd == 0) {
            if (Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != 0) {
                inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].setSelectionRange(inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].value.length, inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].value.length);
                
                setTimeout(() => {
                    inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].focus();
                }, 1);
            } else if (typedLyricsId.value == checkedLyricsId.value + 1 || (props.data.freeVerseChanging && typedLyricsId.value != 0)) {
                typedLyricsId.value--;
                
                setTimeout(() => {
                    inputs = document.querySelectorAll("input");
                    inputs[inputs.length - 1].setSelectionRange(inputs[inputs.length - 1].value.length, inputs[inputs.length - 1].value.length);

                    setTimeout(() => {
                        inputs[inputs.length - 1].focus();
                    }, 1);
                }, 0);
            }
        } else if ((e.key == "ArrowLeft" || e.key == "ArrowRight") && !shiftHeld && Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != -1 && document.activeElement.selectionStart == document.activeElement.selectionEnd) {
            if (e.key == "ArrowLeft" && document.activeElement.selectionStart == 0) {
                if (Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != 0) {
                    inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].setSelectionRange(inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].value.length, inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].value.length);
                    setTimeout(() => {
                        inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) - 1].focus();
                    }, 1);
                } else if (typedLyricsId.value == checkedLyricsId.value + 1 || (props.data.freeVerseChanging && typedLyricsId.value != 0)) {
                    typedLyricsId.value--;

                    setTimeout(() => {
                        inputs = document.querySelectorAll("input");
                        inputs[inputs.length - 1].setSelectionRange(inputs[inputs.length - 1].value.length, inputs[inputs.length - 1].value.length);

                        setTimeout(() => {
                            inputs[inputs.length - 1].focus();
                        }, 1);
                    }, 0);
                }
            } else if (e.key == "ArrowRight" && document.activeElement.selectionEnd == document.activeElement.value.length) {                
                if (Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) != Object.keys(inputs).length - 1) {
                    inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) + 1].setSelectionRange(0, 0);
                    setTimeout(() => {
                        inputs[Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) + 1].focus();
                    }, 1);
                } else if (((typedLyricsId.value == checkedLyricsId.value && checkedWord.value == lyrics.value[checkedLyricsId.value].length - 1) || props.data.freeVerseChanging) && typedLyricsId.value != lyrics.value.length - 1) {
                    typedLyricsId.value++;

                    setTimeout(() => {
                        inputs = document.querySelectorAll("input");
                        inputs[0].setSelectionRange(0, 0);

                        setTimeout(() => {
                            inputs[0].focus();
                        }, 1);
                    }, 0);
                }
            }
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

    function goToNextWord(currentIdx) {
        inputLyrics.value[typedLyricsId.value][currentIdx] = inputLyrics.value[typedLyricsId.value][currentIdx].replace(" ", "");

        if (currentIdx != lyrics.value[typedLyricsId.value].length - 1) {
            inputs[currentIdx + 1].focus();
        } else if ((typedLyricsId.value == checkedLyricsId.value && checkedWord.value == lyrics.value[checkedLyricsId.value].length - 1 && visibleLyrics.value.length != 1) || (props.data.freeVerseChanging && typedLyricsId.value != lyrics.value.length - 1)) {
            typedLyricsId.value++;
            inputs[0].focus();

            setTimeout(() => {
                inputs = document.querySelectorAll("input");
            }, 0);
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
        const isInside = !visibleLyrics.value.some((e) => JSON.stringify(e) == JSON.stringify(lyrics.value[checkedLyricsId.value])) && checkedWord.value == 0 && ((props.data.freeVerseChanging && props.data.partsWithoutLyrics.some((e) => time.value >= e.start / speed.value && time.value < e.end / speed.value)) || !props.data.freeVerseChanging);

        if (!isInside && previouslyInsideLyricless) {
            setTimeout(() => {
                inputs = document.querySelectorAll("input");
                if (!props.data.freeVerseChanging) {
                    inputs[0].focus();
                } else if (selectedBeforeLyricless != -1) {
                    inputs[selectedBeforeLyricless].focus();
                }
            }, 0);
        } else if (isInside && !previouslyInsideLyricless) {
            selectedBeforeLyricless = props.data.partsWithoutLyrics.some((e) => e.start <= startTime.value && e.end > startTime.value) && time.value / speed.value < props.data.partsWithoutLyrics.filter((e) => e.start <= startTime.value && e.end > startTime.value)[0].end ? 
                                        0 
                                        : props.data.freeVerseChanging && Object.keys(inputs).map((key) => inputs[key]).some((e) => e == document.activeElement) ? 
                                            Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement) 
                                            : -1;
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
            const lyricsId = (!props.data.freeVerseChanging || typedLyricsId.value < checkedLyricsId.value) && isInsideLyricless() ?
                                checkedLyricsId.value - 1
                                : checkedLyricsId.value > typedLyricsId.value ? 
                                    checkedLyricsId.value 
                                    : typedLyricsId.value;

            lyrics.value = data.lyrics.map((e, idx) => idx <= lyricsId ? unfilteredLyrics[idx] : e.map((e2) => { return data.lyricsSettings.capitalization ? e2 : { word: e2.word.toLowerCase(), delay: e2.delay }}).map((e2) => { return data.lyricsSettings.accentLetters ? e2 : { word: e2.word.replace(/ł/g, "l").replace(/Ł/g, "L").replace(/Ø/g, "O").replace(/ø/g, "o").normalize("NFKD").replace(/\p{Diacritic}/gu, ""), delay: e2.delay } }).map((e2) => { return data.lyricsSettings.specialCharacters ? e2 : { word: e2.word.replace(/\P{Letter}/gu, ""), delay: e2.delay } }).filter((e2) => e2.word).map((e2) => data.wordLengthLimit ? { ...e2, word: e2.word.slice(0, data.wordLengthLimit) } : e2 ));
            unfilteredLyrics = lyrics.value;
            lyrics.value = lyrics.value.filter((e) => e.length);

            inputLyrics.value = inputLyrics.value.slice(0, lyricsId + 1).concat(lyrics.value.slice(lyricsId + 1).map((e) => new Array()));
            correctnessStates.value = correctnessStates.value.slice(0, lyricsId + 1).concat(lyrics.value.slice(lyricsId + 1).map((e) => new Array(e.length).fill("")));

            if (lyrics.value.length == checkedLyricsId.value) {
                additionalFinishInfo = "The lyrics customization settings that you chose removed all of its lyrics past the point where you paused.";
                finishGame();
            }

            if (data.autospace && visibleLyrics.value.length && typedLyricsId.value == checkedLyricsId.value) {
                inputs[checkedWord.value].focus();
            }

            continueOffset -= (time.value - startTime.value / speed.value) - (time.value - startTime.value / speed.value) * speed.value / data.speed;
            speed.value = data.speed;
            song.playbackRate = speed.value;
            time.value = (timeAtStart ? (Date.now() - timeAtStart) / 1000 : 0) + startTime.value / speed.value + skippedTime + continueOffset;

            if (data.skipLyricless && !props.data.skipLyricless) {
                partsWithoutLyrics = props.data.partsWithoutLyrics.filter((e) => e.end / speed.value > time.value);
                if (timeAtStart == 0 && partsWithoutLyrics.length && time.value >= partsWithoutLyrics[0].start / speed.value) {
                    skippedTime += partsWithoutLyrics[0].end / speed.value - time.value;
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

    const a = ref(-1);
    setInterval(() => {
        a.value = Object.keys(inputs).map((key) => inputs[key]).findIndex((e) => e == document.activeElement)
    }, 10);
</script>

<template>
    <main
        v-if="songState != 'Loaded'"
        class="w-screen h-dvh flex justify-center items-center text-white font-bold text-4xl bg-neutral-900"
    >{{ songState }}</main>

    <main 
        v-else
        class="flex flex-col items-end min-h-dvh text-white"
        :style="{ height: windowHeight + calculateTop(lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay) + 20 + 'px' }"
    >
        <div 
            class="fixed h-dvh w-screen select-none font-bold text-3xl bg-neutral-900 flex justify-center items-center"
            :style="{ color: `rgb(${imageStateColor}, ${imageStateColor}, ${imageStateColor})` }"
        >
            <p v-if="imageStateColor != 0">{{ imageState }}</p>
        </div>
        <img
            class="fixed h-dvh w-screen object-cover select-none text-black text-[0px]" 
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
                v-for="lyric, idx in lyrics[typedLyricsId]"
                :class="reduceTransparency || theme.inputText.forceOutline ? 'flex items-center justify-end [-webkit-text-stroke-width:0.75px] font-bold' : 'flex items-center justify-end'"
                :style="{ '-webkit-text-stroke-color': reduceTransparency || theme.inputText.forceOutline ? theme.inputText.outlineColor : '' }"
            >
                <input 
                    class="playingInput p-2 pt-1.5 text-center focus:border-white focus:backdrop-brightness-175 outline-0 border-t-2 border-white/0"
                    type="text"
                    autocapitalize="none"
                    autocorrect="off"
                    v-model="inputLyrics[typedLyricsId][idx]"
                    :style="{ width: calculateInputWidth(lyrics[typedLyricsId].length),
                              backgroundColor: scoringData.filter((e) => e.code == correctnessStates[typedLyricsId][idx])[0].color + (reduceTransparency ? 'E6' : '66'),
                              color: theme.inputText.color,
                              '--placeholderColor': theme.inputText.placeholderColor }"
                    :placeholder="lyric.word"
                    :tabindex="paused || finished ? -1 : 0"
                    @input="dontGoToNext ? 
                                disableDontGoToNext()
                                : inputLyrics[typedLyricsId][idx].includes(' ') ? 
                                    goToNextWord(idx) 
                                    : {}"
                >
                
                <p 
                    v-if="additionalWordCorrectnessFeedback"
                    class="absolute pointer-events-none mr-2"
                >
                    {{ correctnessStates[typedLyricsId][idx] }}
                </p>
            </div>
        </div>

        <div
            v-else-if="time == startTime / speed"
            class="fixed sm:top-1.5 w-full flex flex-col items-center justify-center sm:justify-start h-full gap-3"
        >
            <p class="bg-black/[var(--bg-40)] px-4 py-1.25 rounded-xl backdrop-blur-md max-w-[calc(100vw-40px)] sm:max-w-[calc(100vw-375px)] text-center">
                {{ (mobile ? "Press the button below to start. " : "Press any key to start. ")
                    + (startTime == 0 ? "The map starts with " + (props.data.partsWithoutLyrics.length && props.data.partsWithoutLyrics[0].start == 0 ? aOrAnNumber(Math.round(data.partsWithoutLyrics[0].end / speed).toString()) + Math.round(data.partsWithoutLyrics[0].end / speed) + " second" + (Math.round(props.data.partsWithoutLyrics[0].end / speed) == 1 ? "" : "s") + " long" : aOrAnNumber(Math.round(lyrics[0][0].delay / speed - 3.5).toString()) + Math.round(lyrics[0][0].delay / speed - 3.5) + " second" + (Math.round(lyrics[0][0].delay / speed - 3.5) == 1 ? "" : "s") + " long unmarked") + " lyricless part" 
                    : "You started in a" + (data.partsWithoutLyrics.filter((e) => e.start <= time && e.end > time).length ? " lyricless part. It ends in " + Math.round(data.partsWithoutLyrics.filter((e) => e.start <= time && e.end > time)[0].end / speed - time) + " second" + (Math.round(data.partsWithoutLyrics.filter((e) => e.start <= time && e.end > time)[0].end / speed - time) == 1 ? "" : "s") : "n unmarked lyricless part. It ends in " + Math.round(lyrics.filter(e => e[0].delay / speed > time)[0][0].delay / speed - 3.5 - time) + " second" + (Math.round(lyrics.filter(e => e[0].delay / speed > time)[0][0].delay / speed - 3.5 - time) == 1 ? "" : "s"))) 
                    + (data.skipLyricless || data.forceskip ? ". As it's unmarked, it wasn't skipped." : ".") }}
            </p>
            <button 
                v-if="mobile"
                class="button w-fit"
                :tabindex="paused || finished ? -1 : 0"
                @click="play({})"
            >Start</button>
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
                    <span class="bg-black/[var(--bg-40)] px-2 sm:px-4 py-1.25 relative bottom-1 rounded-xl backdrop-blur-md max-w-full">
                        {{ lyric.word }}
                    </span>
                </p>
            </div>
        </div>
        
        <div 
            class="bg-black/[var(--bg-40)] right-4 px-4 py-2 rounded-xl flex items-center flex-col z-1 backdrop-blur-md fixed"
            :style="{ top: data.playtesting ? 
                            '64px'
                            : isInsideLyricless() ?
                                '16px'
                                : '56px' }"
        >
            <h1 class="font-bold">
                Score: {{ lyrics.filter((e, idx) => idx < checkedLyricsId).reduce((sum, e) => sum + e.length, 0) + checkedWord == startWord ? 
                            (decimalScore ? "??.??%" : "??%") 
                            : (decimalScore ? (score / (lyrics.filter((e, idx) => idx < checkedLyricsId).reduce((sum, e) => sum + e.length, 0) + checkedWord - startWord) * 100).toFixed(2) : Math.floor(score / (lyrics.filter((e, idx) => idx < checkedLyricsId).reduce((sum, e) => sum + e.length, 0) + checkedWord - startWord) * 100)) + "%" }}
            </h1>
            <p>{{ nonDecimalCurrentTime ? Math.round(time) : (Math.round(time * 100) / 100).toFixed(2) }}s / {{ Math.round(lyrics[lyrics.length - 1][lyrics[lyrics.length - 1].length - 1].delay / speed * 100) / 100 }}s</p>
            <p v-if="data.automapSongSkipping">Song: {{ (Math.round(songPosition * 100) / 100).toFixed(2) }}s</p>
        </div>

        <button
            v-if="mobile"
            :class="fullscreenButtonShown ? 'button fixed bottom-4 right-4' : 'button fixed bottom-4 left-4'"
            :tabindex="paused || finished ? -1 : 0"
            @click="paused = true"
        >Pause</button>

        <div
            v-if="lagWarning"
            class="fixed w-full flex justify-center"
            :style="{ bottom: (thinScreen && mobile ? 76 : thinScreen && fullscreenButtonShown ? 60 : 16) + 'px' }"
        >
            <p class="bg-black/[var(--bg-40)] px-4 py-1.25 rounded-xl backdrop-blur-md max-w-[calc(100vw-32px)] sm:max-w-[calc(100vw-225px)] text-center flex flex-col md:flex-row items-center gap-1 md:gap-3">
                Huge lag during a background transition was detected. During this map, the background won't change its color and brightness anymore to prevent lag. If you keep seeing this, turn on either "Disable background filters" or "Disable lag prevention" in the settings.
                <button 
                    class="button"
                    :tabindex="paused || finished ? -1 : 0"
                    @click="lagWarning = false"
                >Okay</button>
            </p>
        </div>

        <MapCustomization 
            v-if="paused"
            :data="data"
            :defaultBackground="defaultBackground"
            :pausedVariant="true"
            :continuedWithSettings="continuedWithSettings"
            @continue="(data) => unpause(data)"
            @setData="(data) => $emit('setData', data, true)"
        />

        <MenuPanel v-if="finished">
            <PinkHeader 
                :text="'Score: ' + (finalScore == -1 ? '??' : finalScore) + '%'" 
            />
    
            <p class="mb-2">The map ended. {{ additionalFinishInfo }}</p>
    
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
                        <th 
                            class="border-t-0 border-r-0" 
                            colspan="2"
                        >Total</th>
                    </tr>
                </thead>
            
                <tbody>
                    <tr>
                        <th class="border-l-0">Correct</th>
                        <td>{{ wordStatistics.Vv }}</td>
                        <td>{{ wordStatistics.Ve }}</td>
                        <td>{{ wordStatistics.V }}</td>
                        <td>{{ wordStatistics.Vl }}</td>
                        <td class="border-r-0 min-w-10">{{ wordStatistics.Vv + wordStatistics.Ve + wordStatistics.V + wordStatistics.Vl }}</td>
                        <td class="border-r-0 border-l-0 pl-0 text-neutral-400">({{ Object.values(wordStatistics).some(e => e) ? Math.round((wordStatistics.Vv + wordStatistics.Ve + wordStatistics.V + wordStatistics.Vl) / Object.values(wordStatistics).reduce((sum, e) => sum + e, 0) * 100) : 0 }}%)</td>
                    </tr>
                
                    <tr>
                        <th class="border-l-0">Typo</th>
                        <td>{{ wordStatistics["~v"] }}</td>
                        <td>{{ wordStatistics["~e"] }}</td>
                        <td>{{ wordStatistics["~"] }}</td>
                        <td>{{ wordStatistics["~l"] }}</td>
                        <td class="border-r-0 min-w-10">{{ wordStatistics["~v"] + wordStatistics["~e"] + wordStatistics["~"] + wordStatistics["~l"] }}</td>
                        <td class="border-r-0 border-l-0 pl-0 text-neutral-400">({{ Object.values(wordStatistics).some(e => e) ? Math.round((wordStatistics["~v"] + wordStatistics["~e"] + wordStatistics["~"] + wordStatistics["~l"]) / Object.values(wordStatistics).reduce((sum, e) => sum + e, 0) * 100) : 0 }}%)</td>
                    </tr>
                
                    <tr>
                        <th class="border-b-0 border-l-0">Wrong</th>
                        <td class="border-b-0">-</td>
                        <td class="border-b-0">-</td>
                        <td class="border-b-0">-</td>
                        <td class="border-b-0">-</td>
                        <td class="border-b-0 border-r-0 min-w-10">{{ wordStatistics.X }}</td>
                        <td class="border-b-0 border-x-0 pl-0 text-neutral-400">({{ Object.values(wordStatistics).some(e => e) ? Math.round(wordStatistics.X / Object.values(wordStatistics).reduce((sum, e) => sum + e, 0) * 100) : 0 }}%)</td>
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
        </MenuPanel>
    </main>
</template>