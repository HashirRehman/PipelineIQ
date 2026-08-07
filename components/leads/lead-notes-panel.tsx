"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * BD notes for a lead, shown in the detail drawer. This used to be an
 * inline-edit cell in the list view and a block on every board card; the
 * drawer is now the single place a note is read or written.
 */
export function LeadNotesPanel({
  notes,
  onSave,
}: {
  notes: string
  onSave: (value: string) => void
}) {
  // The caller keys this on the lead id, so switching leads remounts it and
  // the draft starts from that lead's note — no syncing effect needed.
  const [draft, setDraft] = useState(notes)

  const isDirty = draft.trim() !== notes.trim()

  return (
    <div className="mb-5">
      <div className="mb-2.5 text-xs font-semibold text-[var(--fg)]">BD Notes</div>
      <Textarea
        rows={4}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        placeholder="Add a note about this lead…"
        className="w-full resize-none rounded-md border border-[var(--border-strong)] bg-[var(--secondary)] p-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--primary)]"
      />
      <div className="mt-2 flex gap-2">
        <Button
          onClick={() => onSave(draft.trim())}
          disabled={!isDirty}
          className="h-8 px-3.5 text-xs font-semibold shadow-none"
        >
          Save note
        </Button>
        {isDirty && (
          <Button
            variant="ghost"
            onClick={() => setDraft(notes)}
            className="h-8 text-xs text-[var(--muted-fg)] shadow-none hover:text-[var(--fg)]"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
