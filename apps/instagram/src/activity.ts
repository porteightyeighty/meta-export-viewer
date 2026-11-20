/** Row text for an activity kind, shared by the Activity page and Search. */
import type { ActivityKind } from "../build/activity.ts";

export const VERB: Record<ActivityKind, string> = {
  like: "You liked a post by",
  "comment-like": "You liked a comment by",
  comment: "You commented on a post by",
  "story-like": "You liked a story by",
  poll: "You voted in a poll by",
  quiz: "You answered a quiz by",
  question: "You answered a question from",
  slider: "You used a slider on a story by",
  countdown: "You followed a countdown by",
};
