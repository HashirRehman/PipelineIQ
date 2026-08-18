"use client";

import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { NewEditProfileDialog } from "./new-edit-profile-dialog";
import { ProfilesListView } from "./profiles-list-view";
import { Button } from "@/components/ui/button";
import { GooeyInput } from "@/components/ui/gooey-input";
import { ResultsCount } from "@/components/results-count";

export type ProfileListItem = {
  id: string;
  fullName: string;
  email: string;
  location: string | null;
  seniority: string | null;
  rateExpectation: number | null;
  rateCurrency: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
};

type SeniorityLevel = { id: string; name: string };

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatRate(profile: ProfileListItem) {
  if (profile.rateExpectation === null) {
    return "Rate not set";
  }

  return `${profile.rateCurrency} ${profile.rateExpectation}/hr`;
}

export function ProfilesList({
  profiles,
  canManage,
  seniorityLevels,
  onSelectProfile,
  onProfileCreated,
}: {
  profiles: ProfileListItem[];
  canManage: boolean;
  seniorityLevels: SeniorityLevel[];
  onSelectProfile: (profileId: string) => void;
  onProfileCreated?: (profileId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return profiles;
    }

    const searchableValues = (profile: ProfileListItem) => [
      profile.fullName,
      profile.email,
      profile.location ?? "",
      profile.seniority ?? "",
    ];

    return profiles.filter((profile) =>
      searchableValues(profile).some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [profiles, search]);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3 flex-1">
          <GooeyInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search profiles…"
            expandedWidth={300}
          />
        </div>
        {canManage && onProfileCreated && (
          <NewEditProfileDialog
            seniorityLevels={seniorityLevels}
            onCreated={onProfileCreated}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border">
            <UserRound className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">
              No profiles found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center pb-4">
              <ResultsCount
                count={filtered.length}
                label={filtered.length === 1 ? "candidate" : "candidates"}
              />
            </div>
            <ProfilesListView
              profiles={filtered}
              onSelectProfile={onSelectProfile}
            />
          </>
        )}
      </div>
    </div>
  );
}
