"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { deleteProfileCvRequest, parseProfileCvRequest } from "@/lib/api/profiles-client";
import type { ProfileMutationResponse } from "@/lib/api/profiles-client";
import { Button } from "@/components/ui/button";
import type { ProfileCvEntry } from "@/app/api/profiles/[profileId]/route";
import { ProfileCvDetails, cvParseState, type CvParseState } from "./profile-cv-details";

type CvEntry = ProfileCvEntry;

// How often to re-fetch while a CV is being read. The parse takes a couple of
// seconds end to end, so this resolves the row without the user doing anything.
const PARSE_POLL_INTERVAL_MS = 3000;

const STATE_BADGE: Record<CvParseState, { label: string; className: string; icon: React.ReactNode }> = {
  parsed: {
    label: "Read",
    className: "text-status-green",
    icon: <CheckCircle2 className="size-3" />,
  },
  parsing: {
    label: "Reading",
    className: "text-muted-foreground",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  unparsed: {
    label: "Not read",
    className: "text-muted-foreground",
    icon: null,
  },
  failed: {
    label: "Couldn't read",
    className: "text-destructive",
    icon: <AlertTriangle className="size-3" />,
  },
};

function ParseStateBadge({ state }: { state: CvParseState }) {
  const badge = STATE_BADGE[state];
  return (
    <span className={`inline-flex items-center gap-1 text-caption ${badge.className}`}>
      {badge.icon}
      {badge.label}
    </span>
  );
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function DeleteCvButton({
  profileId,
  cv,
  onDeleted,
}: {
  profileId: string;
  cv: CvEntry;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  function armConfirmation() {
    setError(null);
    setIsConfirming(true);

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    confirmTimeoutRef.current = setTimeout(() => {
      setIsConfirming(false);
    }, 3000);
  }

  async function handleDelete() {
    if (isPending) {
      return;
    }

    if (!isConfirming) {
      armConfirmation();
      return;
    }

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    setIsPending(true);
    setError(null);

    const result: ProfileMutationResponse = await deleteProfileCvRequest(
      profileId,
      cv.id,
    );

    setIsPending(false);

    if (!result.success) {
      setError(result.error ?? "Failed to delete CV.");
      setIsConfirming(false);
      return;
    }

    onDeleted();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && (
        <p className="max-w-40 text-right text-xs leading-snug text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={
          isConfirming
            ? `Confirm deletion of ${cv.fileName}`
            : `Delete ${cv.fileName}`
        }
        className={[
          "size-7 rounded",
          isConfirming
            ? "bg-destructive/10 text-destructive"
            : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        ].join(" ")}
      >
        {isPending ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </Button>
      {isConfirming && !isPending && (
        <span className="text-xs font-medium text-destructive">Confirm?</span>
      )}
    </div>
  );
}

export function ProfileCvList({
  cvs,
  profileId,
  canManage,
  onChanged,
}: {
  cvs: CvEntry[];
  profileId: string;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [expandedCvId, setExpandedCvId] = useState<string | null>(null);
  const [parsingCvIds, setParsingCvIds] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  }, [onChanged, router]);

  function handleDeleted() {
    refresh();
  }

  async function runParse(cvId: string) {
    if (parsingCvIds.includes(cvId)) {
      return;
    }

    setParsingCvIds((ids) => [...ids, cvId]);
    setParseErrors((errors) => {
      const next = { ...errors };
      delete next[cvId];
      return next;
    });

    const result = await parseProfileCvRequest(profileId, cvId);

    setParsingCvIds((ids) => ids.filter((id) => id !== cvId));

    // The route answers 200 with success:false when the parse itself failed —
    // the row now records why, so surface that reason rather than a generic
    // message.
    if (!result.success) {
      setParseErrors((errors) => ({
        ...errors,
        [cvId]: result.error ?? "Couldn't read this CV.",
      }));
    }

    // Refresh either way: on success to pick up the parse, on failure to pick
    // up the new parse_status and error stored on the row.
    refresh();
  }

  // A CV uploaded moments ago is being parsed in the background, and nothing
  // pushes that result to the browser. Poll while such a row is on screen so
  // its details appear on their own, and stop as soon as none are left — this
  // is bounded by cvParseState's window, so it can't poll forever.
  const hasParsingCv = cvs.some((cv) => cvParseState(cv) === "parsing");

  // refresh() is rebuilt on every render (its onChanged prop is defined inline
  // by the parent), so depending on it directly would tear down and recreate
  // the interval on each render — including the re-render each poll causes,
  // which keeps restarting the countdown. Holding it in a ref lets the effect
  // depend only on whether polling should happen at all.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!hasParsingCv) {
      return;
    }

    const timer = setInterval(() => refreshRef.current(), PARSE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasParsingCv]);

  if (cvs.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        No CVs uploaded yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {cvs.map((cv) => (
        <CvRow
          key={cv.id}
          cv={cv}
          profileId={profileId}
          canManage={canManage}
          isExpanded={expandedCvId === cv.id}
          onToggle={() => setExpandedCvId(expandedCvId === cv.id ? null : cv.id)}
          isParsing={parsingCvIds.includes(cv.id)}
          onParse={() => runParse(cv.id)}
          actionError={parseErrors[cv.id] ?? null}
          onDeleted={handleDeleted}
        />
      ))}
    </ul>
  );
}

function CvRow({
  cv,
  profileId,
  canManage,
  isExpanded,
  onToggle,
  isParsing,
  onParse,
  actionError,
  onDeleted,
}: {
  cv: CvEntry;
  profileId: string;
  canManage: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isParsing: boolean;
  onParse: () => void;
  actionError: string | null;
  onDeleted: () => void;
}) {
  const state = cvParseState(cv, isParsing);

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 py-2.5">
        {/* The whole left side is the toggle, so clicking the file name opens
            its details — the download and delete controls sit outside it so a
            click on either doesn't also expand the row. */}
        <Button
          type="button"
          variant="ghost"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="h-auto min-w-0 flex-1 gap-3 rounded-none p-0 text-left hover:bg-transparent"
        >
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{cv.fileName}</p>
            <p className="text-meta flex items-center gap-2 text-muted-foreground">
              {formatUploadDate(cv.createdAt)}
              <ParseStateBadge state={state} />
            </p>
          </div>
          <ChevronDown
            className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </Button>

        <div className="flex shrink-0 items-center gap-1">
          {cv.downloadUrl && (
            <a
              href={cv.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Download"
            >
              <Download className="size-3.5" />
            </a>
          )}
          {canManage && (
            <DeleteCvButton profileId={profileId} cv={cv} onDeleted={onDeleted} />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="pb-2.5">
          <ProfileCvDetails
            cv={cv}
            state={state}
            canManage={canManage}
            actionError={actionError}
            onParse={onParse}
          />
        </div>
      )}
    </li>
  );
}
