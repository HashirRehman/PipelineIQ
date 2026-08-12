"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { uploadProfileCvRequest } from "@/lib/api/profiles-client";
import { Button } from "@/components/ui/button";
import type { ProfileMutationResponse } from "@/lib/api/profiles-client";

export function ProfileCvUploadForm({
  profileId,
  onChanged,
}: {
  profileId: string;
  onChanged?: () => void;
}) {
  const [state, setState] = useState<ProfileMutationResponse>({});
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileInputId = `cv-file-${profileId}`;

  function handleDroppedFile(file: File | undefined) {
    if (!file || !fileInputRef.current) {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.current.files = transfer.files;
    setFileName(file.name);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setState({});
    setIsPending(true);

    const result = await uploadProfileCvRequest(profileId, formData);

    setState(result);
    setIsPending(false);

    if (!result.success) {
      return;
    }
    form.reset();
    setFileName("");

    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label
        htmlFor={fileInputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleDroppedFile(event.dataTransfer.files[0]);
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-3 text-center",
          "transition-colors",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-background hover:border-primary/50 hover:text-foreground",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          id={fileInputId}
          name="file"
          type="file"
          accept=".pdf,.doc,.docx"
          required
          className="sr-only"
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? "");
          }}
        />

        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="size-4" />
          {fileName || "Upload CV (PDF / DOC / DOCX)"}
        </span>

        <span className="text-xs text-muted-foreground">
          or drop the file here
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      {state.success && !state.error && (
        <p role="status" className="text-xs text-success-foreground">
          CV uploaded successfully.
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending || !fileName}
        className="h-8 rounded-md px-4 text-xs hover:bg-primary/90"
      >
        {isPending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
