"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCreatePost } from "@/hooks";
import { BODY_MAX, BODY_MIN, TAGS_MAX, TITLE_MAX, TITLE_MIN } from "./CreatePost.constants";
import type {
  CreatePostFieldErrors,
  CreatePostFormValues,
  CreatePostViewModel,
} from "./CreatePost.types";

const EMPTY_VALUES: CreatePostFormValues = { title: "", body: "", tags: [], tagDraft: "" };

/** Client-side mirror of the backend's field bounds — mirrors `types/forum.ts::CreatePostInput`. */
function validate(values: CreatePostFormValues): CreatePostFieldErrors {
  const errors: CreatePostFieldErrors = {};
  const title = values.title.trim();
  const body = values.body.trim();

  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.title = `Title must be ${TITLE_MIN}-${TITLE_MAX} characters.`;
  }
  if (body.length < BODY_MIN || body.length > BODY_MAX) {
    errors.body = `Body must be ${BODY_MIN}-${BODY_MAX} characters.`;
  }
  if (values.tags.length > TAGS_MAX) {
    errors.tags = `Up to ${TAGS_MAX} tags allowed.`;
  }
  return errors;
}

/**
 * All client logic for the Create Post screen. Owns: form state (title, tags,
 * body), client-side validation mirroring the backend's bounds, and the
 * inline body-toolbar's snippet insertion. Submission is delegated to the
 * shared `hooks/useCreatePost` (optimistic top-of-feed insert); on success we
 * navigate to `/feed` so the new post is visible at the top immediately.
 */
export function useCreatePostScreen(): CreatePostViewModel {
  const router = useRouter();
  const [values, setValues] = useState<CreatePostFormValues>(EMPTY_VALUES);
  const { submit, isSubmitting } = useCreatePost();

  const errors = useMemo(() => validate(values), [values]);
  const isValid = Object.keys(errors).length === 0;

  const setTitle = useCallback((title: string) => {
    setValues((prev) => ({ ...prev, title }));
  }, []);

  const setBody = useCallback((body: string) => {
    setValues((prev) => ({ ...prev, body }));
  }, []);

  const insertBodySnippet = useCallback((before: string, after: string) => {
    setValues((prev) => ({ ...prev, body: `${prev.body}${before}${after}` }));
  }, []);

  const setTagDraft = useCallback((tagDraft: string) => {
    setValues((prev) => ({ ...prev, tagDraft }));
  }, []);

  const addTag = useCallback(() => {
    setValues((prev) => {
      const candidate = prev.tagDraft.trim().toLowerCase();
      if (!candidate || prev.tags.length >= TAGS_MAX || prev.tags.includes(candidate)) {
        return { ...prev, tagDraft: "" };
      }
      return { ...prev, tags: [...prev.tags, candidate], tagDraft: "" };
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setValues((prev) => ({ ...prev, tags: prev.tags.filter((existing) => existing !== tag) }));
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const currentErrors = validate(values);
      if (Object.keys(currentErrors).length > 0 || isSubmitting) {
        return;
      }
      void submit({
        title: values.title.trim(),
        body: values.body.trim(),
        tags: values.tags,
      }).then((created) => {
        if (created) {
          router.push("/feed");
        }
      });
    },
    [values, isSubmitting, submit, router],
  );

  return {
    values,
    errors,
    isSubmitting,
    isValid,
    setTitle,
    setBody,
    insertBodySnippet,
    setTagDraft,
    addTag,
    removeTag,
    handleSubmit,
  };
}
