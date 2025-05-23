<script setup>
    import { ref, onUnmounted } from 'vue';
    import defaultBackground from '@/assets/background.png'
    import PinkHeader from './PinkHeader.vue';
    import InputsAdd from './InputsAdd.vue';
    import SongAndBackgroundInputs from '@/components/SongAndBackgroundInputs.vue';

    const lyrics = ref("");
    const hueRotate = ref(0);
    const partsWithoutLyrics = ref([]);
    const backgroundImage = ref(defaultBackground);
    const name = ref("");

    const song = ref("");
    const audio = ref(new Audio());
    const songDuration = ref(0);

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
        name.value = songName;
    }

    function calculateLyrics() {
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
    }

    function backgroundImageSet(newBackgroundImage) {
        backgroundImage.value = newBackgroundImage;
        emit("backgroundImageChanged", newBackgroundImage);
    }

    function onKeydown(e) {
        if (e.key == "Escape" && hueRotate.value == 0 && backgroundImage.value == defaultBackground && !songDuration.value && !lyrics.value) {
            emit("cancel");
        }
    }
    addEventListener("keydown", onKeydown);
</script>

<template>
    <PinkHeader text="Automap" />

    <label class="flex flex-col items-center">
        <h2 class="font-bold text-xl mb-2">Lyrics:</h2>
        <textarea 
            class="bg-white p-2 rounded-xl w-133 h-50 text-center resize-none text-black"
            v-model="lyrics"
        ></textarea>
    </label>

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
        <section class="flex gap-2 mb-4 mt-1">
            <input 
                v-model="hueRotate"
                min="0"
                max="360"
                type="range"
                @input="$emit('hueRotateChanged', hueRotate)"
            >
        </section>
    </label>

    <p class="mb-3 max-w-175 text-center">Automap only spreads words in even distances from each other. This works better for some songs and worse for other ones. You can use the right and left arrow keys while holding shift to skip the song by 2 seconds without moving the lyrics if they're significantly desynced at the time.</p>
    <section class="flex gap-3">
        <button
            class="button"
            @click="$emit('cancel')"
        >Cancel</button>

        <button
            class="button"
            :disabled="!songDuration || !lyrics.split('\n').some(e => e.split(' ').filter(e => e).length)"
            :title="!songDuration ? 'Add a song first.'
                        : !lyrics.split('\n').some(e => e.split(' ').filter(e => e).length) ?
                            'Input the lyrics first.'
                            : ''"
            @click="$emit('setData', {
                name: name ? name : 'Unnamed map',
                mapper: 'Automap',
                additionalInfo: '',
                song: song,
                backgroundImage: backgroundImage,
                backgroundFilters: [{ start: 0, hue: hueRotate, brightness: 100, transitionDuration: 0}],
                lyrics: calculateLyrics(),
                partsWithoutLyrics: partsWithoutLyrics.map((e) => { return { start: e.start + 1, end: e.end - 1 }}).filter((e) => e.end > e.start),
                forceskip: false,
                automap: true,
                id: new Array(32).fill('QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890').map((e) => e[Math.floor(Math.random() * e.length)]).join('')
            })"
        >Map</button>
    </section>
</template>