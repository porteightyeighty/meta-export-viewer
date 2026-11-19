import { createRouter, createWebHistory } from "vue-router";
import ProfileView from "./views/ProfileView.vue";

export const router = createRouter({
  history: createWebHistory(),
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
      path: "/direct",
      component: () => import("./views/DirectView.vue"),
      children: [
        { path: "", name: "direct", component: () => import("./views/DirectEmpty.vue") },
        { path: "requests", name: "direct-requests", component: () => import("./views/DirectEmpty.vue") },
        { path: "t/:id", name: "thread", component: () => import("./views/ThreadView.vue"), props: true },
      ],
    },
    { path: "/:rest(.*)*", component: () => import("./views/ComingSoon.vue") },
  ],
  scrollBehavior: (to, from, saved) => saved ?? (to.matched[0]?.path === from.matched[0]?.path ? false : { top: 0 }),
});
