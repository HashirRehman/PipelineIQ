"use client";

import { MapPin, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ProfileListItem,
  formatRate,
  getInitials,
} from "./profiles-list";

// Table-style list view for the Profiles page — one row per candidate.
// Clicking a row opens the same detail sheet as the cards view. Only renders
// what the parent already computed — no filtering here.
export function ProfilesListView({
  profiles,
  onSelectProfile,
}: {
  profiles: ProfileListItem[];
  onSelectProfile: (profileId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Candidate
            </th>
            <th className="hidden px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
              Location
            </th>
            <th className="hidden px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
              Seniority
            </th>
            <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="hidden px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
              Assigned to
            </th>
            <th className="px-4 py-3 text-right text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Rate
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {profiles.map((profile) => (
            <tr
              key={profile.id}
              onClick={() => onSelectProfile(profile.id)}
              className="group cursor-pointer bg-background transition-colors hover:bg-accent/40"
            >
              {/* Candidate: initials avatar + name + email */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar-2 text-xs font-semibold text-white select-none">
                    {getInitials(profile.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground transition-colors group-hover:text-primary">
                      {profile.fullName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>
                </div>
              </td>

              {/* Location */}
              <td className="hidden px-4 py-3 md:table-cell">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">
                    {profile.location || "Location not set"}
                  </span>
                </span>
              </td>

              {/* Seniority */}
              <td className="hidden px-4 py-3 md:table-cell">
                {profile.seniority ? (
                  <span className="rounded-md bg-info px-2 py-0.5 text-meta font-medium text-info-foreground">
                    {profile.seniority}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-meta font-medium capitalize",
                    profile.isActive
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {profile.isActive ? "Active" : "Inactive"}
                </span>
              </td>

              {/* Assigned to */}
              <td className="hidden px-4 py-3 lg:table-cell">
                {profile.assignedUserName ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-meta font-medium text-warning-foreground">
                    <UserRound className="size-3" />
                    {profile.assignedUserName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>

              {/* Rate */}
              <td className="px-4 py-3 text-right">
                <span className="whitespace-nowrap text-xs font-medium text-foreground">
                  {formatRate(profile)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
