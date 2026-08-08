import type { Metadata } from "next";
import DiscoveryTab from "./discovery-tab";

export const metadata: Metadata = {
  title: "Discovery — PipelineIQ",
};

export default function DiscoveryPage() {
  return <DiscoveryTab />;
}
