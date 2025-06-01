<script setup>
    import { ref, onUnmounted, watch } from 'vue';
    import defaultBackground from '@/assets/background.png'
    import PinkHeader from './PinkHeader.vue';
    import InputsAdd from './InputsAdd.vue';
    import SongAndBackgroundInputs from '@/components/SongAndBackgroundInputs.vue';

    const lyrics = ref("");
    const lyricsType = ref("text");
    const parsedLyrics = ref([]);
    const lyricsOffset = ref(0);

    const hueRotate = ref(0);
    const partsWithoutLyrics = ref([]);
    const backgroundImage = ref(defaultBackground);

    const songLrcName = ref("");
    const songFileName = ref("");

    const song = ref("");
    const audio = ref(new Audio());
    const songDuration = ref(0);

    const props = defineProps([
        "startData"
    ]);

    const emit = defineEmits([
        "cancel",
        "setData",
        "backgroundImageChanged",
        "hueRotateChanged"
    ]);

    onUnmounted(() => {
        removeEventListener("keydown", onKeydown);
    });

    function onSongLoad(newSong, newAudio, newSongDuration, songName) {
        song.value = newSong;
        audio.value = newAudio;
        songDuration.value = newSongDuration;
        songFileName.value = songName;
    }

    function calculateLyrics() {
        if (lyricsType.value == "text") {
            if (lyrics.value.split("\n").filter(e => e).length == 1 && lyrics.value.split("\n").filter(e => e)[0].split(" ").filter(e => e).length == 1) {
                return [[{ word: lyrics.value.split("\n").filter(e => e)[0].split(" ").filter(e => e)[0], delay: songDuration.value }]];
            }

            let calculatedLyrics = [];
            let skippedIndex = 0;
            let lastSkipIndex = 0; 
            const wordAmount = lyrics.value.split("\n").reduce((sum, verse) => sum += verse.split(" ").filter(e => e).length, 0);

            let wordLength = (songDuration.value - partsWithoutLyrics.value.reduce((sum, e) => sum + e.end - e.start, 0)) / wordAmount;
            wordLength = (wordLength * wordAmount - partsWithoutLyrics.value.length * wordLength) / wordAmount;

            lyrics.value.split("\n").filter(e => e).map((verse, idx) => {
                let timeToSkip = 0;
                if (skippedIndex != partsWithoutLyrics.value.length && !(skippedIndex == partsWithoutLyrics.value.length - 1 && songDuration.value == partsWithoutLyrics.value[skippedIndex].end) && (calculatedLyrics.length ? (calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay + wordLength >= partsWithoutLyrics.value[skippedIndex].start || calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay + verse.split(" ").length / 2 * wordLength >= partsWithoutLyrics.value[skippedIndex].start) : (wordLength >= partsWithoutLyrics.value[skippedIndex].start || verse.split(" ").length / 2 * wordLength >= partsWithoutLyrics.value[skippedIndex].start))) { // if the first word or the middle of the verse is after the start of the next lyricless part                
                    calculatedLyrics = calculatedLyrics.map((e, idx2) => idx2 < lastSkipIndex ? e : e.map((e2) => { return { word: e2.word, delay: (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0) + (e2.delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / ((calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / (partsWithoutLyrics.value[skippedIndex].start - wordLength * 0.5 - ((skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)))) }})); // start(0 or end of last lyriclesspart) + (delay - start) / ((lastLyricDelayBeforeLyricless - start) / (nextpartwithoutlyrics.start - 0.5wordlength - start))

                    lastSkipIndex = idx;
                    timeToSkip = partsWithoutLyrics.value[skippedIndex].end - (calculatedLyrics.length ? calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay : 0);
                    skippedIndex += 1;
                };

                calculatedLyrics.push(verse.split(" ").filter(e => e).map((word, wordId) => {
                    return {
                        word: word,
                        delay: calculatedLyrics.length ? 
                            calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay + timeToSkip + (1 + wordId) * wordLength
                            : (1 + wordId) * wordLength + timeToSkip
                    }
                }));

                if (skippedIndex == partsWithoutLyrics.value.length - 1 && idx == lyrics.value.split("\n").filter(e => e).length - 1 && songDuration.value == partsWithoutLyrics.value[skippedIndex].end) {
                    calculatedLyrics = calculatedLyrics.map((e, idx2) => idx2 < lastSkipIndex ? e : e.map((e2) => { return { word: e2.word, delay: (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0) + (e2.delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / ((calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay - (skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)) / (partsWithoutLyrics.value[skippedIndex].start - wordLength * 0.5 - ((skippedIndex ? partsWithoutLyrics.value[skippedIndex - 1].end : 0)))) }}));
                }
            });

            if (skippedIndex && songDuration.value != partsWithoutLyrics.value[partsWithoutLyrics.value.length - 1].end) {
                calculatedLyrics = calculatedLyrics.map((e, idx) => idx < lastSkipIndex ? e : e.map((e2) => { return { word: e2.word, delay: partsWithoutLyrics.value[skippedIndex - 1].end + (e2.delay - partsWithoutLyrics.value[skippedIndex - 1].end) / ((calculatedLyrics[calculatedLyrics.length - 1][calculatedLyrics[calculatedLyrics.length - 1].length - 1].delay - partsWithoutLyrics.value[skippedIndex - 1].end) / (songDuration.value - partsWithoutLyrics.value[skippedIndex - 1].end)) }}));
            }

            calculatedLyrics = calculatedLyrics.map((e) => e.map((e2) => e2.delay ? e2 : { word: e2.word, delay: 0 }));
            return calculatedLyrics;
        } else {
            return parsedLyrics.value.map((e) => e.verse.split(" ").map((e2, idx) => { return { word: e2, delay: e.start + lyricsOffset.value + (e.end - e.start) / (e.verse.split(" ").length) * (idx + 1) }}));
        }
    }

    function parseLyrics() {
        try {
            if (lyricsType.value == "lrc") {
                songLrcName.value = lyrics.value.match(/(?<=\[ti:).*(?=\])/) && (lyrics.value.match(/(?<=\[ti:).*(?=\])/)[0].trim().includes(" - ") || !(lyrics.value.match(/(?<=\[ar:).*(?=\])/) || lyrics.value.match(/(?<=\[au:).*(?=\])/) || lyrics.value.match(/(?<=\[lr:).*(?=\])/))) ? 
                    lyrics.value.match(/(?<=\[ti:).*(?=\])/)[0].trim()
                    : lyrics.value.match(/(?<=\[ti:).*(?=\])/) ?
                        (lyrics.value.match(/(?<=\[ar:).*(?=\])/) ?
                            lyrics.value.match(/(?<=\[ar:).*(?=\])/)[0].trim()
                            : lyrics.value.match(/(?<=\[au:).*(?=\])/) ? 
                                lyrics.value.match(/(?<=\[au:).*(?=\])/)[0].trim()
                                : lyrics.value.match(/(?<=\[lr:).*(?=\])/)[0].trim()) + " - " + lyrics.value.match(/(?<=\[ti:).*(?=\])/)[0].trim()
                        : "";

                parsedLyrics.value = lyrics.value.split("\n").filter(e => e && !isNaN(parseFloat(e.split("]")[0].slice(1).split(":")[0]))).map((e) => { return { verse: e.split("]")[1].replace("\r", ""), start: e.split("]")[0].slice(1).split(":")[0] * 60 + Number(e.split("]")[0].slice(1).split(":")[1]) }});
                parsedLyrics.value = parsedLyrics.value.map((e, idx) => { return { ...e, end: idx == parsedLyrics.value.length - 1 ? (idx != 0 ? e.start * 2 - parsedLyrics.value[idx - 1].start : e.start + 1) : parsedLyrics.value[idx + 1].start }}).filter(e => e.verse); 
            } else {
                parsedLyrics.value = lyrics.value.trim().split(lyrics.value.trim().split("\n\n").length > lyrics.value.trim().split("\n\r\n").length ? "\n\n" : "\n\r\n").filter(e => e.includes(" --> ")).map(e => e.split("\n").map(e2 => e2.replace("\r", "")).filter(e => !e.startsWith("NOTE")).filter((e2, idx2) => idx2 != 0 || e2.includes(" --> ")).map(e2 => e2.includes(" --> ") && e2.split(" --> ")[0].split(":").length == 2 ? "0:" + e2.split(" --> ")[0] + " --> 0:" + e2.split(" --> ")[1] : e2)).map((e) => { return { 
                    start: e[0].split(" --> ")[0].split(":")[0] * 3600 + e[0].split(" --> ")[0].split(":")[1] * 60 + Number(e[0].split(" --> ")[0].split(":")[2].replace(",", ".")), 
                    end: e[0].split(" --> ")[1].split(":")[0] * 3600 + e[0].split(" --> ")[1].split(":")[1] * 60 + Number(e[0].split(" --> ")[1].split(":")[2].replace(",", ".")), 
                    verse: e.slice(1).join(" ").trim().replace(/<.*?>/g, "")
                }});
            }
        } catch {
            parsedLyrics.value = [];
        }

        if (parsedLyrics.value.some((e, idx) => (!e.start && !(e.start == 0 && idx == 0)) || (e.start > e.end) || (idx != 0 && e.start < parsedLyrics.value[idx - 1].end))) {
            parsedLyrics.value = [];
        }
    }

    watch(lyricsType, () => {
        if (lyricsType.value != "text") {
            parseLyrics();
        }
    });

    function backgroundImageSet(newBackgroundImage) {
        backgroundImage.value = newBackgroundImage;
        emit("backgroundImageChanged", newBackgroundImage);
    }

    function onKeydown(e) {
        if (e.key == "Escape" && hueRotate.value == 0 && backgroundImage.value == defaultBackground && !songDuration.value && !lyrics.value && lyricsType.value == "text") {
            emit("cancel");
        }
    }
    addEventListener("keydown", onKeydown);

    function loadFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!file.type || file.type == "application/x-subrip" || file.type == "text/vtt") {
                lyrics.value = e.target.result;
                lyricsType.value = file.type ? "srt/vtt" : "lrc";
                parseLyrics();
            }
        };
        reader.readAsText(file);
    }
