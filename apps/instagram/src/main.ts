import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.ts";
import "./styles/ig.css";

createApp(App).use(router).mount("#app");
