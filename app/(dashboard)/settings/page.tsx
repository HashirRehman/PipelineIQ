import type { Metadata } from "next";
import { Suspense } from "react";
import SettingsTab from "./settings-tab";
import { getCachedUser, getCachedUserRole } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Settings — PipelineIQ",
};

export default async function SettingsPage() {
  const [user, role] = await Promise.all([
    getCachedUser(),
    getCachedUserRole(),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading settings...</div>}>
      <SettingsTab
        user={{
          email: user?.email ?? "",
          name: user?.user_metadata?.full_name as string | undefined,
          role,
        }}
      />
    </Suspense>
  );
}
