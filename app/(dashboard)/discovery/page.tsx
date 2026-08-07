import type { Metadata } from "next";
import DiscoveryTab from "./discovery-tab";

export const metadata: Metadata = {
  title: "Discovery",
};

export default function DiscoveryPage() {
  return <DiscoveryTab />;
}
