"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { setProfileAssignmentRequest } from "@/lib/api/profiles-client";
import type { AssignableUser } from "@/app/api/profiles/route";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

const UNASSIGNED = "__unassigned__";

export function ProfileAssignment({
  profileId,
  assignedUserId,
  assignedUserName,
  users,
  canManage,
  onChanged,
}: {
  profileId: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  users: AssignableUser[];
  canManage: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const drawerContentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    drawerContentRef.current =
      rootRef.current?.closest('[data-slot="drawer-content"]') ?? null;
  }, []);

  const [displayUserId, setDisplayUserId] = useState<string | null>(
    assignedUserId,
  );
  const [prevAssignedUserId, setPrevAssignedUserId] = useState(assignedUserId);

  if (!isPending && assignedUserId !== prevAssignedUserId) {
    setPrevAssignedUserId(assignedUserId);
    setDisplayUserId(assignedUserId);
  }

  const handleValueChange = async (value: string | null) => {
    if (isPending) return;

    const next = value === UNASSIGNED || value === null ? null : value;
    if (next === displayUserId) return;

    setError(null);
    setIsPending(true);
    setDisplayUserId(next);

    const result = await setProfileAssignmentRequest(profileId, next);
    setIsPending(false);

    if (!result.success) {
      setDisplayUserId(assignedUserId);
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  };

  if (!canManage) {
    return (
      <p className="text-sm text-foreground">
        {assignedUserName ?? "Unassigned"}
      </p>
    );
  }

  const items = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ];

  const currentUser = users.find((u) => u.id === displayUserId);
  const currentLabel = displayUserId ? currentUser?.name : "Unassigned";
  const currentEmail = displayUserId
    ? currentUser?.email
    : "No one owns this profile yet";

  return (
    <div className="flex flex-col gap-2" ref={rootRef}>
      <ComboboxPrimitive.Root
        items={items}
        value={displayUserId ?? UNASSIGNED}
        autoHighlight
        onValueChange={(value) => handleValueChange(value as string | null)}
      >
        <ComboboxPrimitive.Trigger
          render={
            <button
              type="button"
              disabled={isPending}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 cursor-pointer disabled:opacity-60",
              )}
            >
              {displayUserId && currentUser ? (
                <Avatar name={currentUser.name} size={28} />
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-bold text-muted-foreground uppercase">
                  —
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {currentLabel}
                </span>
                <span className="block truncate text-meta text-muted-foreground">
                  {currentEmail}
                </span>
              </span>
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          }
        />

        <ComboboxPrimitive.Portal container={drawerContentRef}>
          <ComboboxPrimitive.Positioner
            side="bottom"
            align="start"
            sideOffset={4}
            className="isolate z-50 pointer-events-auto"
          >
            <ComboboxPrimitive.Popup className="relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-48 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-lg">
              <ComboboxPrimitive.Input
                placeholder="Search users…"
                className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 mb-1"
              />
              <ComboboxPrimitive.List className="max-h-60 overflow-y-auto overflow-x-hidden outline-none">
                {(item: { value: string; label: string }) => {
                  const user = users.find((u) => u.id === item.value);
                  const selected = item.value === (displayUserId ?? UNASSIGNED);

                  return (
                    <ComboboxPrimitive.Item
                      key={item.value}
                      value={item.value}
                      className={cn(
                        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground outline-none select-none",
                        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                        "data-disabled:pointer-events-none data-disabled:opacity-50",
                        selected && "bg-primary/5",
                      )}
                    >
                      {user ? (
                        <Avatar name={user.name} size={22} />
                      ) : (
                        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-muted text-micro font-bold text-muted-foreground uppercase">
                          —
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.label}</span>
                        {user && (
                          <span className="truncate text-caption text-muted-foreground">
                            {user.email}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check className="size-3.5 shrink-0 text-primary" strokeWidth={3} />
                      )}
                    </ComboboxPrimitive.Item>
                  );
                }}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}