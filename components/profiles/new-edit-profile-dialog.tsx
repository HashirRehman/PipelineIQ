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

type SeniorityLevel = { id: string; name: string };

export type ProfileDialogProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  seniorityLevelId: string;
  yearsExperience: number | null;
  rateExpectation: number | null;
  rateCurrency: string;
  summary: string | null;
};

export function NewEditProfileDialog({
  seniorityLevels,
  profile,
  open,
  onOpenChange,
  onCreated,
  onSaved,
}: {
  seniorityLevels: SeniorityLevel[];
  /** Pass a profile to open the dialog in edit mode. */
  profile?: ProfileDialogProfile | null;
  /** External control (e.g. an Edit button). Omit to self-manage with the trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (profileId: string) => void;
  onSaved?: (profileId: string) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isEdit = Boolean(profile);
  const isControlled = open !== undefined;

  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger render={<Button className=" gap-2 w-auto" />}>
          <Plus className="size-4" />
          New Profile
        </DialogTrigger>
      )}

      <DialogContent className="min-w-[50vw] max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Profile" : "New Profile"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the candidate profile details."
              : "Add a new candidate profile to the roster."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <ProfileCoreFieldsForm
            mode={isEdit ? "update" : "create"}
            profileId={isEdit ? profile!.id : undefined}
            initialValues={
              isEdit
                ? {
                    fullName: profile!.fullName,
                    email: profile!.email,
                    phone: profile!.phone ?? "",
                    location: profile!.location ?? "",
                    seniorityLevelId: profile!.seniorityLevelId,
                    yearsExperience: profile!.yearsExperience?.toString() ?? "",
                    rateExpectation: profile!.rateExpectation?.toString() ?? "",
                    rateCurrency: profile!.rateCurrency,
                    summary: profile!.summary ?? "",
                  }
                : undefined
            }
            seniorityLevels={seniorityLevels}
            submitLabel={isEdit ? "Save Changes" : "Create Profile"}
            onSuccess={(profileId) => {
              setIsOpen(false);
              if (isEdit) onSaved?.(profileId);
              else onCreated?.(profileId);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
