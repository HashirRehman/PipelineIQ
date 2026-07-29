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
    return <UnauthenticatedHomeRedirect />;
  }
  const { error } = await searchParams;
  redirect(error ? `/engineers?error=${error}` : "/engineers");
}
