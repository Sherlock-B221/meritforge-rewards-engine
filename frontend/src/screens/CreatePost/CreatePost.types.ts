import type { FormEvent } from "react";

/** Local form state for the Create Post form. */
export interface CreatePostFormValues {
  title: string;
  body: string;
  tags: string[];
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
  setTags: (tags: string[]) => void;

  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}
