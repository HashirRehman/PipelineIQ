import { NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/server";
import { createBrowserClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "Email is required." },
      { status: 400 }
    );
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  // Re-authenticate with provided credentials
  const browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: sessionData, error: signInError } =
    await browserClient.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {
    console.error("Failed to create session:", signInError);
    return NextResponse.json(
      { error: "Failed to authenticate with provided credentials." },
      { status: 401 }
    );
  }

  if (!sessionData?.session) {
    return NextResponse.json(
      { error: "No session returned from authentication." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    },
  });
}
