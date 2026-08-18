"use client";

import { Button } from "@/components/ui";

/**
 * Shared inline comment/reply composer: a plain textarea + submit (comments
 * render as markdown on display). Used for the thread's top-level composer and
 * every per-comment reply box.
 */
export function CommentBox({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
  placeholder = "Write a comment…",
  submitLabel = "Comment",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const canSubmit = value.trim().length > 0 && !isSubmitting;
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        autoFocus={autoFocus}
        className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {isSubmitting ? "Posting…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
