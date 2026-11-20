/** Every other JSON in the export → `settings` index + one `settings/<id>` dataset per file, shown generically. */
import path from "node:path";
import { prettyKey, toRecords, type ExportDir } from "@mev/core/node";
import type { Rec } from "@mev/core/types";
import { mediaUrl } from "./media.ts";

/** Files that already have their own views. */
const SKIP =
  /^your_instagram_activity\/messages\/|^your_instagram_activity\/media\/(posts(_\d+)?|stories|archived_posts|profile_photos)\.json$|^connections\/followers_and_following\/(followers(_\d+)?|following)\.json$/;

/** Accounts-Center-style sections by path prefix; first match wins, the rest lands in "Other". */
const SECTIONS: [string, string[]][] = [
  ["Personal details", ["personal_information/"]],
  ["Password and security", ["security_and_login_information/"]],
  ["Your activity", ["your_instagram_activity/", "logged_information/"]],
  ["Connections", ["connections/"]],
  ["Ads", ["ads_information/", "apps_and_websites_off_of_instagram/"]],
  ["Preferences", ["preferences/"]],
];
const OTHER = "Other";

export interface SettingsFile { id: string; title: string; count: number }
export interface SettingsSection { title: string; files: SettingsFile[] }

export function buildSettings(ex: ExportDir, resolveUri: (uri: string) => string | undefined) {
  const media = (uri: string) => {
    const rel = /^https?:/i.test(uri) ? undefined : resolveUri(uri);
    return rel ? mediaUrl(rel) : undefined;
  };
  const sections = new Map<string, SettingsFile[]>([...SECTIONS.map(([t]) => [t, []] as [string, SettingsFile[]]), [OTHER, []]]);
  const data: Record<string, Rec[]> = {};

  for (const rel of ex.walk("")) {
    if (!rel.endsWith(".json") || SKIP.test(rel)) continue;
    const json = ex.readJson(rel);
    if (json === undefined) continue;
    const id = rel.replace(/\.json$/, "");
    const recs = toRecords(json, { media });
    data[`settings/${id}`] = recs;
    const section = SECTIONS.find(([, prefixes]) => prefixes.some((p) => rel.startsWith(p)))?.[0] ?? OTHER;
    sections.get(section)!.push({ id, title: prettyKey(path.posix.basename(id).replace(/_\d+$/, "")), count: recs.length });
  }
  // Same name in two places, or a name already used by a view (Threads' followers.json): add the folder.
  const all = [...sections.values()].flat();
  const taken = new Set(["Followers", "Following"]);
  for (const f of all) {
    const folder = prettyKey(path.posix.basename(path.posix.dirname(f.id)));
    if (folder !== f.title && (taken.has(f.title) || all.some((g) => g !== f && g.title === f.title))) f.title += ` (${folder})`;
  }

  const settings: SettingsSection[] = [...sections]
    .filter(([, files]) => files.length)
    .map(([title, files]) => ({ title, files: files.sort((a, b) => a.title.localeCompare(b.title)) }));
  ex.info(`settings: ${Object.keys(data).length} files in ${settings.length} sections`);
  return { settings, ...data };
}
