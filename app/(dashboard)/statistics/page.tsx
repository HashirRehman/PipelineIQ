import type { Metadata } from "next";
import StatisticsTab from "./statistics-tab";

export const metadata: Metadata = {
  title: "Statistics",
};

export default function StatisticsPage() {
  return <StatisticsTab />;
}
