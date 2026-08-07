import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-fg)]"
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          "w-full py-2 pl-7.5 pr-2.5 bg-[var(--card)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]",
          inputClassName
        )}
      />
    </div>
  )
}
