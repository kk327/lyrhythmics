<script setup>
    const props = defineProps([
        "noPadding",
        "closeButton",
        "closeButtonTabindex",
        "higherZ"
    ]);

    const emit = defineEmits([
        "close"
    ]);
</script>

<template> 
    <div :class="higherZ ? 'fixed w-screen h-dvh bg-black/50 backdrop-blur-xs z-12' : 'fixed w-screen h-dvh bg-black/50 backdrop-blur-xs z-10'"></div>
    <div :class="higherZ ? 'fixed w-screen h-dvh flex justify-center items-center text-white text-center z-13' : 'fixed w-screen h-dvh flex justify-center items-center text-white text-center z-11'">
        <div class="flex bg-neutral-900/[var(--bg-40)] sm:rounded-xl h-dvh w-full sm:h-auto sm:w-auto sm:max-h-[calc(100dvh-20px)] sm:max-w-[calc(100%-20px)]">
            <button
                v-if="closeButton"
                class="button fixed mt-2 ml-2 px-2.5 py-2.5 z-1"
                title="Close."
                :tabindex="closeButtonTabindex"
                @click="$emit('close')"
            >
                <img 
                    class="w-5"
                    src="@/assets/close.png" 
                    alt="Close icon"
                >
            </button>

            <div class="flex items-center sm:rounded-xl backdrop-blur-2xl w-full h-full sm:h-auto sm:w-auto">
                <div :class="noPadding ? 'flex flex-col items-center max-h-full w-full overflow-y-auto' : 'flex flex-col items-center max-h-full w-full px-2 sm:px-6 py-2 sm:py-3 overflow-y-auto'">
                    <slot></slot>
                </div>
            </div>
        </div>
    </div>
</template>