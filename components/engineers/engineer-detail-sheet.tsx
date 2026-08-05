"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateEngineer } from "@/lib/actions/engineers";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { EngineerCoreFieldsForm } from "./engineer-core-fields-form";
import { EngineerActiveToggle } from "./engineer-active-toggle";
import { EngineerAssignments } from "./engineer-assignments";
import { EngineerCvList } from "./engineer-cv-list";
import { EngineerCvUploadForm } from "./engineer-cv-upload-form";

type EngineerDetail = {
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
    skillNames: string;
};

type SeniorityLevel = {
    id: string;
    name: string;
};

type Assignment = {
    bdUserId: string;
    fullName: string;
    email: string;
};

type BdCandidate = {
    id: string;
    fullName: string;
    email: string;
};

type CvEntry = {
    id: string;
    label: string;
    fileName: string;
    isCurrent: boolean;
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

function formatRate(engineer: EngineerDetail) {
    if (engineer.rateExpectation === null) {
        return "Rate not set";
    }

    return `${engineer.rateCurrency} ${engineer.rateExpectation}/hr`;
}

function ReadOnlyDetails({ engineer }: { engineer: EngineerDetail }) {
    const fields = [
        ["Full Name", engineer.fullName],
        ["Email", engineer.email],
        ["Phone", engineer.phone || "Not provided"],
        ["Location", engineer.location || "Not provided"],
        ["Seniority Level", engineer.seniority || "Not provided"],
        [
            "Years of Experience",
            engineer.yearsExperience === null
                ? "Not provided"
                : String(engineer.yearsExperience),
        ],
        ["Rate", formatRate(engineer)],
        ["Status", engineer.isActive ? "Active" : "Inactive"],
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
                    {engineer.summary || "No summary provided."}
                </p>
            </div>

            <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground">Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {engineer.skillNames ? (
                        engineer.skillNames.split(",").map((skill) => (
                            <span
                                key={skill.trim()}
                                className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                            >
                                {skill.trim()}
                            </span>
                        ))
                    ) : (
                        <span className="text-sm text-muted-foreground">
                            No skills added.
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}

export function EngineerDetailSheet({
    engineer,
    seniorityLevels,
    assignments,
    bdCandidates,
    cvs,
    isAdmin,
}: {
    engineer: EngineerDetail;
    seniorityLevels: SeniorityLevel[];
    assignments: Assignment[];
    bdCandidates: BdCandidate[];
    cvs: CvEntry[];
    isAdmin: boolean;
}) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);

    return (
        <Sheet
            open
            onOpenChange={(open) => {
                if (!open) {
                    router.replace("/engineers", { scroll: false });
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
                            {getInitials(engineer.fullName)}
                        </div>

                        <div className="min-w-0 flex-1">
                            <SheetTitle className="truncate text-lg font-semibold">
                                {engineer.fullName}
                            </SheetTitle>

                            <SheetDescription className="truncate">
                                {engineer.email}
                            </SheetDescription>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
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

                                <span className="font-mono text-xs text-muted-foreground">
                                    {formatRate(engineer)}
                                </span>
                            </div>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="flex items-center justify-end gap-2 pr-10">
                            <EngineerActiveToggle
                                engineerId={engineer.id}
                                isActive={engineer.isActive}
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
                            <EngineerCoreFieldsForm
                                action={updateEngineer}
                                engineerId={engineer.id}
                                initialValues={{
                                    fullName: engineer.fullName,
                                    email: engineer.email,
                                    phone: engineer.phone ?? "",
                                    location: engineer.location ?? "",
                                    seniorityLevelId: engineer.seniorityLevelId,
                                    yearsExperience:
                                        engineer.yearsExperience?.toString() ?? "",
                                    rateExpectation:
                                        engineer.rateExpectation?.toString() ?? "",
                                    rateCurrency: engineer.rateCurrency,
                                    summary: engineer.summary ?? "",
                                    skillNames: engineer.skillNames,
                                }}
                                seniorityLevels={seniorityLevels}
                                submitLabel="Save changes"
                            />
                        ) : (
                            <ReadOnlyDetails engineer={engineer} />
                        )}
                    </section>

                    <section className="mt-7 border-t border-border pt-6">
                        <h2 className="mb-4 text-sm font-semibold">
                            Assigned Business Developers
                        </h2>

                        <EngineerAssignments
                            engineerId={engineer.id}
                            assignments={assignments}
                            candidates={bdCandidates}
                            isAdmin={isAdmin}
                        />
                    </section>

                    <section className="mt-7 border-t border-border pt-6">
                        <h2 className="mb-4 text-sm font-semibold">CVs</h2>

                        <div className="flex flex-col gap-4">
                            <EngineerCvList cvs={cvs} />

                            {isAdmin && (
                                <EngineerCvUploadForm engineerId={engineer.id} />
                            )}
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}