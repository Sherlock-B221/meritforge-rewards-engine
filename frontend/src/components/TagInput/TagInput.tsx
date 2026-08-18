"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Self-contained chip input: renders current tags as removable blue chips plus
 * an inline field that commits a tag on Enter/comma (and on blur), and removes
 * the last tag on Backspace when empty. Owns only its draft text; the tag list
 * is controlled via `tags` + `onChange`. Shared by the Feed composer and the
 * Create Post page.
 */
export function TagInput({
  tags,
  onChange,
  disabled = false,
  max = 10,
  placeholder = "Add tags (press Enter)…",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  max?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const value = draft.trim().toLowerCase().replace(/^#/, "");
    setDraft("");
    if (!value || tags.includes(value) || tags.length >= max) {
      return;
    }
    onChange([...tags, value]);
  };

  const remove = (tag: string) => onChange(tags.filter((item) => item !== tag));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip gap-1">
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={() => remove(tag)}
            disabled={disabled}
            className="transition-opacity hover:opacity-80"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        value={draft}
        disabled={disabled || tags.length >= max}
        placeholder={tags.length === 0 ? placeholder : ""}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && draft.length === 0 && tags.length > 0) {
            remove(tags[tags.length - 1]);
          }
        }}
        onBlur={commit}
        aria-label="Add tag"
        className="min-w-28 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
    </div>
  );
}
