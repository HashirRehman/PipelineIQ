import type { Metadata } from "next";
import ProfilesTab from "./profiles-tab";

export const metadata: Metadata = {
  title: "Profiles",
};

export default function ProfilesPage() {
  return <ProfilesTab />;
}
