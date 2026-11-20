import { createApp } from "vue";
import { ExportPicker } from "@mev/core/client";
import App from "./App.vue";
import { router } from "./router.ts";
import "./styles/ig.css";

const mountApp = () => createApp(App).use(router).mount("#app");

if (import.meta.env.PROD) {
  // Static site: the visitor picks their export; nothing is fetched from a server.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  const { loadExport } = await import("./static/load.ts");
  const picker = createApp(ExportPicker, {
    title: "Instagram export viewer",
    load: async (files: File[]) => {
      await loadExport(files);
      picker.unmount();
      mountApp();
    },
  });
  picker.mount("#app");
} else {
  mountApp();
}
