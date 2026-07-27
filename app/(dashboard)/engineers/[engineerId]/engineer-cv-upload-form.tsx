"use client";

import { useActionState } from "react";
import { uploadEngineerCv, type EngineerActionState } from "@/lib/actions/engineers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: EngineerActionState = {};

export function EngineerCvUploadForm({ engineerId }: { engineerId: string }) {
  const [state, formAction, isPending] = useActionState(uploadEngineerCv, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-4">
      <input type="hidden" name="engineerId" value={engineerId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="cvLabel">Label</Label>
        <Input id="cvLabel" name="label" placeholder="e.g. Updated resume" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cvFile">File (PDF, DOC, or DOCX)</Label>
        <Input id="cvFile" name="file" type="file" required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Uploading…" : "Upload CV"}
      </Button>
    </form>
  );
}
