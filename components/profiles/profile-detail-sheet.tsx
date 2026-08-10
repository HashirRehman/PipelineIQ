"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { NewEditProfileDialog } from "./new-edit-profile-dialog";
import { ProfileActiveToggle } from "./profile-active-toggle";
import { ProfileCvList } from "./profile-cv-list";
import { ProfileCvUploadForm } from "./profile-cv-upload-form";
import { ProfileAssignment } from "./profile-assignment";
import type { AssignableUser } from "@/app/api/profiles/route";
import type { ProfileCvEntry } from "@/app/api/profiles/[profileId]/route";

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
// Shared with the API so the parse fields can't drift out of sync here.
type CvEntry = ProfileCvEntry;

function formatRate(profile: ProfileDetail) {
  if (profile.rateExpectation === null) {
    return "Rate not set";
  }

  return `${profile.rateCurrency} ${profile.rateExpectation}/hr`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
    <dl className="flex flex-col gap-4">
      {fields.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </dt>
          <dd className="text-xs text-foreground text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileDetailSheet({
  open,
  profile,
  seniorityLevels,
  assignableUsers,
  cvs,
  isAdmin,
  onClose,
  onChanged,
}: {
  open: boolean;
  profile: ProfileDetail | null;
  seniorityLevels: SeniorityLevel[];
  assignableUsers: AssignableUser[];
  cvs: CvEntry[];
  isAdmin: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  const [lastProfile, setLastProfile] = useState<ProfileDetail | null>(profile);
  const [lastCvs, setLastCvs] = useState(cvs);
  const [prevProfile, setPrevProfile] = useState<ProfileDetail | null>(profile);
  const [prevCvs, setPrevCvs] = useState(cvs);

  if (profile !== prevProfile) {
    setPrevProfile(profile);
    if (profile) setLastProfile(profile);
  }
  if (cvs !== prevCvs) {
    setPrevCvs(cvs);
    setLastCvs(cvs);
  }

  const displayProfile = profile ?? lastProfile;
  const displayCvs = cvs ?? lastCvs;

  if (!displayProfile) return null;

  return (
    <>
      <Drawer direction="right" open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DrawerContent
        className="!w-full !max-w-none sm:!w-[880px] sm:!max-w-[880px] rounded-none! border-border bg-card text-foreground"
      >
        {/* Top bar — avatar + name left, active toggle + dismiss right */}
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-border bg-card shrink-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={displayProfile.fullName} size={24} />
            <span className="truncate text-xs font-semibold text-foreground">
              {displayProfile.fullName}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {displayProfile.isActive ? "Active" : "Inactive"}
            </span>
            {isAdmin && (
              <ProfileActiveToggle
                profileId={displayProfile.id}
                isActive={displayProfile.isActive}
                onChanged={onChanged}
              />
            )}
            <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column — everything else */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-card px-8 py-6 space-y-7">
            {isAdmin && (
              <section>
                <SectionTitle>Assignment</SectionTitle>
                <ProfileAssignment
                  profileId={displayProfile.id}
                  assignedUserId={displayProfile.assignedUserId}
                  assignedUserName={displayProfile.assignedUserName}
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
              <SectionTitle>Summary</SectionTitle>
              <p className="text-sm text-foreground leading-relaxed">
                {displayProfile.summary || "No summary provided."}
              </p>
            </section>

            <section>
              <SectionTitle>CVs</SectionTitle>
              <ProfileCvList
                cvs={displayCvs}
                profileId={displayProfile.id}
                isAdmin={isAdmin}
                onChanged={onChanged}
              />
              {isAdmin && (
                <div className="mt-3">
                  <ProfileCvUploadForm profileId={displayProfile.id} onChanged={onChanged} />
                </div>
              )}
            </section>
          </div>

          {/* Right column — Details */}
          <aside className="w-[280px] shrink-0 border-l border-border bg-page-bg overflow-y-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-foreground">Details</div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    // Close the drawer first so the edit dialog opens on a clean
                    // page — otherwise the drawer's body-level pointer-events
                    // block clicks inside the dialog.
                    onClose();
                    setEditOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                >
                  <Pencil className="size-3" /> Edit
                </button>
              )}
            </div>

            <ReadOnlyDetails profile={displayProfile} />
          </aside>
        </div>
      </DrawerContent>
    </Drawer>

    <NewEditProfileDialog
      profile={displayProfile}
      seniorityLevels={seniorityLevels}
      open={editOpen}
      onOpenChange={setEditOpen}
      onSaved={() => onChanged?.()}
    />
    </>
  );
}
