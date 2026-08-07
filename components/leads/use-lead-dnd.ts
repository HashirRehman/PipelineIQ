"use client"

import { useCallback, useState } from "react"
import type { DragEvent } from "react"
import type { LeadStatus } from "@/lib/constants"

const DRAG_MIME = "text/plain"

/**
 * HTML5 drag-and-drop state for the board. Everything here is React state
 * rather than imperative DOM style mutation — the previous version wrote
 * `currentTarget.style.borderColor` directly, which React then clobbered
 * on the next render and left highlights stuck on.
 */
export function useLeadDnd(onMove: (leadId: string, status: LeadStatus) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null)

  const reset = useCallback(() => {
    setDraggingId(null)
    setDragOverStatus(null)
  }, [])

  const startDrag = useCallback((event: DragEvent, leadId: string) => {
    event.dataTransfer.setData(DRAG_MIME, leadId)
    event.dataTransfer.effectAllowed = "move"
    // Deferred one frame on purpose: setting state synchronously re-renders
    // the source element before the browser snapshots its drag image, so
    // the ghost would be painted with the dimmed dragging style.
    requestAnimationFrame(() => setDraggingId(leadId))
  }, [])

  const dragOver = useCallback((event: DragEvent, status: LeadStatus) => {
    // Without preventDefault the element isn't a valid drop target and the
    // drop event never fires at all.
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverStatus(status)
  }, [])

  const dragLeave = useCallback((event: DragEvent) => {
    // dragleave also fires when the pointer crosses onto a child card, so
    // ignore those and only clear once it has really left the column.
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragOverStatus(null)
  }, [])

  const drop = useCallback(
    (event: DragEvent, status: LeadStatus) => {
      event.preventDefault()
      // The column body is the only drop target now, but stop the event
      // here regardless so a future wrapper handler can't double-apply it.
      event.stopPropagation()
      const leadId = event.dataTransfer.getData(DRAG_MIME)
      if (leadId) onMove(leadId, status)
      reset()
    },
    [onMove, reset],
  )

  return {
    draggingId,
    dragOverStatus,
    startDrag,
    dragOver,
    dragLeave,
    drop,
    // Fires even when the drop lands outside a column, so the dragged card
    // can't stay dimmed forever.
    endDrag: reset,
  }
}
