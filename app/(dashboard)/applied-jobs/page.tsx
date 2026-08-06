import type { Metadata } from "next";
import AppliedJobsTab from "./applied-jobs-tab";

export const metadata: Metadata = {
  title: "Applied Jobs",
};

export default function AppliedJobsPage() {
  return <AppliedJobsTab />;
}