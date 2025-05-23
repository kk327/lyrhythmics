<script setup>
    const props = defineProps([
        "text",
        "bottomText"
    ]);
</script>

<template>
    <button class="relative left-28">
        <section class="cursor-pointer relative bg-white font-bold text-3xl text-pink-500 skew-x-[-20deg] border-white border-3 border-r-0 right-0 group hover:scale-[1.33] hover:right-[20%] hover:my-5 duration-300 text-right z-1">
            <section class="w-full h-2 absolute top-[-8px] invisible group-hover:visible"></section>
            <section :class="bottomText ? 'border-pink-500 border-3 border-r-0 py-1.5 pr-32 pl-6' : 'border-pink-500 border-3 border-r-0 py-1.75 pr-32 pl-6'">
                <p class="skew-x-5">{{ text }}</p>
                <p class="skew-x-5 text-xl">{{ bottomText }}</p>
            </section>
        </section>
    </button>
</template>