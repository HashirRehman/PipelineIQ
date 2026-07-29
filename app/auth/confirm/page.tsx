"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
