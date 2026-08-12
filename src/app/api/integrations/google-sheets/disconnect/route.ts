import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import GoogleSheetsSyncModel from "@/models/GoogleSheetsSync";

export async function DELETE() {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    await GoogleSheetsSyncModel.findOneAndUpdate(
      { user: session.userId },
      {
        $unset: {
          accessToken: "",
          refreshToken: "",
          tokenExpiry: "",
          connectedEmail: "",
        },
        enabled: false,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect Google account." },
      { status: 400 }
    );
  }
}
