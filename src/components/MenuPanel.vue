<script setup>
    import { onMounted } from 'vue';

    const props = defineProps([
        "noPadding",
        "closeButton",
        "closeButtonTabindex",
        "reduceTransparency",
        "higherZ",
        "animationVariant"
    ]);

    const emit = defineEmits([
        "close"
    ]);

    onMounted(() => {
        if (!props.higherZ && props.animationVariant != "noAnimation") {
            for (let element of document.querySelectorAll(".animated")) {
                element.animate(
                    [
                        { opacity: 0 },
                        { opacity: 1 }
                    ],
                    125
                );
            }
        }
    });
</script>

<template> 
    <div :class="(animationVariant == 'withoutBackground' ? '' : 'animated ') + 
                 (higherZ ? 'fixed w-screen h-dvh bg-black/50 backdrop-blur-xs z-12' : 'fixed w-screen h-dvh bg-black/50 backdrop-blur-xs z-10')"></div>
    <div :class="higherZ ? 'fixed w-screen h-dvh flex justify-center items-center text-white text-center z-13' : 'fixed w-screen h-dvh flex justify-center items-center text-white text-center z-11'">
        <div class="flex bg-neutral-900/[var(--bg-40)] sm:rounded-xl h-dvh w-full sm:h-auto sm:w-auto sm:max-h-[calc(100dvh-20px)] sm:max-w-[calc(100%-20px)]">
            <button
                v-if="closeButton"
                :class="reduceTransparency ? 'animated group button fixed mt-2 ml-2 px-2.5 py-2.5 z-1' : 'animated group button fixed mt-2 ml-2 px-2.5 py-2.5 z-1 backdrop-blur-none hover:backdrop-blur-md'"
                title="Close."
                :tabindex="closeButtonTabindex"
                @click="$emit('close')"
            >
                <img 
                    :class="reduceTransparency ? 'w-5 brightness-63 group-hover:brightness-100 duration-200' : 'w-5 opacity-50 group-hover:opacity-100 duration-200'"
                    src="@/assets/cross.png" 
                    alt="Close icon"
                >
            </button>

            <div class="animated flex items-center sm:rounded-xl backdrop-blur-2xl w-full h-full sm:h-auto sm:w-auto">
                <div 
                    :class="noPadding ? 'flex flex-col items-center max-h-full w-full overflow-y-auto overflow-x-hidden' : 'flex flex-col items-center max-h-full w-full px-2 sm:px-6 py-2 sm:py-3 overflow-y-auto overflow-x-hidden'"
                    tabindex="-1"
                >
                    <slot></slot>
                </div>
            </div>
        </div>
    </div>
</template>