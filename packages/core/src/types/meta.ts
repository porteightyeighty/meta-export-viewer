/** Normalised shapes the builders emit and the UIs consume (platform-neutral). */

export interface MediaItem {
  /** URL to fetch it from the dev server, e.g. /export/media/posts/123.jpg */
  src: string;
  kind: "image" | "video";
  takenAt?: number;
  width?: number;
  height?: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Post {
  id: string;
  timestamp: number;
  caption: string;
  media: MediaItem[];
  place?: { name: string; description?: string };
  location?: GeoPoint;
  hashtags?: string[];
  crossPostedFrom?: string;
}

export interface Person {
  username: string;
  href?: string;
  /** when they followed / were followed, ms */
  timestamp?: number;
}

export interface DataMeta {
  source: string;
  warnings: string[];
  builtAt?: number;
  error?: string;
}
