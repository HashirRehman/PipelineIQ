"use client";

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
}: {
  seniorityLevels: SeniorityLevel[];
}) {
  return (
    <Dialog>
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
            redirectOnSuccess
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}