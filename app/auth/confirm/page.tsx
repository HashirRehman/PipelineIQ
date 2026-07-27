"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Using Supabase's default (uncustomized) email templates — this
// project's tier doesn't allow template customization without custom SMTP
// or a paid plan. The default templates' links point at GoTrue's own
// hosted verify endpoint, which redirects back here with the session in
// the URL *fragment* (never reaches a server), so this has to be a
// client-side page reading window.location.hash and calling
// supabase.auth.setSession() in the browser — not a Route Handler reading
// query params. Handles both invite and recovery links: neither branches
// on the `type` fragment param, since both flows land the user on
// /set-password with the same need — a fresh token-derived session, set
// a (new) password.
export default function ConfirmAuthPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[confirm] mounted, hash present:", Boolean(window.location.hash));

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);

    const hashError = params.get("error_description") ?? params.get("error");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    console.log("[confirm] parsed fragment:", {
      hashError,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
    });

    if (hashError || !accessToken || !refreshToken) {
      console.log("[confirm] missing/invalid tokens, redirecting to /login");
      router.replace("/login?error=auth_link_invalid");
      return;
    }

    const supabase = createClient();

    console.log("[confirm] calling setSession()...");
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: setSessionError }) => {
        console.log("[confirm] setSession() resolved, error:", setSessionError);
        if (setSessionError) {
          setError("Your link has expired or already been used.");
          return;
        }
        router.replace("/set-password");
      })
      .catch((caughtError) => {
        console.error("[confirm] setSession() threw:", caughtError);
        setError("Something went wrong confirming your link. Please try again.");
      });
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto max-w-sm p-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-8">
      <p className="text-sm text-gray-600">Confirming your link…</p>
    </div>
  );
}
