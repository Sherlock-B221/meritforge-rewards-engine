import { cn } from "@/lib/utils";

/**
 * Shared content-width wrapper for authenticated screens so every page shares
 * one consistent column width + gutters (replaces per-screen `mx-auto max-w-*`
 * duplication). `wide` opts into a roomier column for grid-heavy pages.
 */
export function PageContainer({
  children,
  wide = false,
  className,
}: {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full", wide ? "max-w-3xl" : "max-w-2xl", className)}>
      {children}
    </div>
  );
}
