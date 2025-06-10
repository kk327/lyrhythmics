<script setup>
    const props = defineProps([
        "text"
    ]);
</script>

<template>
    <div class="bg-pink-500 font-bold text-3xl text-white [text-shadow:0.125em_0.075em_var(--color-violet-900)] skew-x-[-20deg] border-white border-3 mb-3 mx-4 text-center">
        <div class="border-violet-900 border-3 py-2 px-4">
            <p class="skew-x-5">{{ text }}</p>
        </div>
    </div>
</template>