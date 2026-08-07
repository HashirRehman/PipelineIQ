"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProfileCoreFieldsForm } from "./profile-core-fields-form";
import { ProfileActiveToggle } from "./profile-active-toggle";
import { ProfileCvList } from "./profile-cv-list";
import { ProfileCvUploadForm } from "./profile-cv-upload-form";
import { ProfileAssignment } from "./profile-assignment";
import type { AssignableUser } from "@/app/api/profiles/route";

type ProfileDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  seniority: string | null;
  seniorityLevelId: string;
  yearsExperience: number | null;
  rateExpectation: number | null;
  rateCurrency: string;
  summary: string | null;
  isActive: boolean;
  assignedUserId: string | null;
  assignedUserName: string | null;
};

type SeniorityLevel = {
  id: string;
  name: string;
};

type CvEntry = {
  id: string;
  fileName: string;
  createdAt: string;
  downloadUrl: string | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatRate(profile: ProfileDetail) {
  if (profile.rateExpectation === null) {
    return "Rate not set";
  }

  return `${profile.rateCurrency} ${profile.rateExpectation}/hr`;
}

function ReadOnlyDetails({ profile }: { profile: ProfileDetail }) {
  const fields = [
    ["Full Name", profile.fullName],
    ["Email", profile.email],
    ["Phone", profile.phone || "Not provided"],
    ["Location", profile.location || "Not provided"],
    ["Seniority Level", profile.seniority || "Not provided"],
    [
      "Years of Experience",
      profile.yearsExperience === null
        ? "Not provided"
        : String(profile.yearsExperience),
    ],
    ["Rate", formatRate(profile)],
    ["Status", profile.isActive ? "Active" : "Inactive"],
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-sm text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium text-muted-foreground">Summary</p>
        <p className="mt-1 text-sm leading-6 text-foreground">
          {profile.summary || "No summary provided."}
        </p>
      </div>
    </>
  );
}

export function ProfileDetailSheet({
  profile,
  seniorityLevels,
  assignableUsers,
  cvs,
  isAdmin,
  onClose,
  onChanged,
}: {
  profile: ProfileDetail;
  seniorityLevels: SeniorityLevel[];
  assignableUsers: AssignableUser[];
  cvs: CvEntry[];
  isAdmin: boolean;
  onClose?: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          if (onClose) {
            onClose();
          } else {
            router.replace("/profiles", { scroll: false });
          }
        }
      }}
    >
      <SheetContent
        side="right"
        className="!w-full !max-w-none gap-0 sm:!w-[560px] sm:!max-w-[560px]"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 pr-10">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info-foreground text-sm font-semibold text-primary-foreground">
              {getInitials(profile.fullName)}
            </div>

            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-lg font-semibold">
                {profile.fullName}
              </SheetTitle>

              <SheetDescription className="truncate">
                {profile.email}
              </SheetDescription>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={
                    profile.isActive
                      ? "rounded-md bg-success px-2 py-0.5 text-[11px] font-medium text-success-foreground"
                      : "rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  }
                >
                  {profile.isActive ? "Active" : "Inactive"}
                </span>

                {profile.seniority && (
                  <span className="rounded-md bg-info px-2 py-0.5 text-[11px] font-medium text-info-foreground">
                    {profile.seniority}
                  </span>
                )}

                <span className="font-mono text-xs text-muted-foreground">
                  {formatRate(profile)}
                </span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center justify-end gap-2 pr-10">
              <ProfileActiveToggle
                profileId={profile.id}
                isActive={profile.isActive}
                onChanged={onChanged}
              />

              <Button
                type="button"
                variant={isEditing ? "outline" : "secondary"}
                size="sm"
                onClick={() => setIsEditing((current) => !current)}
              >
                {isEditing ? "Cancel editing" : "Edit"}
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section>
            <h2 className="mb-4 text-sm font-semibold">Core details</h2>


            {isAdmin && isEditing ? (
              <ProfileCoreFieldsForm
                mode="update"
                profileId={profile.id}
                initialValues={{
                  fullName: profile.fullName,
                  email: profile.email,
                  phone: profile.phone ?? "",
                  location: profile.location ?? "",
                  seniorityLevelId: profile.seniorityLevelId,
                  yearsExperience:
                    profile.yearsExperience?.toString() ?? "",
                  rateExpectation:
                    profile.rateExpectation?.toString() ?? "",
                  rateCurrency: profile.rateCurrency,
                  summary: profile.summary ?? "",
                }}
                seniorityLevels={seniorityLevels}
                submitLabel="Save changes"
                onSuccess={onChanged ? () => onChanged() : undefined}
              />
            ) : (
              <ReadOnlyDetails profile={profile} />
            )}
          </section>

          <section className="mt-7 border-t border-border pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Assigned user</h2>

              {isAdmin && !profile.assignedUserId && (
                <span className="text-xs text-muted-foreground">
                  No user assigned
                </span>
              )}
            </div>

            <ProfileAssignment
              profileId={profile.id}
              assignedUserId={profile.assignedUserId}
              assignedUserName={profile.assignedUserName}
              users={assignableUsers}
              isAdmin={isAdmin}
              onChanged={onChanged}
            />

            <p className="mt-2 text-xs text-muted-foreground">
              One user can be assigned to one profile at a time.
            </p>
          </section>

          <section className="mt-7 border-t border-border pt-6">
            <h2 className="mb-4 text-sm font-semibold">CVs</h2>

            <div className="flex flex-col gap-4">
              <ProfileCvList
                cvs={cvs}
                profileId={profile.id}
                isAdmin={isAdmin}
                onChanged={onChanged}
              />

              {isAdmin && (
                <ProfileCvUploadForm
                  profileId={profile.id}
                  onChanged={onChanged}
                />
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
