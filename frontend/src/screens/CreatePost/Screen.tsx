"use client";

import { Bold, Code, Italic, Link as LinkIcon, SquareCode } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { BODY_TOOLBAR_ACTIONS } from "./CreatePost.constants";
import { useCreatePostScreen } from "./useScreen";
import { TagInput } from "./components";

const TOOLBAR_ICONS = [Bold, Italic, Code, SquareCode, LinkIcon];

/** Light formatting toolbar — inserts markdown-ish syntax into the body textarea. No new dependency. */
function BodyToolbar({
  onInsert,
  disabled,
}: {
  onInsert: (before: string, after: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1">
      {BODY_TOOLBAR_ACTIONS.map((action, index) => {
        const Icon = TOOLBAR_ICONS[index];
        return (
          <Button
            key={action.label}
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled}
            title={action.label}
            aria-label={action.label}
            onClick={() => onInsert(action.before, action.after)}
          >
            {Icon ? <Icon aria-hidden /> : action.label}
          </Button>
        );
      })}
    </div>
  );
}

/** Create Post form: title, tag chips (≤10), body with a light formatting toolbar. */
export function CreatePostScreen() {
  const form = useCreatePostScreen();

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <h1 className="font-heading text-lg font-semibold">New post</h1>

      <form className="space-y-4" onSubmit={form.handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            placeholder="What's your question or topic?"
            value={form.values.title}
            disabled={form.isSubmitting}
            onChange={(event) => form.setTitle(event.target.value)}
            aria-invalid={Boolean(form.errors.title)}
          />
          {form.errors.title ? <p className="text-xs text-destructive">{form.errors.title}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-tags">Tags</Label>
          <TagInput
            tags={form.values.tags}
            draft={form.values.tagDraft}
            onDraftChange={form.setTagDraft}
            onAdd={form.addTag}
            onRemove={form.removeTag}
            disabled={form.isSubmitting}
          />
          {form.errors.tags ? <p className="text-xs text-destructive">{form.errors.tags}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-body">Body</Label>
          <BodyToolbar onInsert={form.insertBodySnippet} disabled={form.isSubmitting} />
          <textarea
            id="post-body"
            className="min-h-40 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            placeholder="Describe your question in detail…"
            value={form.values.body}
            disabled={form.isSubmitting}
            onChange={(event) => form.setBody(event.target.value)}
            aria-invalid={Boolean(form.errors.body)}
          />
          {form.errors.body ? <p className="text-xs text-destructive">{form.errors.body}</p> : null}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!form.isValid || form.isSubmitting}>
            {form.isSubmitting ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </form>
    </div>
  );
}
