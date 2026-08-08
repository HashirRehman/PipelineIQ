import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge doesn't know the custom `--text-*` sizes defined in
// app/theme/typography.css (text-nano/micro/caption/meta/btn-sm/item/
// title-sm), so it used to classify them as unknown `text-*` classes and
// silently drop them whenever they sat next to a `text-*` color such as
// text-muted-foreground. Register them as font sizes so they survive cn().
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-nano",
        "text-micro",
        "text-caption",
        "text-meta",
        "text-btn-sm",
        "text-item",
        "text-title-sm",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
