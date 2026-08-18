"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Numbered pager. The list APIs return no total count, so the page window is
 * derived from the current page + whether a next page exists: always surface
 * page 1, the current page's immediate neighbours, and page+1 when `hasNext`.
 */
export function Pagination({
  page,
  hasNext,
  onPageChange,
  className,
}: {
  page: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const maxKnown = hasNext ? page + 1 : page;
  const windowed: number[] = [];
  for (let p = Math.max(1, page - 1); p <= maxKnown; p += 1) {
    windowed.push(p);
  }
  const pages = Array.from(new Set([1, ...windowed])).sort((a, b) => a - b);

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} aria-label="Pagination">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft aria-hidden />
        Prev
      </Button>

      <ul className="flex items-center gap-1">
        {pages.map((p, index) => {
          const previous = pages[index - 1];
          const hasGap = previous !== undefined && p - previous > 1;
          return (
            <li key={p} className="flex items-center gap-1">
              {hasGap ? <span className="px-0.5 text-xs text-muted-foreground">…</span> : null}
              <Button
                type="button"
                variant={p === page ? "default" : "ghost"}
                size="icon-sm"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
