"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  InlineEditField,
  type InlineEditSave,
} from "@/components/inline-edit-field";
import {
  updateProfileFieldsRequest,
  type ProfileFieldPatch,
} from "@/lib/api/profiles-client";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function ProfileSummaryField({
  profile,
  canManage,
  onChanged,
  onEditingChange,
}: {
  profile: ProfileDetail;
  canManage: boolean;
  onChanged?: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditingState] = useState(false);
  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange?.(next);
  };
  const [draft, setDraft] = useState(profile.summary ?? "");
  const [pending, setPending] = useState(false);

  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [last, setLast] = useState(profile.summary ?? "");
  if ((profile.summary ?? "") !== last) {
    setLast(profile.summary ?? "");
    setOptimistic(null);
    if (!editing) setDraft(profile.summary ?? "");
  }
  const shown = optimistic ?? profile.summary ?? "";

  const commit = async () => {
    if (draft === (profile.summary ?? "")) {
      setEditing(false);
      return;
    }
    setPending(true);
    const result = await updateProfileFieldsRequest(profile.id, {
      summary: draft,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Couldn't save.");
      return;
    }
    setError(null);
    setOptimistic(draft);
    setEditing(false);
    onChanged?.();
  };

  if (!canManage) {
    return (
      <p className="text-sm leading-relaxed text-foreground">
        {shown || "No summary provided."}
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full cursor-pointer rounded px-1 py-0.5 text-left text-sm leading-relaxed text-foreground transition-colors hover:bg-accent"
      >
        {shown || (
          <span className="text-muted-foreground">No summary provided.</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        autoFocus
        rows={6}
        disabled={pending}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(profile.summary ?? "");
            setError(null);
            setEditing(false);
          }
        }}
        className="text-sm"
      />
      <p className="text-caption text-muted-foreground">
        Click away to save, Escape to cancel.
      </p>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}

function ProfileFields({
  profile,
  seniorityLevels,
  canManage,
  onChanged,
  onEditingChange,
}: {
  profile: ProfileDetail;
  seniorityLevels: SeniorityLevel[];
  canManage: boolean;
  onChanged?: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const save =
    (patch: (value: string) => ProfileFieldPatch): InlineEditSave =>
    async (value) => {
      const result = await updateProfileFieldsRequest(profile.id, patch(value));
      if (!result.success) return result.error ?? "Couldn't save.";
      onChanged?.();
      return null;
    };

  const shared = { canEdit: canManage, onEditingChange };

  return (
    <div className="flex flex-col gap-4">
      <InlineEditField
        {...shared}
        label="Full Name"
        value={profile.fullName}
        onSave={save((fullName) => ({ fullName }))}
      />
      <InlineEditField
        {...shared}
        label="Email"
        type="email"
        value={profile.email}
        onSave={save((email) => ({ email }))}
      />
      <InlineEditField
        {...shared}
        label="Phone"
        value={profile.phone}
        onSave={save((phone) => ({ phone }))}
      />
      <InlineEditField
        {...shared}
        label="Location"
        value={profile.location}
        onSave={save((location) => ({ location }))}
      />
      <InlineEditField
        {...shared}
        label="Seniority"
        type="select"
        value={profile.seniorityLevelId}
        options={seniorityLevels.map((level) => ({
          value: level.id,
          label: level.name,
        }))}
        onSave={save((seniorityLevelId) => ({ seniorityLevelId }))}
      />
      <InlineEditField
        {...shared}
        label="Years Experience"
        type="number"
        value={profile.yearsExperience}
        onSave={save((yearsExperience) => ({ yearsExperience }))}
      />
      <InlineEditField
        {...shared}
        label="Rate"
        type="number"
        value={profile.rateExpectation}
        placeholder="Rate not set"
        onSave={save((rateExpectation) => ({ rateExpectation }))}
      />
      <InlineEditField
        {...shared}
        label="Currency"
        value={profile.rateCurrency}
        onSave={save((rateCurrency) => ({ rateCurrency }))}
      />
    </div>
  );
}

export function ProfileDetailSheet({
  open,
  profile,
  seniorityLevels,
  assignableUsers,
  cvs,
  canManage,
  onClose,
  onChanged,
}: {
  open: boolean;
  profile: ProfileDetail | null;
  seniorityLevels: SeniorityLevel[];
  assignableUsers: AssignableUser[];
  cvs: CvEntry[];
  canManage: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
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

  // vaul owns Escape and outside-click dismissal, and it ignores
  // onEscapeKeyDown — so editing is gated through `dismissible` instead.
  const [editingFields, setEditingFields] = useState(0);
  const trackEditing = (editing: boolean) =>
    setEditingFields((count) => Math.max(0, count + (editing ? 1 : -1)));

  const displayProfile = profile ?? lastProfile;
  const displayCvs = cvs ?? lastCvs;

  if (!displayProfile) return null;

  return (
    <Drawer
      direction="right"
      dismissible={editingFields === 0}
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DrawerContent className="!w-full !max-w-none sm:!w-[880px] sm:!max-w-[880px] rounded-none! border-border bg-card text-foreground">
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
            {canManage && (
              <ProfileActiveToggle
                profileId={displayProfile.id}
                isActive={displayProfile.isActive}
                onChanged={onChanged}
              />
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column — everything else */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-card px-8 py-6 space-y-7">
            {canManage && (
              <section>
                <SectionTitle>Assignment</SectionTitle>
                <ProfileAssignment
                  profileId={displayProfile.id}
                  assignedUserId={displayProfile.assignedUserId}
                  assignedUserName={displayProfile.assignedUserName}
                  users={assignableUsers}
                  canManage={canManage}
                  onChanged={onChanged}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Each profile can be assigned to one user only. A user may
                  own multiple profiles.
                </p>
              </section>
            )}

            <section>
              <SectionTitle>Summary</SectionTitle>
              <ProfileSummaryField
                profile={displayProfile}
                canManage={canManage}
                onChanged={onChanged}
                onEditingChange={trackEditing}
              />
            </section>

            <section>
              <SectionTitle>CVs</SectionTitle>
              <ProfileCvList
                cvs={displayCvs}
                profileId={displayProfile.id}
                canManage={canManage}
                onChanged={onChanged}
              />
              {canManage && (
                <div className="mt-3">
                  <ProfileCvUploadForm
                    profileId={displayProfile.id}
                    onChanged={onChanged}
                  />
                </div>
              )}
            </section>
          </div>

          {/* Right column — Details */}
          <aside className="w-[280px] shrink-0 border-l border-border bg-page-bg overflow-y-auto px-6 py-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs font-semibold text-foreground">
                Details
              </div>
              {canManage && (
                <span className="text-caption text-muted-foreground">
                  Click a value to edit
                </span>
              )}
            </div>

            <ProfileFields
              profile={displayProfile}
              seniorityLevels={seniorityLevels}
              canManage={canManage}
              onChanged={onChanged}
              onEditingChange={trackEditing}
            />
          </aside>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
