import { StatusBadge } from "@/components/status-badge";

type CvEntry = {
  id: string;
  label: string;
  fileName: string;
  isCurrent: boolean;
  createdAt: string;
  downloadUrl: string | null;
};

export function EngineerCvList({ cvs }: { cvs: CvEntry[] }) {
  if (cvs.length === 0) {
    return <p className="text-sm text-muted-foreground">No CVs uploaded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {cvs.map((cv) => (
        <li key={cv.id} className="flex items-center justify-between gap-3 text-sm">
          <div>
            <div className="flex items-center gap-2 font-medium">
              {cv.label}
              {cv.isCurrent && <StatusBadge variant="success">Current</StatusBadge>}
            </div>
            <div className="text-muted-foreground">{cv.fileName}</div>
          </div>
          {cv.downloadUrl && (
            <a
              href={cv.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Download
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
