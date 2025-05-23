<script setup>
    import { ref, onUnmounted, useTemplateRef, onMounted } from 'vue';

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

    function onKeyDown(e) {
        if (e.key == "Control") {
            if (enterHeld && inputLyrics.value) {
                emit("addLyrics", inputLyrics.value, lengthBased.value);
            }
            controlHeld = true;
        } else if (e.key == "Enter") {
            if (controlHeld && inputLyrics.value) {
                emit("addLyrics", inputLyrics.value, lengthBased.value);
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
</script>

<template>
    <section class="fixed w-screen h-screen bg-black/50 z-11 backdrop-blur-xs"></section>
    <section class="fixed w-screen h-screen z-12 flex justify-center items-center flex-col gap-3">
        <textarea 
            class="bg-white p-2 rounded-xl w-2/3 h-2/3 text-center resize-none"
            ref="textarea"
            v-model="inputLyrics"
        ></textarea>

        <section class="flex justify-between w-2/3 gap-3">
            <section class="gap-3 flex">
                <button
                    class="button"
                    :disabled="!inputLyrics.split('\n').some(e => e.split(' ').filter(e => e).length)"
                    :title="inputLyrics ? '' : 'Input the lyrics first.'"
                    @click="$emit('addLyrics', inputLyrics, lengthBased)"
                >Ok</button>
                
                <button
                    class="button"
                    @click="$emit('close')"
                >Cancel</button>
            </section>

            <label 
                :class="songDuration && !currentLyrics ? 
                            'text-white font-bold flex items-center gap-1.5 cursor-pointer select-none' :
                            'text-gray-500 font-bold flex items-center cursor-not-allowed gap-1.5 select-none'"
                :title="!songDuration ? 
                            'No song uploaded.'
                            : currentLyrics ? 
                                'There already are lyrics added.'
                                : ''"
            >
                <input 
                    :disabled="!songDuration || currentLyrics"
                    class="cursor-pointer disabled:cursor-not-allowed"
                    type="checkbox"
                    v-model="lengthBased"
                >
                Delays based on song length
            </label>
        </section>
    </section>
</template>