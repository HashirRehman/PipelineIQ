"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileCoreFieldsForm } from "./profile-core-fields-form";

type SeniorityLevel = {
  id: string;
  name: string;
};

export function NewProfileDialog({
  seniorityLevels,
  onCreated,
}: {
  seniorityLevels: SeniorityLevel[];
  onCreated?: (profileId: string) => void;
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
            Add a new candidate profile to the roster.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          <ProfileCoreFieldsForm
            mode="create"
            seniorityLevels={seniorityLevels}
            submitLabel="Create Profile"
            onSuccess={
              onCreated
                ? (profileId) => {
                  setOpen(false);
                  onCreated(profileId);
                }
                : undefined
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
