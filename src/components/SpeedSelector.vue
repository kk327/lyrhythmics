<script setup>
    import { ref, watch } from 'vue';

    const props = defineProps([
        "defaultSpeed",
        "tabindex"
    ]);

    const emit = defineEmits([
        "changed"
    ]);

    const speed = ref(props.defaultSpeed);

    watch(speed, () => {
        emit("changed", speed.value);
    })
</script>

<template>
    <h2 class="font-bold text-xl mt-4 mb-2">Speed:</h2>
    <div class="cursor-hover bg-black/[var(--bg-40)] gap-1 flex rounded-xl backdrop-blur-md">
        <button
            v-for="speedValue of [0.25, 0.5, 0.625, 0.75, 0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.75]"
            class="cursor-pointer px-3 py-1 rounded-xl border-2 border-white/0 font-bold hover:brightness-125 hover:border-white duration-200"
            :style="{ color: speed == speedValue ? 'var(--color-pink-400)' : 'white'}"
            :tabindex="tabindex"
            @click="speed = speedValue"
        >{{ speedValue }}</button>
    </div>
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