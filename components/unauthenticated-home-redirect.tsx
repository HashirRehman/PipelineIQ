"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rendered by app/page.tsx only when there's no session. Two cases land
// here, and only the browser can tell them apart (fragments never reach
// the server):
//   1. A plain unauthenticated visit to "/" — should go to /login.
//   2. An auth email redirect landing here because it couldn't carry a
//      custom redirectTo (e.g. a recovery email sent from the Supabase
//      Dashboard) and fell back to the bare Site URL config — the session
//      tokens are in the URL *fragment*, which has to be forwarded to
//      /auth/confirm to be handled.
export function UnauthenticatedHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") || hash.includes("error")) {
      router.replace(`/auth/confirm${hash}`);
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
