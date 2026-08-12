import type { Metadata } from "next";
import { Suspense } from "react";
import SettingsTab from "./settings-tab";

export const metadata: Metadata = {
  title: "Settings — PipelineIQ",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading settings...</div>}>
      <SettingsTab />
    </Suspense>
  );
}
