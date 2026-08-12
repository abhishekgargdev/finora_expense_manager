import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-sheets";

export async function GET() {
  try {
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    const state = Buffer.from(JSON.stringify({ userId: session.userId })).toString("base64url");
    const url = getAuthUrl(state);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Google authorization." },
      { status: 400 }
    );
  }
}
