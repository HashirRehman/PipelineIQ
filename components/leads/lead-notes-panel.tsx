"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * Applier's Notes for a lead, shown in the detail drawer. The notes belong to
 * the user whose assigned profile was used to apply (the lead's permanent
 * user_id owner snapshot) — only that user can write or edit them; everyone
 * else sees them read-only. The caller keys this on the lead id, so switching
 * leads remounts it and the draft starts from that lead's note.
 */
export function LeadNotesPanel({
  notes,
  onSave,
  canEdit = true,
}: {
  notes: string
  onSave: (value: string) => void
  canEdit?: boolean
}) {
  const [draft, setDraft] = useState(notes)

  const isDirty = draft.trim() !== notes.trim()

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-foreground">Notes</div>
      <Textarea
        rows={4}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        placeholder={canEdit ? "Add a note about this lead…" : "No notes yet."}
        readOnly={!canEdit}
        disabled={!canEdit}
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring transition-shadow duration-150 disabled:cursor-not-allowed disabled:opacity-70"
      />
      {canEdit ? (
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
      ) : (
        <p className="text-meta text-muted-foreground/70">
          Only the user who applied with this profile can edit the notes.
        </p>
      )}
    </div>
  )
}
