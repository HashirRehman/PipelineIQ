import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UnauthenticatedHomeRedirect } from "@/components/unauthenticated-home-redirect";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Could be a plain unauthenticated visit, or a stray auth-redirect
    // fragment landing here (see UnauthenticatedHomeRedirect) — only the
    // browser can tell those apart, so the decision happens client-side.
    return <UnauthenticatedHomeRedirect />;
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (isAdmin) {
    redirect("/admin/users");
  }

  const { error } = await searchParams;

  return (
    <AppShell isAdmin={false} userEmail={user.email ?? ""}>
      <div className="mx-auto max-w-sm p-8">
        {error === "not_authorized" && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-700"
          >
            You don&apos;t have access to that page.
          </p>
        )}
        <p className="text-sm text-gray-600">
          No screens are available for your role yet.
        </p>
      </div>
    </AppShell>
  );
}
