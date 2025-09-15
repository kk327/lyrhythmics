<script setup>
    import { ref, watch } from 'vue';

    const props = defineProps([
        "initialValue",
        "disabled",
        "inputTabindex",
        "labelText",
        "labelBottomText",
        "moreInfoButton"
    ]);

    const emit = defineEmits([
        "valueChanged",
        "moreInfoClicked"
    ]);

    const value = ref(props.initialValue);

    watch(() => props.initialValue, () => {
        value.value = props.initialValue;
    });
</script>

<template>
    <label class="flex items-center gap-3 cursor-pointer has-disabled:cursor-not-allowed mt-4 mb-2">
        <input 
            class="opacity-0 fixed peer"
            :disabled="disabled"
            type="checkbox"
            v-model="value"
            :tabindex="inputTabindex"
            @change="$emit('valueChanged', value)"
        >
            <div 
                class="w-9 shrink-0 h-5.5 bg-neutral-200 rounded-4xl p-0.5 flex
                        after:w-4.5 after:h-4.5 after:rounded-xl after:relative after:bg-neutral-800 after:duration-200 after:left-0
                        peer-checked:after:bg-pink-500 peer-checked:after:left-3.5 peer-checked:bg-white
                        peer-focus-visible:outline-2 peer-focus-visible:outline-pink-500 peer-focus-visible:shadow-[0_0_0px_3px_white]
                        peer-disabled:bg-neutral-400 peer-disabled:grayscale"
            ></div>
        </input>

        <div 
            v-if="labelText"
            :class="value ? 'text-left peer-disabled:text-neutral-400 duration-200 flex' : 'text-left peer-disabled:text-neutral-400 text-neutral-200 duration-200 flex'"
            :style="{ flexDirection: moreInfoButton ? 'row' : 'column' }"
        >
            <h2 class="font-bold text-xl">
                {{ labelText }}
            </h2>

            <p v-if="labelBottomText">({{ labelBottomText }})</p>
            <button 
                v-else-if="moreInfoButton"
                class="button py-0 px-2 aspect-square ml-2"
                title="View more information."
                @click="$emit('moreInfoClicked')"
            >?</button>
        </div>
    </label>
</template>