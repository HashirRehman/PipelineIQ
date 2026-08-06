"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MapPin, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NewEngineerDialog } from "./new-engineer-dialog";

export type EngineerListItem = {
    id: string;
    fullName: string;
    email: string;
    location: string | null;
    isActive: boolean;
    seniority: string | null;
    rateExpectation: number | null;
    rateCurrency: string;
    skills: string[];
    assignedBdNames: string[];
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

function formatRate(engineer: EngineerListItem) {
    if (engineer.rateExpectation === null) {
        return "Rate not set";
    }

    return `${engineer.rateCurrency} ${engineer.rateExpectation}/hr`;
}

export function EngineersList({
    engineers,
    isAdmin,
    seniorityLevels,
    onSelectEngineer,
    onEngineerCreated,
}: {
    engineers: EngineerListItem[];
    isAdmin: boolean;
    seniorityLevels: SeniorityLevel[];
    onSelectEngineer?: (engineerId: string) => void;
    onEngineerCreated?: (engineerId: string) => void;
}) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const filteredEngineers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return engineers.filter((engineer) => {
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && engineer.isActive) ||
                (statusFilter === "inactive" && !engineer.isActive);

            if (!matchesStatus) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const searchableValues = [
                engineer.fullName,
                engineer.email,
                engineer.location ?? "",
                engineer.seniority ?? "",
                ...engineer.skills,
            ];

            return searchableValues.some((value) =>
                value.toLowerCase().includes(normalizedSearch),
            );
        });
    }, [engineers, search, statusFilter]);

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Profiles</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {engineers.length} candidate{" "}
                        {engineers.length === 1 ? "profile" : "profiles"}
                    </p>
                </div>

                {isAdmin && (
                    <NewEngineerDialog
                        seniorityLevels={seniorityLevels}
                        onCreated={onEngineerCreated}
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
                        placeholder="Search by name, skill, location..."
                        className="pl-9"
                        aria-label="Search engineer profiles"
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

            {filteredEngineers.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
                    <UserRound className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No profiles found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Try adjusting your search or status filter.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredEngineers.map((engineer) => (
                        <button
                            key={engineer.id}
                            type="button"
                            onClick={() => {
                                if (onSelectEngineer) {
                                    onSelectEngineer(engineer.id);
                                    return;
                                }

                                router.push(`/engineers?engineerId=${engineer.id}`);
                            }}
                            className="group w-full rounded-xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info-foreground text-sm font-semibold text-primary-foreground">
                                    {getInitials(engineer.fullName)}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-sm font-semibold group-hover:text-primary">
                                        {engineer.fullName}
                                    </h2>

                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {engineer.email}
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <span
                                            className={
                                                engineer.isActive
                                                    ? "rounded-md bg-success px-2 py-0.5 text-[11px] font-medium text-success-foreground"
                                                    : "rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                            }
                                        >
                                            {engineer.isActive ? "Active" : "Inactive"}
                                        </span>

                                        {engineer.seniority && (
                                            <span className="rounded-md bg-info px-2 py-0.5 text-[11px] font-medium text-info-foreground">
                                                {engineer.seniority}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="size-3.5 shrink-0" />
                                <span className="truncate">
                                    {engineer.location || "Location not provided"}
                                </span>
                            </div>

                            <div className="mt-4 flex min-h-12 flex-wrap content-start gap-1.5">
                                {engineer.skills.slice(0, 4).map((skill) => (
                                    <span
                                        key={skill}
                                        className="rounded bg-secondary px-2 py-1 text-[11px] text-secondary-foreground"
                                    >
                                        {skill}
                                    </span>
                                ))}

                                {engineer.skills.length > 4 && (
                                    <span className="rounded bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                                        +{engineer.skills.length - 4}
                                    </span>
                                )}

                                {engineer.skills.length === 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        No skills added
                                    </span>
                                )}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                                <span className="text-sm font-semibold text-primary">
                                    {formatRate(engineer)}
                                </span>

                                <span className="truncate text-right text-xs text-muted-foreground">
                                    {engineer.assignedBdNames.length > 0
                                        ? `→ ${engineer.assignedBdNames.join(", ")}`
                                        : "Unassigned"}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}