import type { Metadata } from "next";
import SettingsTab from "./settings-tab";

export const metadata: Metadata = {
  title: "Theme — PipelineIQ",
};

export default function SettingsPage() {
  return <SettingsTab />;
}