</script>

<template>
    <PinkHeader text="Automap" />

    <p class="mb-3 max-w-175 text-center">
        It's recommended to get a .srt, .vtt or .lrc file. Some ways to get them are looking up the song name and the file extension in a search engine, extracting them from music videos, or searching on websites dedicated to them. You should be able to get them for a big part of popular songs. 
        <br class="mb-3">
        .srt and .vtt are video subtitle formats, and .lrc is made specifically for lyrics. .srt and .vtt files contain timestamps for specific lines, as in the start and end time, while .lrc only specifies the start time. However some .lrc files contain empty verses to indicate the end times of real verses, but if that's not the case, automap assumes the verse ends when the next verse starts, meaning it will be less accurate. 
        <br class="mb-3">
        The start time of lyrics can differ between your audio file and your lyrics file by some seconds due to some songs having versions with and without an intro, if that's the case, listen to when the first verse starts in the audio file, compare it to the lyrics file text or the text under the lyrics offset input, and set the lyrics offset accordingly.
        <br class="mb-3">
        If you can't find any files of that type for the song that you want to play, you can use automap with just text lyrics. Then it spreads words in even distances from each other except of the parts without lyrics. When playing, you can use the right and left arrow keys while holding shift to skip the song by 2 seconds without moving the lyrics if they're significantly desynced at the time.
    </p>

    <label class="flex flex-col items-center">
        <h2 class="font-bold text-xl mb-2">Lyrics:</h2>
        <textarea 
            class="bg-white p-2 rounded-xl w-133 h-50 text-center text-black"
            v-model="lyrics"
            @change="lyricsType == 'text' ? {} : parseLyrics()"
        ></textarea>
    </label>

    <div class="flex gap-3 mt-2">
        <label class="cursor-pointer">
            <input 
                class="cursor-pointer"
                type="radio" 
                value="text"
                v-model="lyricsType"
            >
            Text
        </label>

        <label class="cursor-pointer">
            <input 
                class="cursor-pointer"
                type="radio" 
                value="srt/vtt"
                v-model="lyricsType"
            >
            .srt/.vtt
        </label>

        <label class="cursor-pointer">
            <input 
                class="cursor-pointer"
                type="radio" 
                value="lrc"
                v-model="lyricsType"
            >
            .lrc
        </label>
    </div>
    <label class="mt-2">
        From a .srt, .vtt or .lrc file:
        <input 
            class="button py-1 font-normal ml-1 mb-1.5"
            type="file"
            accept=".srt, .vtt, .lrc"
            @change="(e) => loadFromFile(e.target.files[0])"
        >
    </label>

    <label 
        v-if="lyricsType != 'text'"
        class="text-center"
    >
        <h2 class="font-bold text-xl mt-4 mb-2">Lyrics offset:</h2>
        <input 
            class="input w-32"
            type="number"
            :min="parsedLyrics.length ? parsedLyrics[0].start * -1 : 0"
            max="120"
            v-model="lyricsOffset"
            @change="(e) => lyricsOffset > 120 ? 
                        lyricsOffset = 120 
                        : e.target.value < (parsedLyrics.length ? parsedLyrics[0].start * -1 : 0) ? 
                            lyricsOffset = parsedLyrics.length ? parsedLyrics[0].start * -1 : 0
                            : isNaN(parseFloat(e.target.value)) ? 
                                lyricsOffset = 0
                                : {}"
        >
    </label>
    <p 
        v-if="lyricsType != 'text' && parsedLyrics.length"
        class="mt-1"
    >The lyrics will start at {{ Math.round((parsedLyrics[0].start + lyricsOffset) * 100) / 100 }}s.</p>

    <SongAndBackgroundInputs
        @backgroundImageSet="(newBackgroundImage) => backgroundImageSet(newBackgroundImage)"
        @songLoaded="(newSong, newAudio, newSongDuration, songName) => onSongLoad(newSong, newAudio, newSongDuration, songName)"
    />

    <h2 
        :class="!songDuration ? 'font-bold text-xl mt-4 mb-2 text-neutral-400 cursor-not-allowed' : 'font-bold text-xl mt-4 mb-2'"
        :title="!songDuration ? 'Add a song first.' : ''"
    >
        Parts without lyrics:
    </h2>
    <p v-for="part, idx in partsWithoutLyrics">
        {{ part.start + "s - " + part.end + "s" }}
        <button
            class="button p-0 w-8 ml-1"
            @click="partsWithoutLyrics = partsWithoutLyrics.filter((e, idx2) => idx != idx2)"
        >X</button>
    </p>
    <InputsAdd 
        :labels="['Start time', 'End time']"
        :maxValues="[songDuration, songDuration]"
        limits="startEnd"
        :array="partsWithoutLyrics"
        :disabledInfo="!songDuration ? 'Add a song first.' : ''"
        @add="(start, end) => partsWithoutLyrics = [ ...partsWithoutLyrics, { start: start, end: end }].sort((a,b) => a.start - b.start)"
    />

    <label class="flex flex-col items-center">
        <h2 class="font-bold text-xl mt-4 mb-2">Background hue-rotate:</h2>
        <p class="font-bold">{{ hueRotate }}°</p>
        <div class="flex gap-2 mb-4 mt-1">
            <input 
                v-model="hueRotate"
                min="0"
                max="360"
                type="range"
                @input="$emit('hueRotateChanged', hueRotate)"
            >
        </div>
    </label>

    <div class="flex gap-3">
        <button
            class="button"
            @click="$emit('cancel')"
        >Cancel</button>

        <button
            class="button"
            :disabled="!songDuration || !lyrics.split('\n').some(e => e.split(' ').filter(e => e).length) || (!parsedLyrics.length && lyricsType != 'text')"
            :title="!songDuration ? 'Add a song first.'
                        : !lyrics.split('\n').some(e => e.split(' ').filter(e => e).length) ?
                            'Input the lyrics first.'
                            : !parsedLyrics.length && lyricsType != 'text' ?
                                'The lyrics cannot be parsed due to an error. Make sure everything is correct, or if you didn\'t intend to parse them as a .srt, .vtt or .lrc file, change the type to text.' 
                                : ''"
            @click="$emit('setData', {
                name: songLrcName ? 
                        songLrcName 
                        : songFileName ? 
                            songFileName 
                            : 'Unnamed map',
                mapper: 'Automap' + (lyricsType == 'lrc' && lyrics.match(/(?<=\[by:).*(?=\])/) ? ' (.lrc by ' + lyrics.match(/(?<=\[by:).*(?=\])/)[0].trim() + ')' : ''),
                additionalInfo: '',
                song: song,
                backgroundImage: backgroundImage,
                backgroundFilters: [{ start: 0, hue: hueRotate, brightness: 100, transitionDuration: 0}],
                lyrics: calculateLyrics(),
                partsWithoutLyrics: lyricsType == 'text' ? partsWithoutLyrics.map((e) => { return { start: e.start + 1, end: e.end - 1 }}).filter((e) => e.end > e.start) : partsWithoutLyrics,
                forceskip: false,
                downloadButton: true,
                automapSongSkipping: lyricsType == 'text',
                id: new Array(32).fill('QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890').map((e) => e[Math.floor(Math.random() * e.length)]).join('')
            })"
        >Map</button>
    </div>
</template>