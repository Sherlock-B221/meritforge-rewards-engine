import { X } from "lucide-react";
import { Input } from "@/components/ui";

/** Chip input: existing tags as removable chips + a draft field that commits on Enter/comma. */
export function TagInput({
  tags,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  disabled,
}: {
  tags: string[];
  draft: string;
  onDraftChange: (draft: string) => void;
  onAdd: () => void;
  onRemove: (tag: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onRemove(tag)}
                disabled={disabled}
                className="rounded-full hover:text-foreground"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        placeholder="Add a tag and press Enter…"
        value={draft}
        disabled={disabled}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            onAdd();
          }
        }}
        aria-label="Add tag"
      />
    </div>
  );
}
