<script setup>
    const props = defineProps([
        "text",
        "bottomText",
        "purple",
        "buttonTabindex"
    ]);
</script>

<template>
    <div class="animatedButton relative sm:left-28 w-full sm:w-auto select-none opacity-0">
        <button 
            class="w-full sm:w-auto cursor-pointer relative bg-[var(--themableWhite)] font-bold text-3xl text-pink-500 sm:skew-x-[-20deg] border-[var(--themableWhite)] border-y-3 border-x-0 sm:border-l-3 right-0 group hover:sm:scale-133 hover:sm:right-[20%] hover:sm:my-5 duration-300 text-center sm:text-right z-1"
            :style="{ color: purple ? 'var(--color-violet-900)' : 'var(--color-pink-500)'}"
            :tabindex="buttonTabindex"
        >
            <div :class="bottomText ? 'w-full h-2 absolute top-[-8px] invisible group-hover:visible' : 'w-full h-3 absolute top-[-12px] invisible group-hover:visible'"></div>
            <div 
                :class="bottomText ? 'border-y-3 border-x-0 sm:border-l-3 py-1.5 px-1 sm:pr-31 sm:pl-5' : 'border-y-3 border-x-0 sm:border-l-3 py-1.75 px-1 sm:pr-31 sm:pl-5'"
                :style="{ borderColor: purple ? 'var(--color-violet-900)' : 'var(--color-pink-500)'}"
            >
                <p class="skew-x-[-15deg] sm:skew-x-5 px-1">{{ text }}</p>
                <p 
                    class="skew-x-[-15deg] sm:skew-x-5 text-xl text-[color-mix(in_hsl,var(--color-pink-300)_25%,var(--color-pink-500)_75%)]"
                    v-html="bottomText"
                ></p>
            </div>
        </button>
    </div>
</template>