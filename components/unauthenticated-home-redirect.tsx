"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
