import type { Metadata } from "next";
import AppliedJobsTab from "./applied-jobs-tab";

export const metadata: Metadata = {
  title: "Applied Jobs — PipelineIQ",
};

export default function AppliedJobsPage() {
  return <AppliedJobsTab />;
}