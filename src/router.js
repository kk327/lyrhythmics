import { createMemoryHistory, createRouter } from 'vue-router';

import Home from './views/Home.vue';
import Play from './views/Play.vue';
import Editor from './views/Editor.vue';

const routes = [
    { path: "/", component: Home },
    { path: "/play", component: Play },
    { path: "/editor", component: Editor }
]

const router = createRouter({
    history: createMemoryHistory(),
    routes
})

export default router