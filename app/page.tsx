"use client";
import { useState } from "react";
import Sidebar from "@/components/page-components/Sidebar";
import ProfilesTab from "@/components/page-components/ProfilesTab";
import DiscoveryTab from "@/components/page-components/DiscoveryTab";
import LeadsTab from "@/components/page-components/LeadsTab";
import UsersTab from "@/components/page-components/UsersTab";
import StatisticsTab from "@/components/page-components/StatisticsTab";

export type TabId = "profiles" | "discovery" | "leads" | "users" | "statistics";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("profiles");

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {activeTab === "profiles" && (
          <ProfilesTab />
        )}
        {activeTab === "discovery" && <DiscoveryTab />}
        {activeTab === "leads" && <LeadsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "statistics" && <StatisticsTab />}
      </main>
    </div>
  );
}
