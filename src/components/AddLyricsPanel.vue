<script setup>
    import { ref, onUnmounted, useTemplateRef, onMounted, watch } from 'vue';

    const props = defineProps([
        "close",
        "songDuration",
        "currentLyrics"
    ]);

    const emit = defineEmits([
        "addLyrics",
        "close"
    ]);

    const inputLyrics = ref("");
    const lengthBased = ref(props.songDuration && !props.currentLyrics ? true : false);
    const lyricsType = ref("text");
    const parsedLyrics = ref([])

    const textarea = useTemplateRef("textarea");

    let controlHeld = false;
    let enterHeld = false;

    addEventListener("keydown", onKeyDown);
    addEventListener("keyup", onKeyUp);

    onMounted(() => {
        textarea.value.focus();
    });
    
    onUnmounted(() => {
        removeEventListener("keydown", onKeyDown);
        removeEventListener("keyup", onKeyUp);
    });
    
    watch(lyricsType, () => {
        if (lyricsType.value != "text") {
            parseLyrics();
        } else {
            parsedLyrics.value = [];
        }
    })

    function onKeyDown(e) {
        if (e.key == "Control") {
            if (enterHeld && inputLyrics.value) {
                emit("addLyrics", inputLyrics.value, parsedLyrics.value, lengthBased.value);
            }
            controlHeld = true;
        } else if (e.key == "Enter") {
            if (controlHeld && inputLyrics.value) {
                emit("addLyrics", inputLyrics.value, parsedLyrics.value, lengthBased.value);
            }
            enterHeld = true;
        } else if (e.key == "Escape" && !inputLyrics.value) {
            emit("close");
        }
    }

    function onKeyUp(e) {
        if (e.key == "Control") {
            controlHeld = false;
        } else if (e.key == "Enter") {
            enterHeld = false;
        }
    }

    function loadFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!file.type || file.type == "application/x-subrip" || file.type == "text/vtt") {
                inputLyrics.value = e.target.result;
                lyricsType.value = file.type ? "srt/vtt" : "lrc";
                parseLyrics();
            }
        };
        reader.readAsText(file);
    }

    function parseLyrics() {
        try {
            if (lyricsType.value == "lrc") {
                parsedLyrics.value = inputLyrics.value.split("\n").filter(e => e && !isNaN(parseFloat(e.split("]")[0].slice(1).split(":")[0]))).map((e) => { return { verse: e.split("]")[1].replace("\r", ""), start: e.split("]")[0].slice(1).split(":")[0] * 60 + Number(e.split("]")[0].slice(1).split(":")[1]) }});
                parsedLyrics.value = parsedLyrics.value.map((e, idx) => { return { ...e, end: idx == parsedLyrics.value.length - 1 ? (idx != 0 ? e.start * 2 - parsedLyrics.value[idx - 1].start : e.start + 1) : parsedLyrics.value[idx + 1].start }}).filter(e => e.verse); 
            } else {
                parsedLyrics.value = inputLyrics.value.trim().split(inputLyrics.value.trim().split("\n\n").length > inputLyrics.value.trim().split("\n\r\n").length ? "\n\n" : "\n\r\n").filter(e => e.includes(" --> ")).map(e => e.split("\n").map(e2 => e2.replace("\r", "")).filter(e => !e.startsWith("NOTE")).filter((e2, idx2) => idx2 != 0 || e2.includes(" --> ")).map(e2 => e2.includes(" --> ") && e2.split(" --> ")[0].split(":").length == 2 ? "0:" + e2.split(" --> ")[0] + " --> 0:" + e2.split(" --> ")[1] : e2)).map((e) => { return { 
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
</script>

<template>
    <div class="fixed w-screen h-screen bg-black/60 z-11 backdrop-blur-xs"></div>
    <div class="fixed w-screen h-screen z-12 flex justify-center items-center flex-col gap-3">
        <div class="flex flex-col h-full justify-center gap-3">
            <textarea 
                class="bg-white p-2 rounded-xl min-w-[66.7vw] w-full h-2/3 text-center resize-none"
                ref="textarea"
                v-model="inputLyrics"
                @change="lyricsType == 'text' ? {} : parseLyrics()"
            ></textarea>

            <div class="flex justify-between min-w-2/3 max-w-[calc(100vw-50px)] gap-3">
                <div class="gap-3 flex">
                    <button
                        class="button"
                        :disabled="!inputLyrics.split('\n').some(e => e.split(' ').filter(e => e).length) || (!parsedLyrics.length && lyricsType != 'text')"
                        :title="!inputLyrics.split('\n').some(e => e.split(' ').filter(e => e).length) ?
                                    'Input the lyrics first.'
                                    : !parsedLyrics.length && lyricsType != 'text' ?
                                        'The lyrics cannot be parsed due to an error. Make sure everything is correct, or if you didn\'t intend to parse them as a .srt, .vtt or .lrc file, change the type to text.' 
                                        : ''"
                        @click="$emit('addLyrics', inputLyrics, parsedLyrics, lengthBased)"
                    >Add</button>
                    
                    <button
                        class="button"
                        @click="$emit('close')"
                    >Cancel</button>
                </div>
                
                <div class="flex gap-3 text-white items-center ml-5">
                    <label
                        class="has-disabled:cursor-not-allowed has-disabled:text-neutral-400"
                        :title="currentLyrics ? 'There already are lyrics added.' : ''"
                    >
                        From file:
                        <input 
                            class="button py-1 font-normal w-40 mr-5"
                            type="file"
                            accept=".lrc, .srt, .vtt"
                            :disabled="currentLyrics"
                            @change="(e) => loadFromFile(e.target.files[0])"
                        >
                    </label>
                
                    <p>Type:</p>
                
                    <label class="cursor-pointer">
                        <input 
                            class="cursor-pointer"
                            type="radio" 
                            value="text"
                            v-model="lyricsType"
                        >
                        Text
                    </label>
                
                    <label 
                        class="cursor-pointer has-disabled:cursor-not-allowed has-disabled:text-neutral-400"
                        :title="currentLyrics ? 'There already are lyrics added.' : ''"
                    >
                        <input 
                            class="cursor-pointer disabled:cursor-not-allowed"
                            type="radio" 
                            value="srt/vtt"
                            v-model="lyricsType"
                            :disabled="currentLyrics"
                        >
                        .srt/.vtt
                    </label>
                
                    <label 
                        class="cursor-pointer mr-5 has-disabled:cursor-not-allowed has-disabled:text-neutral-400"
                        :title="currentLyrics ? 'There already are lyrics added.' : ''"
                    >
                        <input 
                            class="cursor-pointer disabled:cursor-not-allowed"
                            type="radio" 
                            value="lrc"
                            v-model="lyricsType"
                            :disabled="currentLyrics"
                        >
                        .lrc
                    </label>
                
                    <label 
                        :class="songDuration && !currentLyrics ? 
                                    'font-bold flex gap-1.5 cursor-pointer select-none' :
                                    'text-gray-500 font-bold flex gap-1.5 cursor-not-allowed select-none'"
                        :title="!songDuration ? 
                                    'No song uploaded.'
                                    : currentLyrics ? 
                                        'There already are lyrics added.'
                                        : ''"
                    >
                        <input 
                            class="cursor-pointer disabled:cursor-not-allowed"
                            type="checkbox"
                            v-model="lengthBased"
                            :disabled="!songDuration || currentLyrics"
                        >
                        Delays based on song length
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>