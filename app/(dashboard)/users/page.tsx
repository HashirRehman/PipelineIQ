import type { Metadata } from "next";
import UsersTab from "./users-tab";

export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage() {
  return <UsersTab />;
}
