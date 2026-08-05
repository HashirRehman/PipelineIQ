import { Download, FileText } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

type CvEntry = {
  id: string;
  label: string;
  fileName: string;
  isCurrent: boolean;
  createdAt: string;
  downloadUrl: string | null;
};

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function EngineerCvList({ cvs }: { cvs: CvEntry[] }) {
  if (cvs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No CVs uploaded yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {cvs.map((cv) => (
        <li
          key={cv.id}
          className="overflow-hidden rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <FileText className="size-4" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {cv.label}
                  </p>

                  {cv.isCurrent && (
                    <StatusBadge variant="success">
                      Current
                    </StatusBadge>
                  )}
                </div>

                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {cv.fileName}
                </p>

                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Uploaded {formatUploadDate(cv.createdAt)}
                </p>
              </div>
            </div>

            {cv.downloadUrl && (
              <a
                href={cv.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
              >
                <Download className="size-3.5" />
                Download
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}