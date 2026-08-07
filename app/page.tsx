"use client";
import { useState } from "react";
import Sidebar from "@/components/page-components/Sidebar";
import ProfilesTab from "@/components/page-components/ProfilesTab";
import DiscoveryTab from "@/components/page-components/DiscoveryTab";
import LeadsTab from "@/components/page-components/LeadsTab";
import UsersTab from "@/components/page-components/UsersTab";
import StatisticsTab from "@/components/page-components/StatisticsTab";

export type TabId = "profiles" | "discovery" | "leads" | "users" | "statistics";
export type UserRole = "admin" | "lead" | "bd";
export type ProfileStatus = "active" | "inactive" | "archived";

export interface Resume {
  id: string;
  filename: string;
  size: string;
  uploadedAt: string;
  parsed: {
    skills: string[];
    experience: string[];
    education: string[];
    summary: string;
  };
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  seniority: string;
  yearsExp: number;
  rate: number;
  rateCurrency: string;
  summary: string;
  skills: string[];
  status: ProfileStatus;
  assignedBDs: string[];
  resumes: Resume[];
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  role: UserRole;
  status: "active" | "inactive";
  joinedAt: string;
}

export const CURRENT_USER: AppUser = {
  id: "u1",
  name: "Alex Rivera",
  email: "alex@recursolabs.com",
  roleId: null,
  role: "admin",
  status: "active",
  joinedAt: "2024-01-15",
};

export const APP_USERS: AppUser[] = [
  {
    id: "u1",
    name: "Alex Rivera",
    email: "alex@recursolabs.com",
    roleId: null,
    role: "admin",
    status: "active",
    joinedAt: "2024-01-15",
  },
  {
    id: "u2",
    name: "Jamie Park",
    email: "jamie@recursolabs.com",
    roleId: null,
    role: "bd",
    status: "active",
    joinedAt: "2024-03-22",
  },
  {
    id: "u3",
    name: "Morgan Lee",
    email: "morgan@recursolabs.com",
    roleId: null,
    role: "bd",
    status: "active",
    joinedAt: "2024-06-10",
  },
  {
    id: "u4",
    name: "Casey Torres",
    email: "casey@recursolabs.com",
    roleId: null,
    role: "lead",
    status: "active",
    joinedAt: "2024-07-01",
  },
  {
    id: "u5",
    name: "Dana Shah",
    email: "dana@recursolabs.com",
    roleId: null,
    role: "bd",
    status: "inactive",
    joinedAt: "2024-08-19",
  },
];

export const INITIAL_PROFILES: Profile[] = [
  {
    id: "p1",
    name: "Sarah Chen",
    email: "sarah.chen@email.com",
    phone: "+1 (415) 555-0192",
    location: "San Francisco, CA",
    seniority: "Senior",
    yearsExp: 7,
    rate: 120,
    rateCurrency: "USD",
    summary:
      "Senior frontend engineer specializing in React and TypeScript with 7 years building scalable web applications for fintech and SaaS companies. Strong track record in performance optimization and component architecture.",
    skills: [
      "React",
      "TypeScript",
      "Next.js",
      "GraphQL",
      "Tailwind CSS",
      "AWS",
      "Figma",
    ],
    status: "active",
    assignedBDs: ["u2"],
    resumes: [],
    createdAt: "2025-11-20",
  },
  {
    id: "p2",
    name: "Marcus Webb",
    email: "marcus.webb@email.com",
    phone: "+1 (212) 555-0847",
    location: "New York, NY",
    seniority: "Lead",
    yearsExp: 10,
    rate: 150,
    rateCurrency: "USD",
    summary:
      "Full-stack lead engineer with a decade of experience architecting distributed systems and leading engineering teams at Series B+ startups. Expert in microservices and cloud infrastructure.",
    skills: [
      "Node.js",
      "React",
      "PostgreSQL",
      "Docker",
      "Kubernetes",
      "Go",
      "Redis",
    ],
    status: "active",
    assignedBDs: ["u2", "u3"],
    resumes: [],
    createdAt: "2025-11-18",
  },
  {
    id: "p3",
    name: "Priya Nair",
    email: "priya.nair@email.com",
    phone: "+44 7911 555019",
    location: "London, UK",
    seniority: "Mid",
    yearsExp: 4,
    rate: 90,
    rateCurrency: "GBP",
    summary:
      "Backend engineer focused on Python microservices and data pipelines. Strong background in ML infrastructure and real-time data processing with Kafka and Spark.",
    skills: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "Redis",
      "Kafka",
      "TensorFlow",
      "Docker",
    ],
    status: "active",
    assignedBDs: ["u3"],
    resumes: [],
    createdAt: "2025-12-02",
  },
  {
    id: "p4",
    name: "Jordan Kim",
    email: "jordan.kim@email.com",
    phone: "+1 (206) 555-0334",
    location: "Seattle, WA",
    seniority: "Principal",
    yearsExp: 14,
    rate: 200,
    rateCurrency: "USD",
    summary:
      "Principal engineer and architect with extensive experience in cloud-native systems, platform engineering, and developer tooling at large-scale tech companies.",
    skills: [
      "Rust",
      "Go",
      "Kubernetes",
      "Terraform",
      "AWS",
      "Architecture",
      "Platform",
    ],
    status: "inactive",
    assignedBDs: [],
    resumes: [],
    createdAt: "2025-10-30",
  },
  {
    id: "p5",
    name: "Nia Okonkwo",
    email: "nia.okonkwo@email.com",
    phone: "+1 (773) 555-0621",
    location: "Chicago, IL",
    seniority: "Senior",
    yearsExp: 6,
    rate: 115,
    rateCurrency: "USD",
    summary:
      "Mobile-first product engineer with deep expertise in React Native and iOS development. Led cross-functional teams to ship consumer apps with 2M+ users.",
    skills: ["React Native", "iOS", "Swift", "TypeScript", "Firebase", "CI/CD"],
    status: "active",
    assignedBDs: ["u2"],
    resumes: [],
    createdAt: "2025-12-10",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("profiles");
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);

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
          <ProfilesTab
            profiles={profiles}
            setProfiles={setProfiles}
            users={APP_USERS}
          />
        )}
        {activeTab === "discovery" && <DiscoveryTab />}
        {activeTab === "leads" && (
          <LeadsTab
            users={APP_USERS}
            currentUser={CURRENT_USER}
            profiles={profiles}
          />
        )}
        {activeTab === "users" && <UsersTab currentUser={CURRENT_USER} />}
        {activeTab === "statistics" && (
          <StatisticsTab
            profiles={profiles}
            users={APP_USERS}
            currentUser={CURRENT_USER}
          />
        )}
      </main>
    </div>
  );
}
