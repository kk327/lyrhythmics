<script setup>
    import { ref } from 'vue';
    
    const props = defineProps([
        "labels",
        "maxValues",
        "limits",
        "array",
        "disabledInfo",
        "tabindex"
    ]);

    const emit = defineEmits([
        "add"
    ]);

    const values = ref(new Array(props.labels.length).fill(0).map((e, idx) => props.labels[idx] == "Brightness" ? 100 : 0));

    function add() {
        emit("add", ...values.value);
        values.value = new Array(props.labels.length).fill(0).map((e, idx) => props.labels[idx] == "Brightness" ? 100 : 0);
    }
</script>

<template>
    <section class="flex flex-wrap items-center justify-center max-w-150 gap-3 mt-1.5">
        <label 
            v-for="value, idx in values"
            :class="disabledInfo ? 'text-neutral-400 cursor-not-allowed' : ''"
            :title="disabledInfo"
        >
            {{ labels[idx] }}:
            <input 
                class="input w-32 ml-1"
                type="number"
                v-model="values[idx]"
                :min="labels[idx] == 'Hue-rotate' ? -Infinity : 0"
                :max="maxValues[idx]"
                :disabled="disabledInfo ? true : false"
                :tabindex="tabindex"
                @change="(e) => e.target.value > maxValues[idx] ? 
                                    values[idx] = maxValues[idx] 
                                    : (e.target.value < 0 && labels[idx] != 'Hue-rotate') || isNaN(parseFloat(e.target.value)) ? 
                                        values[idx] = 0 
                                        : {}"
            >
        </label>

        <button
            class="button"
            :disabled="disabledInfo || (limits == 'startEnd' && (values[0] >= values[1] || array.some((e) => (values[0] >= e.start && values[0] <= e.end) || (values[1] >= e.start && values[1] <= e.end) || (values[0] <= e.start && values[1] >= e.end)))) || (limits == 'transition' && (values[0] - values[3] < 0 || array.some((e) => (values[0] - values[3] > e.start - e.transitionDuration && values[0] - values[3] < e.start) || (values[0] > e.start - e.transitionDuration && values[0] < e.start) || (values[0] - values[3] <= e.start - e.transitionDuration && values[0] >= e.start && !(e.transitionDuration == 0 && values[3] != 0 && (values[0] - values[3] == e.start || values[0] == e.start))))))"
            :tabindex="tabindex"
            :title="disabledInfo ? 
                        disabledInfo
                        : limits == 'startEnd' ?
                            values[0] >= values[1] ?
                                'The end time must be bigger than the start time.' 
                                : array.some((e) => (values[0] >= e.start && values[0] <= e.end) || (values[1] >= e.start && values[1] <= e.end) || (values[0] <= e.start && values[1] >= e.end)) ?
                                    'The times must not overlap.'
                                    : ''
                            : limits == 'transition' ?
                                values[0] - values[3] < 0 ?
                                    'The time must not start before 0.'
                                    : array.some((e) => (values[0] - values[3] > e.start - e.transitionDuration && values[0] - values[3] < e.start) || (values[0] > e.start - e.transitionDuration && values[0] < e.start) || (values[0] - values[3] <= e.start - e.transitionDuration && values[0] >= e.start && !(e.transitionDuration == 0 && values[3] != 0 && (values[0] - values[3] == e.start || values[0] == e.start)))) ?
                                        'The transitions must not overlap. '
                                        : ''
                                : ''"
            @click="add()"
        >Add</button>
    </section>
</template>