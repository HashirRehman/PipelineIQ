import type { Metadata } from "next";
import LeadsTab from "./leads-tab";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return <LeadsTab />;
}
