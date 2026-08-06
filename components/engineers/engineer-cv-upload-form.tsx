"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { uploadEngineerCvRequest } from "@/lib/api/engineers-client";
import type { EngineerMutationResponse } from "@/lib/api/engineers-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EngineerCvUploadForm({
  engineerId,
  onChanged,
}: {
  engineerId: string;
  onChanged?: () => void;
}) {
  const [state, setState] = useState<EngineerMutationResponse>({});
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileInputId = `cv-file-${engineerId}`;
  const labelInputId = `cv-label-${engineerId}`;

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

    const result = await uploadEngineerCvRequest(engineerId, formData);

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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border-t border-border pt-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={labelInputId}>Label</Label>

        <Input
          id={labelInputId}
          name="label"
          placeholder="e.g. Updated resume"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fileInputId}>Resume file</Label>

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
            "flex cursor-pointer flex-col items-center justify-center",
            "rounded-lg border border-dashed px-5 py-7 text-center",
            "transition-colors",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
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

          <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Upload className="size-5" />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Drop PDF or Word resume here
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            or <span className="font-medium text-primary">browse files</span>
          </p>

          {fileName && (
            <p className="mt-3 max-w-full truncate rounded-md bg-secondary px-3 py-1.5 text-xs text-secondary-foreground">
              {fileName}
            </p>
          )}
        </label>
      </div>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive dark:text-red-400"
        >
          {state.error}
        </p>
      )}

      {state.success && !state.error && (
        <p role="status" className="text-sm text-success-foreground">
          CV uploaded successfully.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Uploading…" : "Upload CV"}
      </Button>
    </form>
  );
}