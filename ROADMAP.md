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

## 2. Direct (messages) ✅
- `/direct` two-pane inbox (Messages / Requests; the export has no Primary/General split), compact nav rail
- Search by name, plus search across every chat's messages that jumps to the hit
- Thread view: bubbles grouped into same-sender runs, time breaks, sender names in groups, large emoji,
  photos/videos (lightbox), voice notes, calls, shared posts/reels/stories/profiles/links, reactions,
  legacy "liked a message" notices, "Message unavailable" for content the export dropped
- In-chat search (accent-insensitive, Enter / Shift+Enter), info pane with members and shared media
- Remote-only images and GIFs are click-to-load; links in message requests carry a warning
- Loader `core/src/node/messenger.ts` (merges `message_N.json` parts; Facebook Messenger uses the same schema),
  layout/search helpers `core/src/client/chat.ts` + `text.ts`

## 3. Stories ✅
- `/archive/stories`: grid grouped by month with date badges, Posts / Stories switch on the archive
- Full-screen viewer (`/archive/stories/:id`): per-day progress bars, tap left/right or ←/→, auto-advance
  (5 s for photos, video length for videos), Space to pause, plays oldest → newest
- Highlights: not included in the JSON export (checked Nov 2026), so there is no highlights row

## 4. Settings / Accounts Center ✅
- `/accounts`: every export file without its own view, in Accounts-Center-style sections (Personal details,
  Password and security, Your activity, Connections, Ads, Preferences) with entry counts; anything unrecognised
  lands in "Other", so no file is hidden
- Each file opens as searchable cards: nested values indented, dates formatted, links open only on click,
  local media as thumbnails. Contact details, logins and locations appear only here
- Generic converter `core/src/node/records.ts` handles the four recurring shapes (`label_values`,
  `string_map_data`, `string_list_data`, plain objects); renderer `core/src/client/components/RecordList.vue`
- Not yet: custom views per file (e.g. a map of login locations)

## 5. Polish ✅
- Appearance toggle in the nav rail: Auto (follows the OS) → Light → Dark, remembered per browser and applied
  before first paint. Colours are `light-dark()` tokens, so each lives in one place (`core/src/client/theme.ts`)
- Keyboard: visible focus rings, dialogs take focus, keep Tab inside and hand focus back on close,
  ↑/↓ between search results (followers, Direct inbox, Accounts Center), tiles show their caption on focus
- Mobile: bottom bar shows only working pages plus Appearance and More (Accounts Center was unreachable),
  profile tabs fit at 390 px, modal arrows move to the bottom corners, story close button no longer covers pause
- README screenshots from the demo fixture (`docs/screenshots/`, the only media allowed outside `fixtures/`)
- Not done: swipe gestures, shortcut keys beyond the above

## 6. Facebook
- Survey the Facebook export; `apps/facebook` with the Facebook look (top bar, feed/timeline, Friends,
  Messenger, Settings & privacy), reusing the core loaders and components

## Shared vs platform-specific

| Shared (`packages/core`) | Instagram-only (`apps/instagram`) | Likely Facebook twin |
| --- | --- | --- |
| Mojibake repair, label_values / string_map helpers | Post grid, profile header | Timeline, profile cover |
| Export folder reading, media-size sniffing, Vite plugin | Followers / following | Friends list |
| Lightbox, Carousel, MediaView, SearchableList | Reels tab | Videos |
| Messenger thread loader, chat layout + search helpers | Direct UI and styling | Messenger UI |
| Export file → records converter, RecordList | Accounts Center sidebar | Settings & privacy sections |
