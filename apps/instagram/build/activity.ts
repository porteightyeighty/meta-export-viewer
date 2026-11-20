/** What you did on Instagram (likes, comments, story interactions) → one newest-first `activity` dataset. */
import { lvFind, lvTop, lvValue, toMs, webUrl, type ExportDir, type LVItem } from "@mev/core/export";

const ACT = "your_instagram_activity";

export type ActivityKind = "like" | "comment-like" | "comment" | "story-like" | "poll" | "quiz" | "question" | "slider" | "countdown";
/** [kind, timestamp ms, account you interacted with, caption/comment/question, instagram.com link] */
export type ActivityRow = [ActivityKind, number, string, string, string];

/** Files read here; Accounts Center skips them. */
export const ACTIVITY_FILES =
  /^your_instagram_activity\/(likes\/liked_(posts|comments)|comments\/(post_comments(_\d+)?|reels_comments)|story_interactions\/(story_likes|polls|quizzes|questions|emoji_sliders|countdowns))\.json$/;

/** label_values files: how each kind picks its text. */
const LV_FILES: [string, ActivityKind, (lv: LVItem[]) => (string | undefined)[]][] = [
  ["likes/liked_posts", "like", (lv) => [lvValue(lv, "Caption")]],
  ["story_interactions/story_likes", "story-like", (lv) => [lvValue(lv, "Caption")]],
  ["story_interactions/polls", "poll", (lv) => [lvValue(lv, "Question")]],
  ["story_interactions/quizzes", "quiz", (lv) => [lvValue(lv, "Question")]],
  ["story_interactions/questions", "question", (lv) => [lvValue(lv, "Question"), lvValue(lv, "Answer")]],
  ["story_interactions/emoji_sliders", "slider", (lv) => [lvValue(lv, "Emoji"), lvValue(lv, "Question")]],
  ["story_interactions/countdowns", "countdown", (lv) => [lvValue(lv, "Text")]],
];

/** Bare array, a single object (countdowns), or one array under a wrapper key. */
const rows = (v: any): any[] =>
  Array.isArray(v) ? v : !v || typeof v !== "object" ? [] : v.label_values ? [v] : ((Object.values(v).find(Array.isArray) as any[]) ?? []);

export function buildActivity(ex: ExportDir) {
  const activity: ActivityRow[] = [];
  const add = (kind: ActivityKind, ts: unknown, owner: unknown, text: (string | undefined)[], href: unknown) => {
    const ms = toMs(ts as number);
    if (ms) activity.push([kind, ms, String(owner ?? ""), text.filter(Boolean).join(" · "), webUrl(href as string) ?? ""]);
  };

  for (const [file, kind, text] of LV_FILES)
    for (const r of rows(ex.readJson(`${ACT}/${file}.json`))) {
      const lv: LVItem[] = r?.label_values ?? [];
      add(kind, r?.timestamp, lvFind(lv, "Username")?.value, text(lv), (lvTop(lv, "URL") ?? lvFind(lv, "URL"))?.href);
    }

  for (const r of rows(ex.readJson(`${ACT}/likes/liked_comments.json`))) {
    const d = r?.string_list_data?.[0] ?? {};
    add("comment-like", d.timestamp, r?.title, [], d.href);
  }

  const commentFiles = [...ex.parts(`${ACT}/comments`, "post_comments"), `${ACT}/comments/post_comments.json`, `${ACT}/comments/reels_comments.json`];
  for (const f of commentFiles)
    for (const r of rows(ex.readJson(f))) {
      const sm = r?.string_map_data ?? {};
      add("comment", sm.Time?.timestamp, sm["Media Owner"]?.value, [sm.Comment?.value], undefined);
    }

  activity.sort((a, b) => b[1] - a[1]);
  ex.info(`activity: ${activity.length} items`);
  return { activity };
}
