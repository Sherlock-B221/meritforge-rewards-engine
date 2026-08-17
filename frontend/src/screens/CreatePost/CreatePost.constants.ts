/** Client-side mirror of the backend's post-field bounds (`CreatePostInput`). */
export const TITLE_MIN = 5;
export const TITLE_MAX = 200;
export const BODY_MIN = 1;
export const BODY_MAX = 20000;
export const TAGS_MAX = 10;

/** Markdown-ish snippets the body toolbar inserts — no new dependency. */
export const BODY_TOOLBAR_ACTIONS: ReadonlyArray<{
  label: string;
  before: string;
  after: string;
}> = [
  { label: "Bold", before: "**", after: "**" },
  { label: "Italic", before: "_", after: "_" },
  { label: "Code", before: "`", after: "`" },
  { label: "Code block", before: "```\n", after: "\n```" },
  { label: "Link", before: "[", after: "](url)" },
];
