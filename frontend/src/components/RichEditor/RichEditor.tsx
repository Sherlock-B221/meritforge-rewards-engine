"use client";

import { type ComponentType, useRef, useState } from "react";
import { Bold, Code, Italic, Link2, List, Quote, SquareCode } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type ToolbarAction = {
  key: string;
  icon: IconType;
  label: string;
  before: string;
  after: string;
};

const ACTIONS: ToolbarAction[] = [
  { key: "bold", icon: Bold, label: "Bold", before: "**", after: "**" },
  { key: "italic", icon: Italic, label: "Italic", before: "_", after: "_" },
  { key: "code", icon: Code, label: "Inline code", before: "`", after: "`" },
  { key: "codeblock", icon: SquareCode, label: "Code block", before: "\n```\n", after: "\n```\n" },
  { key: "link", icon: Link2, label: "Link", before: "[", after: "](https://)" },
  { key: "quote", icon: Quote, label: "Quote", before: "> ", after: "" },
  { key: "list", icon: List, label: "List item", before: "- ", after: "" },
];

/**
 * Controlled markdown editor with a working toolbar (wraps the current
 * selection with markdown syntax) and a Write/Preview toggle that renders the
 * live `Markdown`. Stores plain markdown in `value`.
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  id,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyWrap = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      el.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  };

  const tabClass = (isActive: boolean) =>
    cn(
      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
      isActive ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b px-1.5 py-1.5">
        <div className="mr-auto flex items-center gap-1">
          <button type="button" onClick={() => setTab("write")} className={tabClass(tab === "write")}>
            Write
          </button>
          <button type="button" onClick={() => setTab("preview")} className={tabClass(tab === "preview")}>
            Preview
          </button>
        </div>
        {tab === "write" ? (
          <div className="flex items-center gap-0.5">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyWrap(action.before, action.after)}
                  className="inline-grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          aria-label={ariaLabel}
          className="block w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <div className="min-h-24 px-3 py-2">
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
