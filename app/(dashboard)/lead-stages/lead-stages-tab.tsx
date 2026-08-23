"use client"
import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GripVertical, Loader2, ListOrdered, Pencil, Plus, Trash2, X } from "lucide-react"
import type { ApiPipelineStage, PipelineStageState, PipelineStagesResponse } from "@/app/api/pipeline-stages/route"
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client"
import { queryKeys } from "@/lib/api/query-keys"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PIPELINE_STAGE_STATE_COLOR } from "@/lib/constants"
import { cn } from "@/lib/utils"

const labelClass = "block text-meta font-medium text-muted-foreground mb-1.5"
const inputClass = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/50"

const STATE_LABEL: Record<PipelineStageState, string> = {
  active: "Active",
  paused: "Paused",
  closed: "Closed",
}

/* ─── Stage Modal (shared by Add + Edit) ─── */
interface StageModalProps {
  mode: "add" | "edit"
  stage?: ApiPipelineStage
  onClose: () => void
  onSubmit: (values: { name: string; state: PipelineStageState }) => Promise<void>
}

function StageModal({ mode, stage, onClose, onSubmit }: StageModalProps) {
  const [name, setName] = useState(stage?.name ?? "")
  const [state, setState] = useState<PipelineStageState>(stage?.state ?? "active")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = name.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    setLoading(true); setError("")
    try {
      await onSubmit({ name: name.trim(), state })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            {mode === "add" ? "Add Stage" : "Edit Stage"}
          </DialogTitle>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div>
            <label className={labelClass}>Stage Name *</label>
            <input
              className={inputClass}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. First Round"
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <Select value={state} onValueChange={v => { if (v) setState(v as PipelineStageState) }} name="state">
              <SelectTrigger className="h-9 w-full rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["active", "paused", "closed"] as const).map(s => (
                  <SelectItem key={s} value={s}>{STATE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 rounded-md hover:bg-accent">Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || loading}
              className="flex-[2] h-9 gap-1.5 rounded-md font-semibold hover:bg-primary/90">
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              {mode === "add" ? "Add Stage" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Tab ─── */
export default function LeadStagesTab() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [editingStage, setEditingStage] = useState<ApiPipelineStage | null>(null)
  const [deletingStage, setDeletingStage] = useState<ApiPipelineStage | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const draggingId = useRef<string | null>(null)

  const stagesKey = queryKeys.pipelineStages.list()
  const { data, isPending, error: queryErr } = useQuery({
    queryKey: stagesKey,
    queryFn: ({ signal }) => apiGet<PipelineStagesResponse>("/api/pipeline-stages", signal),
  })

  const stages: ApiPipelineStage[] = data?.stages ?? []
  const canManage = data?.canManage ?? false

  const accessDenied = queryErr instanceof ApiError && queryErr.status === 403
  const error = queryErr && !accessDenied ? "Unable to load lead stages." : null

  const refreshStages = () => queryClient.invalidateQueries({ queryKey: queryKeys.pipelineStages.all() })

  const patchCachedStages = (update: (list: ApiPipelineStage[]) => ApiPipelineStage[]) => {
    queryClient.setQueryData<PipelineStagesResponse>(stagesKey, current =>
      current ? { ...current, stages: update(current.stages) } : current,
    )
  }

  const handleAdd = async ({ name, state }: { name: string; state: PipelineStageState }) => {
    setActionError("")
    await apiPost<{ success: boolean; stage: ApiPipelineStage }>("/api/pipeline-stages", { name, state })
    await refreshStages()
  }

  const handleEdit = async (stageId: string, values: { name?: string; state?: PipelineStageState }) => {
    setActionError("")
    await apiPatch<{ success: boolean }>(`/api/pipeline-stages/${stageId}`, values)
    await refreshStages()
  }

  const handleDelete = async () => {
    if (!deletingStage || deletePending) return
    setDeletePending(true)
    setDeleteError("")
    try {
      await apiDelete<{ success: boolean }>(`/api/pipeline-stages/${deletingStage.id}`)
      await refreshStages()
      setDeletingStage(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete stage.")
    } finally {
      setDeletePending(false)
    }
  }

  // Drag-and-drop reorder — same native HTML5 DnD pattern as the Leads
  // board (no external DnD library in this repo).
  const handleDrop = async (targetId: string) => {
    const draggedId = draggingId.current
    setDragOverId(null)
    draggingId.current = null
    if (!draggedId || draggedId === targetId) return

    const currentOrder = stages.map(s => s.id)
    const fromIndex = currentOrder.indexOf(draggedId)
    const toIndex = currentOrder.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) return

    const nextOrder = [...currentOrder]
    nextOrder.splice(fromIndex, 1)
    nextOrder.splice(toIndex, 0, draggedId)

    // Optimistic reorder.
    patchCachedStages(list => {
      const byId = new Map(list.map(s => [s.id, s]))
      return nextOrder.map((id, i) => {
        const s = byId.get(id)!
        return { ...s, orderIndex: i }
      })
    })

    try {
      await apiPatch<{ success: boolean }>("/api/pipeline-stages", { stageIds: nextOrder })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reorder stages.")
      await refreshStages()
    }
  }

  const activeCount = stages.filter(s => s.state === "active").length
  const pausedCount = stages.filter(s => s.state === "paused").length
  const closedCount = stages.filter(s => s.state === "closed").length

  if (accessDenied) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="text-sm font-semibold text-foreground mb-1.5">Access denied</div>
          <div className="text-xs text-muted-foreground">Only administrators can manage lead stages.</div>
        </div>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Unable to load lead stages.
        </div>
      </div>
    )
  }

  return (
    <>
      {actionError && (
        <div className="mx-6 mb-0 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{actionError}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setActionError("")}
            aria-label="Dismiss error"
            className="size-6 text-destructive/70 hover:bg-transparent hover:text-destructive"
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-border bg-background shrink-0">
        <StatCard label="Active" value={activeCount} icon={ListOrdered} accent="var(--status-green)" delay={0} />
        <StatCard label="Paused" value={pausedCount} icon={ListOrdered} accent="var(--status-amber)" delay={60} />
        <StatCard label="Closed" value={closedCount} icon={ListOrdered} accent="var(--status-slate)" delay={120} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background shrink-0">
        <p className="text-xs text-muted-foreground">
          Drag rows to reorder. Order determines the Leads board column order.
        </p>
        {canManage && (
          <Button
            type="button"
            onClick={() => setShowAdd(true)}
            className="ml-auto h-9 rounded-md px-3 hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Add Stage
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No stages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add your first pipeline stage to get started.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs divide-y divide-border/70">
            {stages.map((stage, idx) => {
              const color = PIPELINE_STAGE_STATE_COLOR[stage.state]
              return (
                <div
                  key={stage.id}
                  draggable={canManage}
                  onDragStart={() => { draggingId.current = stage.id }}
                  onDragOver={e => { e.preventDefault(); setDragOverId(stage.id) }}
                  onDragLeave={() => setDragOverId(current => (current === stage.id ? null : current))}
                  onDrop={e => { e.preventDefault(); handleDrop(stage.id) }}
                  onDragEnd={() => { draggingId.current = null; setDragOverId(null) }}
                  style={{ animation: "chart-rise 0.25s ease-out backwards", animationDelay: `${Math.min(idx, 12) * 25}ms` }}
                  className={cn(
                    "group flex items-center gap-3 bg-background px-4 py-3 transition-colors duration-150",
                    dragOverId === stage.id && "bg-accent/50",
                  )}
                >
                  {canManage && (
                    <GripVertical className="size-4 shrink-0 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                  )}
                  <span className="size-[7px] rounded-full shrink-0" style={{ background: color }} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{stage.name}</span>
                  <span
                    className="rounded-md px-2 py-0.5 text-meta font-medium capitalize"
                    style={{ background: `color-mix(in srgb, ${color} 9%, transparent)`, color }}
                  >
                    {STATE_LABEL[stage.state]}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                    {stage.leadCount} lead{stage.leadCount === 1 ? "" : "s"}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingStage(stage)}
                        className="size-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setDeleteError(""); setDeletingStage(stage) }}
                        className="size-7 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <StageModal mode="add" onClose={() => setShowAdd(false)} onSubmit={handleAdd} />
      )}

      {editingStage && (
        <StageModal
          mode="edit"
          stage={editingStage}
          onClose={() => setEditingStage(null)}
          onSubmit={async ({ name, state }) => {
            await handleEdit(editingStage.id, {
              name: name !== editingStage.name ? name : undefined,
              state: state !== editingStage.state ? state : undefined,
            })
          }}
        />
      )}

      {deletingStage && (
        <Dialog open onOpenChange={open => { if (!open) setDeletingStage(null) }}>
          <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <DialogTitle className="text-base font-semibold">Delete stage</DialogTitle>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {deleteError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {deleteError}
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed">
                Permanently delete <span className="font-semibold">{deletingStage.name}</span>? This cannot be undone.
              </p>
              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeletingStage(null)}
                  className="flex-1 h-9 rounded-md hover:bg-accent"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletePending}
                  className="flex-[2] h-9 gap-1.5 rounded-md bg-destructive font-semibold text-white hover:bg-destructive/90"
                >
                  {deletePending && <Loader2 className="size-3.5 animate-spin" />}
                  Delete Permanently
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
