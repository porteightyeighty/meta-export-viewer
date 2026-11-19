# Roadmap

Direction for the project. Phases build on each other; shared pieces go in `packages/core`.

## 1. Profile grid + posts ✅
- Profile header (avatar, counts, name, pronouns, bio), POSTS / REELS / SAVED / TAGGED tabs
- 3-column grid (3:4 tiles), carousel/video badges, hover captions
- Post viewer (`/p/:id`): carousel, video, caption with #tags/@mentions, place/location, date, ←/→ between posts
- Followers / following dialogs with search
- Archive (`/archive`)
- Merges `posts_N.json` (grouping) with `posts.json` (place, hashtags, location), matched by uri or file content
- Media dimensions sniffed from file headers (exports report 0)

## 2. Direct (messages)
- `/direct` two-pane inbox: thread list with search, Primary / General / Requests tabs
- Thread view: bubbles grouped by sender, day separators, photos/videos/audio, shared posts & links,
  reactions, unsent/deleted placeholders, in-thread search
- Loader: `messages/inbox/*/message_N.json` (+ `message_requests/`). Messenger schema → `core/src/node/messenger.ts`
  (Facebook Messenger uses the same schema), `core/src/client/components/ThreadView.vue`

## 3. Stories
- Stories archive grid by month, full-screen viewer with progress bars, tap/arrow navigation, auto-advance
- Highlights row on the profile (if present in the export)

## 4. Settings / Accounts Center
- Personal details (email, phone, birthday: shown only here)
- Security: login / logout activity, devices, last known location
- Your activity: likes, comments, saved posts & collections, story interactions, search history
- Ads: ad topics, advertisers using your info; apps & websites; notification preferences
- Blocked, close friends, restricted, follow requests, recently unfollowed
- Generic `SettingsShell` (core) with sidebar + sections; any unrecognised JSON is shown as a browsable table

## 5. Polish
- Dark-mode toggle (currently follows the OS), mobile layout refinements, keyboard navigation throughout
- Screenshots in README (from the demo fixture)

## 6. Facebook
- Survey the Facebook export; `apps/facebook` with the Facebook look (top bar, feed/timeline, Friends,
  Messenger, Settings & privacy), reusing the core loaders and components

## Shared vs platform-specific

| Shared (`packages/core`) | Instagram-only (`apps/instagram`) | Likely Facebook twin |
| --- | --- | --- |
| Mojibake repair, label_values / string_map helpers | Post grid, profile header | Timeline, profile cover |
| Export folder reading, media-size sniffing, Vite plugin | Followers / following | Friends list |
| Lightbox, Carousel, MediaView, SearchableList | Reels tab | Videos |
| Messenger thread loader + ThreadView (phase 2) | Direct styling | Messenger styling |
| SettingsShell (phase 4) | Accounts Center sections | Settings & privacy sections |
