"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
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

type SeniorityLevel = { id: string; name: string };
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function ReadOnlyDetails({ profile }: { profile: ProfileDetail }) {
  const fields: [string, string][] = [
    ["Full Name", profile.fullName],
    ["Email", profile.email],
    ["Phone", profile.phone || "Not provided"],
    ["Location", profile.location || "Not provided"],
    ["Seniority", profile.seniority || "Not provided"],
    [
      "Years Experience",
      profile.yearsExperience !== null
        ? String(profile.yearsExperience)
        : "Not provided",
    ],
    ["Rate", formatRate(profile)],
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 text-sm text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-medium text-muted-foreground">
          Summary
        </p>
        <p className="mt-0.5 text-sm text-foreground leading-relaxed">
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
        className="!w-full !max-w-none sm:!w-[540px] sm:!max-w-[540px] flex flex-col p-0 gap-0"
      >
        <SheetHeader className="border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info text-sm font-semibold text-primary-foreground select-none">
              {getInitials(profile.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base font-semibold">
                {profile.fullName}
              </SheetTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {profile.email}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {profile.isActive ? "Active" : "Inactive"}
              </span>
              {isAdmin && (
                <ProfileActiveToggle
                  profileId={profile.id}
                  isActive={profile.isActive}
                  onChanged={onChanged}
                />
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>Details</SectionTitle>
              {isAdmin && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                >
                  <Pencil className="size-3" /> Edit
                </button>
              )}
            </div>
            {isEditing ? (
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
                onSuccess={() => {
                  setIsEditing(false);
                  onChanged?.();
                }}
              />
            ) : (
              <ReadOnlyDetails profile={profile} />
            )}
          </section>

          {isAdmin && (
            <section>
              <SectionTitle>Assignment</SectionTitle>
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
          )}

          <section>
            <SectionTitle>CVs</SectionTitle>
            <ProfileCvList
              cvs={cvs}
              profileId={profile.id}
              isAdmin={isAdmin}
              onChanged={onChanged}
            />
            {isAdmin && (
              <div className="mt-3">
                <ProfileCvUploadForm profileId={profile.id} onChanged={onChanged} />
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
