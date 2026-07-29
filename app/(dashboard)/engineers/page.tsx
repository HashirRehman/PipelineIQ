import Link from "next/link";
import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export default async function EngineersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();

  const isAdmin = await getCachedIsAdmin();
  const { error } = await searchParams;

  // Same query for both roles — the difference in results comes entirely
  // from the engineers_select RLS policy (is_admin() OR id IN
  // assigned_engineer_ids()), not from any role branching here.
  const { data: engineers } = await supabase
    .from("engineers")
    .select("id, full_name, email, location, is_active, seniority_levels(name)")
    .order("full_name");

  const list = engineers ?? [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      {error === "not_authorized" && (
        <p
          role="alert"
          className="mb-6 rounded border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          You don&apos;t have access to that page.
        </p>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Engineers</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "All engineers in the roster."
              : "Engineers currently assigned to you."}
          </p>
        </div>
        {isAdmin && (
          <Button render={<Link href="/engineers/new" />}>New engineer</Button>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "No engineers yet."
              : "No engineers are currently assigned to you. Contact an Admin to get started."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Seniority</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((engineer) => (
                <tr key={engineer.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/engineers/${engineer.id}`}
                      className="font-medium hover:underline"
                    >
                      {engineer.full_name}
                    </Link>
                    <div className="text-muted-foreground">{engineer.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {engineer.seniority_levels?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">{engineer.location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={engineer.is_active ? "success" : "neutral"}>
                      {engineer.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
