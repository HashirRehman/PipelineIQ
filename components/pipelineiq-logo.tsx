import Image from "next/image"

/** Recurso Labs "R" mark — the geometric gradient letterform */
export function RecursoMark({ size = 32 }: { size?: number }) {
  return (
    <div className="bg-white p-1 rounded-md">
    <Image
      src="/recurso-labs-logo.png"
      alt="Recurso Labs"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      priority
    />
    </div>
  )
}

export function PipelineIQLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const markSize = size === "lg" ? 40 : size === "sm" ? 20 : 25
  const titleClass = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm"
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <RecursoMark size={markSize} />
      <div className="min-w-0 space-y-1">
        <div className={`${titleClass} font-bold tracking-tight text-foreground leading-none`}>
          Pipeline<span className="text-primary">IQ</span>
        </div>
        <div className="text-micro text-muted-foreground tracking-widest uppercase font-medium mt-0.5">
          Recurso Labs
        </div>
      </div>
    </div>
  )
}
