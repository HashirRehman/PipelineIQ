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
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-foreground">BD Notes</div>
      <Textarea
        rows={4}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        placeholder="Add a note about this lead…"
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />
      <div className="flex gap-2">
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
            className="h-8 text-xs text-muted-foreground shadow-none hover:text-foreground"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
