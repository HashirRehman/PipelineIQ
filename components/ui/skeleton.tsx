import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Soft blue in light mode (matches the accent fills); a light white
      // in dark mode where the dark accent fill would be near-invisible.
      className={cn("animate-pulse rounded-md bg-accent dark:bg-white/20", className)}
      {...props}
    />
  );
}

export { Skeleton };
