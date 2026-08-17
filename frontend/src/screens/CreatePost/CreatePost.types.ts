import type { FormEvent } from "react";

/** Local form state for the Create Post form. */
export interface CreatePostFormValues {
  title: string;
  body: string;
  tags: string[];
  /** The chip-input's current draft text, not yet committed as a tag. */
  tagDraft: string;
}

/** Field-level validation errors — present only for invalid fields. */
export interface CreatePostFieldErrors {
  title?: string;
  body?: string;
  tags?: string;
}

/** Everything `Screen.tsx` needs from `useCreatePostScreen` — logic lives in the hook. */
export interface CreatePostViewModel {
  values: CreatePostFormValues;
  errors: CreatePostFieldErrors;
  isSubmitting: boolean;
  isValid: boolean;

  setTitle: (title: string) => void;
  setBody: (body: string) => void;
  insertBodySnippet: (before: string, after: string) => void;

  setTagDraft: (draft: string) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;

  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}
