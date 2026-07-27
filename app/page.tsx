import { redirect } from "next/navigation";
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

  // /engineers is the shared home for both roles (RLS scopes what each
  // sees) — nothing renders here for a logged-in user, just forward
  // through to it, carrying any error param along (e.g. middleware's
  // not-authorized bounce).
  const { error } = await searchParams;
  redirect(error ? `/engineers?error=${error}` : "/engineers");
}
