import type { Metadata } from "next";
import SettingsTab from "./settings-tab";

export const metadata: Metadata = {
  title: "Theme",
};

export default function SettingsPage() {
  return <SettingsTab />;
}
