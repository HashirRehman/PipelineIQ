"use client";

// Client-side response cache. In-memory only, so a refresh starts empty.
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const DEFAULT_STALE_TIME_MS = 60_000;
// Must exceed the stale time, or navigating away and back evicts the entry.
const DEFAULT_GC_TIME_MS = 5 * 60_000;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: false,
        // A 4xx is an answer, not a blip — don't retry it.
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Per-session, not module-level: a shared client would leak cached data
  // between users on the server.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
