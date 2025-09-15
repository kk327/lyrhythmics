<script setup>
    import { ref, watch, onUnmounted } from 'vue';

    const props = defineProps([
        "defaultSpeed",
        "tabindex"
    ]);

    const emit = defineEmits([
        "changed"
    ]);

    const speed = ref(props.defaultSpeed);
    const thinScreen = ref(!window.matchMedia("(min-width: 40rem)").matches);

    onUnmounted(() => {
        removeEventListener("resize", onResize);
    });

    watch(speed, () => {
        emit("changed", speed.value);
    });

    function onResize() {
        thinScreen.value = !window.matchMedia("(min-width: 40rem)").matches;
    }
    addEventListener("resize", onResize);
</script>

<template>
    <h2 class="font-bold text-xl mt-4 mb-2">Speed</h2>
    <div class="w-170 max-w-[calc(100vw-12px)] sm:max-w-[calc(100vw-64px)] flex flex-row justify-between rounded-xl">
        <button
            v-for="speedValue of thinScreen ? Array(7).keys().map((e) => e * 0.25 + 0.25) : Array(13).keys().map((e) => e * 0.125 + 0.25)"
            :class="speedValue % 0.25 == 0 ? 'w-10 font-bold cursor-pointer hover:text-pink-300 duration-100 flex flex-col items-center' : 'w-10 text-neutral-300 cursor-pointer hover:text-pink-300 duration-100 flex flex-col items-center'"
            :style="{ color: speed == speedValue ? 'color-mix(in hsl, var(--color-pink-300) 33%, var(--color-pink-500) 66%)' : '' }"
            @click="speed = speedValue"
            :tabindex="tabindex"
        >
            {{ speedValue }}
        </button>
    </div>
    <input 
        class="w-165 max-w-[calc(100vw-32px)] sm:max-w-[calc(100vw-84px)]"
        type="range"
        v-model="speed"
        min="0.25"
        max="1.75"
        step="0.125"
        :tabindex="tabindex"
    >

    <label>
        Custom:
        <input 
            class="input ml-1 mt-1.5"
            min="0.125"
            max="5"
            step="0.125"
            type="number"
            v-model="speed"
            :tabindex="tabindex"
            @change="(e) => e.target.value > 5 ? speed = 5 : e.target.value < 0.125 || isNaN(parseFloat(e.target.value)) ? speed = 0.125 : {}"
        >
    </label>
</template>