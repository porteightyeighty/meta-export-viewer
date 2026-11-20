import { createRouter, createWebHashHistory, createWebHistory } from "vue-router";
import ProfileView from "./views/ProfileView.vue";

export const router = createRouter({
  // Hash URLs on the static site: any host serves them, and offline only needs index.html.
  history: import.meta.env.PROD ? createWebHashHistory() : createWebHistory(),
  routes: [
    {
      path: "/",
      component: ProfileView,
      children: [
        { path: "p/:id", name: "post", component: () => import("./views/PostModal.vue"), props: { source: "posts" } },
        { path: "followers", name: "followers", component: () => import("./views/FollowsModal.vue"), props: { kind: "followers" } },
        { path: "following", name: "following", component: () => import("./views/FollowsModal.vue"), props: { kind: "following" } },
      ],
    },
    {
      path: "/archive",
      component: () => import("./views/ArchiveView.vue"),
      children: [{ path: "p/:id", name: "archived-post", component: () => import("./views/PostModal.vue"), props: { source: "archived" } }],
    },
    {
      path: "/archive/stories",
      component: () => import("./views/ArchiveView.vue"),
      props: { kind: "stories" },
      children: [{ path: ":id", name: "story", component: () => import("./views/StoryViewer.vue"), props: true }],
    },
    {
      path: "/direct",
      component: () => import("./views/DirectView.vue"),
      children: [
        { path: "", name: "direct", component: () => import("./views/DirectEmpty.vue") },
        { path: "requests", name: "direct-requests", component: () => import("./views/DirectEmpty.vue") },
        { path: "t/:id", name: "thread", component: () => import("./views/ThreadView.vue"), props: true },
      ],
    },
    { path: "/search", name: "search", component: () => import("./views/SearchView.vue") },
    { path: "/accounts/:file(.*)*", name: "accounts", component: () => import("./views/AccountsView.vue") },
    { path: "/:rest(.*)*", component: () => import("./views/ComingSoon.vue") },
  ],
  scrollBehavior: (to, from, saved) => saved ?? (to.matched[0]?.path === from.matched[0]?.path ? false : { top: 0 }),
});
