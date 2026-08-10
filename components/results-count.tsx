// Compact result count for page toolbars — a small accent pill with the
// number plus a muted label ("12 jobs"). Lives in the filter row so it
// never crowds the cards/table below it.
export function ResultsCount({ count, label }: { count: number; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
      <span className="flex size-5 items-center justify-center rounded bg-accent font-semibold text-muted-foreground tabular-nums">
        {count}
      </span>
      {label}
    </span>
  )
}
