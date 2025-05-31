<script setup>
    import { ref, watch } from 'vue';

    const props = defineProps([
        "default",
        "variant",
        "lyrics",
        "tabindex"
    ]);

    const emit = defineEmits([
        "settingChanged"
    ]);

    const settingList = ref([
        { codeName: "capitalization", displayName: "Capitalization" },
        { codeName: "accentLetters", displayName: "Accent letters" },
        { codeName: "specialCharacters", displayName: "Special characters" }
    ]);

    const settings = ref({});
    for (let setting of settingList.value) {
        settings.value[setting.codeName] = props.default[setting.codeName];
    }

    watch(props.lyrics, () => {
        if (props.variant == "editor") {
            updateAllowed();
        }
    });

    function updateAllowed() {
        settingList.value[0].allowed = props.variant == "gamewide" || props.lyrics.some((e) => e.some((e2) => e2.word.toLowerCase() != e2.word));
        settingList.value[1].allowed = props.variant == "gamewide" || props.lyrics.some((e) => e.some((e2) => e2.word.replace(/ł/g, "l").replace(/Ł/g, "L").replace(/Ø/g, "O").replace(/ø/g, "o").normalize("NFKD").replace(/\p{Diacritic}/gu, "") != e2.word));
        settingList.value[2].allowed = props.variant == "gamewide" || props.lyrics.some((e) => e.some((e2) => e2.word.replace(/\P{Letter}/gu, "") != e2.word));
    }
    updateAllowed();
</script>

<template>
    <h2
        v-if="variant != 'mapCustomization' || settingList.some((e) => e.allowed)" 
        :class="variant == 'editor' && !settingList.some((e) => e.allowed) ? 'font-bold text-xl mt-4 mb-2 text-neutral-400 cursor-not-allowed' : 'font-bold text-xl mt-4 mb-2'"
        :title="variant == 'editor' && !settingList.some((e) => e.allowed) ? 'No lyrics contain any of those.' : ''"
    >Lyrics customization:</h2>
    
    <label 
        v-for="setting of settingList"
        class="cursor-pointer has-disabled:cursor-not-allowed has-disabled:text-neutral-400"
        :title="variant == 'editor' && !setting.allowed ? 'No lyrics contain ' + setting.displayName.toLowerCase() + '.' : ''"
    >
        <div v-if="variant != 'mapCustomization' || setting.allowed">
            <input 
                class="mr-1 cursor-pointer disabled:cursor-not-allowed"
                type="checkbox"
                v-model="settings[setting.codeName]"
                :disabled="variant == 'editor' && !setting.allowed"
                :tabindex="tabindex"
                @change="(e) => $emit('settingChanged', setting.codeName, settings[setting.codeName])"
            >
            {{ setting.displayName }}
        </div>
    </label>
</template>