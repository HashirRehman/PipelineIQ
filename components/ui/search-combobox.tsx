"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchComboboxOption = {
  /** The stored/submitted value (e.g. a currency code or country name). */
  value: string;
  /** What the user sees in the list and on the closed trigger. */
  label: string;
  /** Right-aligned hint (e.g. the ISO code) — also searchable. */
  hint?: string;
};

/**
 * Generic searchable combobox — the engine behind the country and currency
 * pickers (components/ui/country-combobox.tsx, currency-combobox.tsx). The
 * option list is too long for a plain select, so the closed state is a
 * trigger button and the open state is a search input with a filtered list
 * (type a name or code; ↑/↓ + Enter to pick, Esc to close).
 *
 * Works two ways:
 *  - controlled:  value + onValueChange (filters)
 *  - uncontrolled: defaultValue + name — a hidden input carries the value
 *    so the surrounding form picks it up via FormData (profile form).
 *
 * `allowCustom` keeps values that aren't in the list (legacy free-text
 * data) — they're displayed as-is and re-submitted until the user picks
 * an option.
 */
export function SearchCombobox({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  placeholder = "Select an option",
  allowCustom = false,
  clearable = false,
  compact = false,
  className,
  triggerClassName,
}: {
  options: readonly SearchComboboxOption[];
  /** Controlled value — the selected option's value ("" = none). */
  value?: string;
  /** Uncontrolled initial value (forms): the field keeps its own state. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** When set, renders a hidden input so the value submits with the form. */
  name?: string;
  /** Goes on the closed trigger so a <Label htmlFor> can focus it. */
  id?: string;
  placeholder?: string;
  /** Allow a typed value that isn't in the list (legacy free-text data). */
  allowCustom?: boolean;
  /** Show an × to clear back to "" once a value is selected. */
  clearable?: boolean;
  /** Smaller trigger for toolbars (h-7, rounded-md). */
  compact?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  // Controlled when `value` is provided (filters); otherwise the field
  // keeps its own state and a hidden input submits it (profile form).
  // Deriving `current` during render — rather than syncing with an effect —
  // keeps a controlled value from fighting local edits.
  const [internal, setInternal] = useState(defaultValue ?? value ?? "");
  const current = value !== undefined ? value : internal;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [openUp, setOpenUp] = useState(false);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({
    top: "calc(100% + 4px)",
    maxHeight: 256,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const commit = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
    setHighlighted(0);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [query, options]);

  // Close on outside click; focus the search input when opening. The
  // listener is attached only while open (the setState lives in the
  // callback, not the effect body).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    inputRef.current?.focus();
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const openPanel = () => {
    // Fit the list where there's room: the field may sit near the bottom of a
    // modal or a short panel, and a long option list would otherwise be cut
    // off. Measure against the nearest scrollable ancestor (e.g. the modal
    // body) — or the viewport — then open downward when there's enough space
    // below, otherwise flip upward, capping the height to what fits.
    const root = rootRef.current;
    if (root) {
      const rect = root.getBoundingClientRect();
      let container: Element = root;
      let cs = getComputedStyle(root);
      while (
        container.parentElement &&
        cs.overflowY !== "auto" &&
        cs.overflowY !== "scroll"
      ) {
        container = container.parentElement;
        cs = getComputedStyle(container);
      }
      const bounds =
        container === root
          ? { top: 0, bottom: window.innerHeight }
          : container.getBoundingClientRect();
      const gap = 4; // margin between the field and the list
      const spaceBelow = bounds.bottom - rect.bottom - gap;
      const spaceAbove = rect.top - bounds.top - gap;
      const flip = spaceBelow < 128 && spaceAbove > spaceBelow;
      const available = flip ? spaceAbove : spaceBelow;
      // -gap again so the list's margin/border never pushes it past the edge
      const maxHeight = Math.max(96, Math.min(256, available - gap));
      setOpenUp(flip);
      setListStyle(
        flip
          ? { bottom: "calc(100% + 4px)", maxHeight }
          : { top: "calc(100% + 4px)", maxHeight },
      );
    }
    setQuery("");
    setHighlighted(0);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlighted];
      if (option) {
        commit(option.value);
      } else if (allowCustom && query.trim()) {
        commit(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // The stored value may predate the list (legacy free-text data) — resolve
  // it to its option label for display: exact value match first, then a
  // case-insensitive label match ("pakistan" → "Pakistan"), else as-is.
  const selectedLabel = (() => {
    if (!current) return "";
    const exact = options.find((o) => o.value === current);
    if (exact) return exact.label;
    const folded = options.find(
      (o) => o.label.toLowerCase() === current.toLowerCase(),
    );
    return folded ? folded.label : current;
  })();

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Hidden input so uncontrolled form usage submits the value. */}
      {name && <input type="hidden" name={name} value={current} />}

      {open ? (
        <div
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg border border-ring bg-transparent text-sm transition-colors focus-within:ring-3 focus-within:ring-ring/50",
            compact ? "h-7 rounded-md" : "h-8",
          )}
        >
          <Search className="ml-2.5 size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search…"
            className="h-full w-full min-w-0 bg-transparent pr-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          {clearable && current && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit("");
              }}
              className="mr-1.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label="Clear"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          id={id}
          onClick={openPanel}
          className={cn(
            "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none cursor-pointer hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            compact ? "h-7 rounded-md" : "h-8",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 text-left",
              !current && "text-muted-foreground",
            )}
          >
            {current ? (
              <>
                <span className="truncate">{selectedLabel}</span>
                {clearable && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Clear"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      commit("");
                    }}
                    className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Options"
          style={listStyle}
          className={cn(
            "absolute left-0 right-0 z-50 overflow-y-auto rounded-lg border border-border bg-popover py-1 text-sm text-popover-foreground shadow-xl",
            openUp ? "mb-1" : "mt-1",
          )}
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-1.5 text-muted-foreground">
              No matches found
            </li>
          ) : (
            filtered.map((option, i) => (
              <li
                key={option.value}
                role="option"
                aria-selected={current === option.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(option.value);
                }}
                onMouseEnter={() => setHighlighted(i)}
                // content-visibility: long option lists (249 countries, 119
                // currencies) render only the visible rows; the intrinsic
                // size hint keeps the scrollbar height stable while skipping.
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 [content-visibility:auto] [contain-intrinsic-size:auto_34px]",
                  highlighted === i && "bg-accent text-accent-foreground",
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.hint && (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-xs text-muted-foreground",
                      highlighted === i && "text-accent-foreground/70",
                    )}
                  >
                    {option.hint}
                  </span>
                )}
                {current === option.value && (
                  <Check className="size-3.5 shrink-0" />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
