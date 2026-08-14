import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFinancialDataForAI } from "@/lib/ai-data-fetcher";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || typeof session.userId !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const financialData = await getFinancialDataForAI(session.userId);
    return NextResponse.json(financialData);
  } catch (error) {
    console.error("AI Data Route Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load financial data." },
      { status: 500 }
    );
  }
}
