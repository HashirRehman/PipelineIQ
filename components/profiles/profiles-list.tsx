"use client";

import { useMemo, useState } from "react";
import { MapPin, UserRound, Search } from "lucide-react";
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
type SeniorityLevel = { id: string; name: string };

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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        return profiles.filter((profile) => {
            const matchStatus =
                statusFilter === "all" ||
                (statusFilter === "active"
                    ? profile.isActive
                    : !profile.isActive);

            if (!matchStatus) {
                return false;
            }

            if (!q) {
                return true;
            }

            const searchableValues = [
                profile.fullName,
                profile.email,
                profile.location ?? "",
                profile.seniority ?? "",
            ];

            return searchableValues.some((value) =>
                value.toLowerCase().includes(q),
            );
        });
    }, [profiles, search, statusFilter]);

    const statusTabs: { id: StatusFilter; label: string }[] = [
        { id: "all", label: "All" },
        { id: "active", label: "Active" },
        { id: "inactive", label: "Inactive" },
    ];

    return (
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background shrink-0">
                <div className="relative flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search profiles..."
                        className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring"
                        aria-label="Search candidate profiles"
                    />
                </div>

                <div className="flex items-center rounded-md border border-border overflow-hidden">
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStatusFilter(tab.id)}
                            className={`h-9 px-3.5 text-xs font-medium transition-colors cursor-pointer ${
                                statusFilter === tab.id
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground hover:bg-accent"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {isAdmin && onProfileCreated && (
                    <NewProfileDialog
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
                            Try adjusting your search or filter.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((profile) => (
                            <button
                                key={profile.id}
                                type="button"
                                onClick={() => onSelectProfile(profile.id)}
                                className="group w-full rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info text-sm font-semibold text-primary-foreground select-none">
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
                                            <span
                                                className={`rounded-md px-2 py-0.5 text-meta font-medium ${
                                                    profile.isActive
                                                        ? "bg-success text-success-foreground"
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {profile.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </span>
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
                                            {profile.location ||
                                                "Location not set"}
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-medium text-foreground">
                                        {formatRate(profile)}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
