"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchCombobox } from "@/components/ui/search-combobox";

export type InlineEditBlockType = "text" | "textarea" | "combobox";

export type InlineEditBlockOption = { value: string; label: string };

/** Returns an error message to keep the editor open, or null on success. */
export type InlineEditBlockSave = (value: string) => Promise<string | null>;

// The searchable dropdown shown while a combobox block is being edited.
// Picking an option commits; Escape, or clicking anywhere outside, cancels
// the edit. (A plain blur can't be trusted here: closing the panel unmounts
// the search input, and removing a focused element doesn't fire blur.)
function ComboboxEditor({
  options,
  value,
  onPick,
  onCancel,
}: {
  options: readonly InlineEditBlockOption[];
  value: string;
  onPick: (next: string) => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className="min-w-0 max-w-full"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <SearchCombobox
        compact
        autoOpen
        options={options}
        value={value}
        allowCustom
        onValueChange={onPick}
        className="w-full"
      />
    </div>
  );
}

/**
 * Click-to-edit content block for the job drawer's display sections (title,
 * company · location, about the role, skills, technologies). The rendered
 * content is passed in via `children(shown)` so each section keeps its own
 * layout; clicking it (when editable) swaps it for an input/textarea/combobox.
 *
 * Same save semantics as InlineEditField: Enter/Escape (or blur) commit or
 * cancel, the saved value shows optimistically until the parent refetches,
 * and an error keeps the editor open with the message.
 */
export function InlineEditBlock({
  value,
  type = "text",
  options = [],
  canEdit,
  onSave,
  editorClassName,
  children,
}: {
  value: string | null;
  type?: InlineEditBlockType;
  options?: readonly InlineEditBlockOption[];
  canEdit: boolean;
  onSave: InlineEditBlockSave;
  editorClassName?: string;
  children: (shown: string) => React.ReactNode;
}) {
  const asText = value === null || value === undefined ? "" : String(value);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipBlur = useRef(false);
  const editStart = useRef(asText);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(asText);

  if (asText !== lastValue) {
    setLastValue(asText);
    setOptimistic(null);
    if (!editing) setDraft(asText);
  }

  const shown = optimistic ?? asText;

  const startEditing = () => {
    if (!canEdit) return;
    editStart.current = asText;
    setDraft(asText);
    setError(null);
    setEditing(true);
  };

  const commit = async (next: string) => {
    if (next === editStart.current) {
      setEditing(false);
      setError(null);
      return;
    }
    setPending(true);
    const message = await onSave(next);
    setPending(false);
    setError(message);
    if (!message) {
      setOptimistic(next);
      setEditing(false);
    }
  };

  const cancel = () => {
    skipBlur.current = true;
    setDraft(asText);
    setError(null);
    setEditing(false);
  };

  if (!canEdit) {
    return <>{children(asText)}</>;
  }

  if (editing) {
    const shared = {
      autoFocus: true,
      disabled: pending,
      value: draft,
      onBlur: () => {
        if (skipBlur.current) {
          skipBlur.current = false;
          return;
        }
        void commit(draft);
      },
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setDraft(e.target.value),
    };

    return (
      <div className="min-w-0">
        {type === "combobox" ? (
          <ComboboxEditor
            options={options}
            value={draft}
            onPick={(next) => {
              setDraft(next);
              void commit(next);
            }}
            onCancel={cancel}
          />
        ) : type === "textarea" ? (
          <Textarea
            {...shared}
            rows={5}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                skipBlur.current = true;
                void commit(draft);
              }
            }}
            className={editorClassName ?? "text-xs"}
          />
        ) : (
          <Input
            {...shared}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                skipBlur.current = true;
                void commit(draft);
              } else if (e.key === "Escape") cancel();
            }}
            className={editorClassName ?? "h-7 text-sm"}
          />
        )}
        {pending && (
          <Loader2 className="mt-1 size-3 animate-spin text-primary" />
        )}
        {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div
        role="button"
        tabIndex={0}
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
        title="Click to edit"
        aria-label="Click to edit"
        className="w-full cursor-pointer rounded-md transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {children(shown)}
      </div>
      {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
    </div>
  );
}
