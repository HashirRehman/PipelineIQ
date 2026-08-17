"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { cn } from "@/lib/utils";

export type InlineEditType =
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "select"
  | "combobox";

export type InlineEditOption = { value: string; label: string };

/** Returns an error message to keep the editor open, or null on success. */
export type InlineEditSave = (value: string) => Promise<string | null>;

const LABEL_CLASS =
  "shrink-0 text-caption font-semibold uppercase tracking-widest text-muted-foreground";
// One geometry for every row, so highlights match whatever the value is.
const ROW_CLASS =
  "-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-1.5";

// The searchable dropdown shown while a combobox field is being edited.
// Picking an option commits; Escape, or clicking anywhere outside, cancels
// the edit. (A plain blur can't be trusted here: closing the panel unmounts
// the search input, and removing a focused element doesn't fire blur.)
function ComboboxEditor({
  options,
  value,
  onPick,
  onCancel,
}: {
  options: readonly InlineEditOption[];
  value: string;
  onPick: (next: string) => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Cancel when the user clicks outside the combobox (panel included). The
  // setState lives in the listener, not the effect body.
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
      className="min-w-0 flex-1"
      onKeyDown={(e) => {
        // SearchCombobox closes its panel on Escape; the keydown then bubbles
        // here and cancels the whole edit.
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

export function InlineEditField({
  label,
  value,
  type = "text",
  options = [],
  placeholder = "Not set",
  canEdit,
  onSave,
  onEditingChange,
}: {
  label: string;
  value: string | number | null;
  type?: InlineEditType;
  options?: readonly InlineEditOption[];
  placeholder?: string;
  canEdit: boolean;
  onSave: InlineEditSave;
  onEditingChange?: (editing: boolean) => void;
}) {
  const asText = value === null || value === undefined ? "" : String(value);

  const [editing, setEditingState] = useState(false);
  const setEditing = (next: boolean) => {
    if (next) editStart.current = asText;
    setEditingState(next);
    onEditingChange?.(next);
  };
  const [draft, setDraft] = useState(asText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Enter and Escape both blur; without this the value saves twice, or saves
  // after a cancel.
  const skipBlur = useRef(false);
  // What the field held when editing began. Comparing against the prop instead
  // would skip the save whenever a refetch hasn't landed yet.
  const editStart = useRef(asText);

  // Show the just-saved value until the parent's refetch catches up, otherwise
  // the row flashes back to the old value in between.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(asText);
  if (asText !== lastValue) {
    setLastValue(asText);
    setOptimistic(null);
    if (!editing) setDraft(asText);
  }

  const shown = optimistic ?? asText;

  const displayed =
    type === "select"
      ? (options.find((o) => o.value === shown)?.label ?? "")
      : shown;

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

  const valueText = (
    <span
      className={cn(
        "min-w-0 text-right text-xs break-words",
        displayed ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {displayed || placeholder}
    </span>
  );

  const errorText = error ? (
    <p className="mt-1 text-right text-caption text-destructive">{error}</p>
  ) : null;

  const spinner = <Loader2 className="size-3 shrink-0 animate-spin text-primary" />;

  // A native select draws its own menu, so it can't be clipped by the drawer's
  // scroll container the way a portalled popup is. Invisible over the row, so
  // the field looks the same as the text ones.
  if (type === "select") {
    return (
      <div>
        <div
          className={cn(
            ROW_CLASS,
            canEdit && "relative transition-colors hover:bg-accent",
          )}
        >
          <span className={LABEL_CLASS}>{label}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            {valueText}
            {pending
              ? spinner
              : canEdit && (
                  <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                )}
          </span>
          {canEdit && (
            <select
              aria-label={label}
              value={shown}
              disabled={pending}
              onChange={(e) => {
                editStart.current = "";
                void commit(e.target.value);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {errorText}
      </div>
    );
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
      <div>
        <div className={cn(ROW_CLASS, "items-center")}>
          <span className={LABEL_CLASS}>{label}</span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
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
                rows={4}
                // Enter inserts a newline here, so committing needs a modifier.
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancel();
                  else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    skipBlur.current = true;
                    void commit(draft);
                  }
                }}
                className="text-xs"
              />
            ) : (
              <Input
                {...shared}
                type={
                  type === "number"
                    ? "number"
                    : type === "email"
                      ? "email"
                      : "text"
                }
                min={type === "number" ? 0 : undefined}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    skipBlur.current = true;
                    void commit(draft);
                  } else if (e.key === "Escape") cancel();
                }}
                className="h-7 text-right text-xs"
              />
            )}
            {pending && spinner}
          </span>
        </div>
        {errorText}
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className={ROW_CLASS}>
        <span className={LABEL_CLASS}>{label}</span>
        {valueText}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${label}`}
        className={cn(
          ROW_CLASS,
          "w-full cursor-pointer text-left transition-colors hover:bg-accent",
        )}
      >
        <span className={LABEL_CLASS}>{label}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {valueText}
          {pending && spinner}
        </span>
      </button>
      {errorText}
    </div>
  );
}
