"use client";

import { useMemo, useState } from "react";
import { MapPin, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NewProfileDialog } from "./new-profile-dialog";

export type ProfileListItem = {
    id: string;
    fullName: string;
    email: string;
    location: string | null;
    isActive: boolean;
    seniority: string | null;
    rateExpectation: number | null;
    rateCurrency: string;
    assignedUserId: string | null;
    assignedUserName: string | null;
};

type StatusFilter = "all" | "active" | "inactive";
type SeniorityLevel = {
    id: string;
    name: string;
};

function getInitials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

function formatRate(profile: ProfileListItem) {
    if (profile.rateExpectation === null) {
        return "Rate not set";
    }

    return `${profile.rateCurrency} ${profile.rateExpectation}/hr`;
}

export function ProfilesList({
    profiles,
    isAdmin,
    seniorityLevels,
    onSelectProfile,
    onProfileCreated,
}: {
    profiles: ProfileListItem[];
    isAdmin: boolean;
    seniorityLevels: SeniorityLevel[];
    onSelectProfile: (profileId: string) => void;
    onProfileCreated?: (profileId: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const filteredProfiles = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return profiles.filter((profile) => {
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && profile.isActive) ||
                (statusFilter === "inactive" && !profile.isActive);

            if (!matchesStatus) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const searchableValues = [
                profile.fullName,
                profile.email,
                profile.location ?? "",
                profile.seniority ?? "",
            ];

            return searchableValues.some((value) =>
                value.toLowerCase().includes(normalizedSearch),
            );
        });
    }, [profiles, search, statusFilter]);

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Profiles</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {profiles.length} candidate{" "}
                        {profiles.length === 1 ? "profile" : "profiles"}
                    </p>
                </div>

                {isAdmin && (
                    <NewProfileDialog
                        seniorityLevels={seniorityLevels}
                        onCreated={onProfileCreated}
                    />
                )}
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by name, location..."
                        className="pl-9"
                        aria-label="Search candidate profiles"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(event) =>
                        setStatusFilter(event.target.value as StatusFilter)
                    }
                    className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label="Filter profiles by status"
                >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {filteredProfiles.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
                    <UserRound className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No profiles found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Try adjusting your search or status filter.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredProfiles.map((profile) => (
                        <button
                            key={profile.id}
                            type="button"
                            onClick={() => onSelectProfile(profile.id)}
                            className="group w-full rounded-xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info-foreground text-sm font-semibold text-primary-foreground">
                                    {getInitials(profile.fullName)}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-sm font-semibold group-hover:text-primary">
                                        {profile.fullName}
                                    </h2>

                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {profile.email}
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-1.5">
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

                                        {profile.assignedUserName && (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                                                <UserRound className="size-3" />
                                                {profile.assignedUserName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="size-3.5 shrink-0" />
                                <span className="truncate">
                                    {profile.location || "Location not provided"}
                                </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                                <span className="text-sm font-semibold text-primary">
                                    {formatRate(profile)}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
