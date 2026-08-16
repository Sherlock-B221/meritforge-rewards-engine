"use client";

import type { ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Button } from "@/components/ui";

function SectionFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <p>Couldn&apos;t load this section.</p>
      <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
        Retry
      </Button>
    </div>
  );
}

/**
 * Wraps one data-fetching section so a failure there degrades gracefully
 * ("Couldn't load · Retry") instead of taking down the rest of the page.
 * Thin wrapper over `react-error-boundary` — no fetch/business logic here.
 */
export function SectionBoundary({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <ErrorBoundary FallbackComponent={SectionFallback} onReset={onRetry}>
      {children}
    </ErrorBoundary>
  );
}
