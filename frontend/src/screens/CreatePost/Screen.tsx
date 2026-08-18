"use client";

import Link from "next/link";
import { Button, Input, Label, buttonVariants } from "@/components/ui";
import { PageContainer } from "@/components/PageContainer";
import { TagInput } from "@/components/TagInput";
import { RichEditor } from "@/components/RichEditor";
import { cn } from "@/lib/utils";
import { useCreatePostScreen } from "./useScreen";

/** Create Post form: title, tag chips (≤10), and a markdown body editor. */
export function CreatePostScreen() {
  const form = useCreatePostScreen();

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Create a thread</h1>
        <p className="text-sm text-muted-foreground">
          Ask a clear, specific question the community can answer.
        </p>
      </div>

      <form className="space-y-4" onSubmit={form.handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            placeholder="A clear, specific question…"
            value={form.values.title}
            disabled={form.isSubmitting}
            onChange={(event) => form.setTitle(event.target.value)}
            aria-invalid={Boolean(form.errors.title)}
          />
          {form.errors.title ? <p className="text-xs text-destructive">{form.errors.title}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagInput tags={form.values.tags} onChange={form.setTags} disabled={form.isSubmitting} />
          {form.errors.tags ? <p className="text-xs text-destructive">{form.errors.tags}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-body">Body</Label>
          <RichEditor
            id="post-body"
            value={form.values.body}
            onChange={form.setBody}
            rows={8}
            placeholder="Describe what you've tried, expected vs actual…"
            ariaLabel="Post body"
          />
          {form.errors.body ? <p className="text-xs text-destructive">{form.errors.body}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Link href="/feed" className={cn(buttonVariants({ variant: "ghost" }))}>
            Cancel
          </Link>
          <Button type="submit" disabled={!form.isValid || form.isSubmitting}>
            {form.isSubmitting ? "Publishing…" : "Publish thread"}
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-dashed p-4">
        <p className="section-label mb-2">Posting tips</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Be specific — include what you tried and the exact error.</li>
          <li>Add tags so the right people find your thread.</li>
          <li>Use the toolbar for code blocks, bold, and links.</li>
        </ul>
      </div>
    </PageContainer>
  );
}
