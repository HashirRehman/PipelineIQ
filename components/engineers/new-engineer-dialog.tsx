"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createEngineer } from "@/lib/actions/engineers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EngineerCoreFieldsForm } from "./engineer-core-fields-form";

type SeniorityLevel = {
  id: string;
  name: string;
};

export function NewEngineerDialog({
  seniorityLevels,
  onCreated,
}: {
  seniorityLevels: SeniorityLevel[];
  onCreated?: (engineerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="w-full gap-2 sm:w-auto" />}
      >
        <Plus className="size-4" />
        New Profile
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New Profile</DialogTitle>
          <DialogDescription>
            Add a new engineer profile to the candidate roster.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          <EngineerCoreFieldsForm
            action={createEngineer}
            seniorityLevels={seniorityLevels}
            submitLabel="Create Profile"
            redirectOnSuccess={!onCreated}
            onSuccess={
              onCreated
                ? (engineerId) => {
                  setOpen(false);
                  onCreated(engineerId);
                }
                : undefined
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}