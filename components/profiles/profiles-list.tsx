"use client";

import { useMemo, useState } from "react";
import { MapPin, UserRound } from "lucide-react";
import { NewEditProfileDialog } from "./new-edit-profile-dialog";
import { ProfilesListView } from "./profiles-list-view";
import { Button } from "@/components/ui/button";
import { GooeyInput } from "@/components/ui/gooey-input";
import { ViewToggle } from "@/components/jobs/view-toggle";
import { ResultsCount } from "@/components/results-count";
import { usePersistedView } from "@/hooks/use-persisted-view";

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
  const [view, setView] = usePersistedView("profiles");

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
        <ViewToggle view={view} onChange={setView} />
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
            {view === "list" ? (
              <ProfilesListView
                profiles={filtered}
                onSelectProfile={onSelectProfile}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((profile) => (
              <Button
                key={profile.id}
                type="button"
                variant="ghost"
                onClick={() => onSelectProfile(profile.id)}
                className="group h-auto w-full rounded-xl border border-border bg-card p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:bg-card hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-avatar-2 text-sm font-semibold text-white select-none">
                    {getInitials(profile.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {profile.fullName}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.seniority && (
                        <span className="rounded-md bg-info px-2 py-0.5 text-meta font-medium text-info-foreground">
                          {profile.seniority}
                        </span>
                      )}
                      {profile.assignedUserName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-meta font-medium text-warning-foreground">
                          <UserRound className="size-3" />
                          {profile.assignedUserName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">
                      {profile.location || "Location not set"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-foreground">
                    {formatRate(profile)}
                  </span>
                </div>
              </Button>
            ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
