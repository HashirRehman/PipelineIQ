import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

function getPageItems(current: number, total: number): (number | "…")[] {
  const items: (number | "…")[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      items.push(i)
    } else if (items[items.length - 1] !== "…") {
      items.push("…")
    }
  }
  return items
}

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
  className?: string
}) {
  const items = getPageItems(page, totalPages)

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex size-8 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors cursor-pointer"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>

      {items.map((item, i) =>
        item === "…" ? (
          <span key={`ellipsis-${i}`} className="flex size-8 items-center justify-center text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex size-8 items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer",
              item === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex size-8 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors cursor-pointer"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
