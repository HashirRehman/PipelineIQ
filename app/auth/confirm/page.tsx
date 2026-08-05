"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmAuthPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);

    const hashError = params.get("error_description") ?? params.get("error");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (hashError || !accessToken || !refreshToken) {
      router.replace("/login?error=auth_link_invalid");
      return;
    }

    const supabase = createClient();

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: setSessionError }) => {
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
