"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Generic query-string <-> state sync. Single responsibility: read the
 * current URL's search params into a typed object (falling back to
 * `defaults` per key), and expose a `setState` that patches the URL via
 * `router.push` (shareable links, back-button restores state).
 *
 * Deliberately generic and feature-agnostic — P6's Feed screen supplies its
 * own `sort`/`page`/`search` keys; this hook doesn't know about Feed.
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = searchParams.get(key as string);
      if (value !== null) {
        result[key] = value as T[keyof T];
      }
    }
    return result;
  }, [defaults, searchParams]);

  const setState = useCallback(
    (patch: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === defaults[key]) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [defaults, pathname, router, searchParams],
  );

  return [state, setState];
}
