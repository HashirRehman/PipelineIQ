import type { Metadata } from "next";
import ActivityTab from "./activity-tab";

export const metadata: Metadata = {
  title: "Activity",
};

// Every role reaches this page — there is no canX gate to redirect on. RLS
// (user_activities_select) is what scopes the DATA: Admin/BD Manager see the
// org's whole feed, everyone else sees only their own actions.
export default function ActivityPage() {
  return <ActivityTab />;
}
