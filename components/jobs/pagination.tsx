import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
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
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="size-8 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {items.map((item, i) =>
        item === "…" ? (
          <span key={`ellipsis-${i}`} className="flex size-8 items-center justify-center text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={item}
            type="button"
            variant="outline"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "size-8 rounded text-xs font-medium",
              item === page
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="size-8 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
