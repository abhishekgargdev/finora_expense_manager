import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateContent, extractJsonObject } from "@/lib/gemini";

const VALUATION_SYSTEM_PROMPT = `You are a professional Financial & Investment Analyst AI.
Your task is to analyze a Market-Linked investment (such as a Mutual Fund, Stock, ETF, Gold, or Crypto) based on its asset name, asset category/type, purchase date, and amount invested.

You MUST respond strictly with a valid JSON object matching this exact TypeScript interface structure:
{
  "estimatedCurrentValue": number,
  "estimatedReturnPercentage": number,
  "estimatedGain": number,
  "recommendation": "CONTINUE" | "STOP" | "MONITOR",
  "recommendationLabel": string,
  "confidence": "High" | "Medium" | "Low",
  "summary": string,
  "detailedAnalysis": string
}

Guidelines for Valuation & Recommendation:
1. **Current Valuation**: Estimate realistic current value (in ₹) using typical historical market CAGR, category benchmarks, and sector performance for the named fund/stock/asset over the given holding period (or 1 year if date unavailable).
2. **Growth Percentage**: Calculate return % = ((estimatedCurrentValue - amountInvested) / amountInvested) * 100.
3. **Recommendation Criteria**:
   - "CONTINUE": Strong fundamental funds, low/mid-cost index funds, high-growth equity with solid upside. Label: "Continue Investment (Hold / SIP)".
   - "STOP": Persistent laggards, highly speculative/decaying assets, high expense ratio traps. Label: "Consider Stopping / Exiting".
   - "MONITOR": Highly volatile assets (e.g. crypto, sectoral funds) needing close tracking. Label: "Monitor Closely".
4. **Summary & Rationale**: Provide concise 1-2 sentence summary and clean markdown analysis with clear bullet points.
5. Return ONLY raw valid JSON (no markdown block formatting if possible).`;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || typeof session.userId !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "Mutual Fund";
    const amountInvested = Number(body.amountInvested);
    const dateStr = typeof body.date === "string" ? body.date : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Asset/Fund Name is required for AI analysis." }, { status: 400 });
    }
    if (!Number.isFinite(amountInvested) || amountInvested <= 0) {
      return NextResponse.json({ error: "A valid positive investment amount is required." }, { status: 400 });
    }

    const userPrompt = `Analyze and value the following investment:
- Asset / Fund Name: "${name}"
- Asset Type: "${type}"
- Amount Invested: ₹${amountInvested.toLocaleString()}
- Purchase / Start Date: ${dateStr ? dateStr.slice(0, 10) : "Not specified (assume ~1 year holding)"}
${note ? `- Additional User Notes: "${note}"` : ""}

Estimate current market value, growth %, gain/loss, and recommend whether to CONTINUE, STOP, or MONITOR this holding. Return raw valid JSON.`;

    const rawResult = await generateContent(userPrompt, {
      systemPrompt: VALUATION_SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 2048,
      jsonMode: true,
    });

    const parsedValuation = extractJsonObject(rawResult);

    // Sanitize numeric outputs
    const estimatedCurrentValue = Math.round(Number(parsedValuation.estimatedCurrentValue) || amountInvested);
    const estimatedGain = estimatedCurrentValue - amountInvested;
    const estimatedReturnPercentage = Number(
      parsedValuation.estimatedReturnPercentage !== undefined
        ? Number(parsedValuation.estimatedReturnPercentage).toFixed(2)
        : ((estimatedGain / amountInvested) * 100).toFixed(2)
    );

    const rec = ["CONTINUE", "STOP", "MONITOR"].includes(parsedValuation.recommendation)
      ? parsedValuation.recommendation
      : "CONTINUE";

    const valuation = {
      estimatedCurrentValue,
      estimatedReturnPercentage,
      estimatedGain,
      recommendation: rec,
      recommendationLabel: parsedValuation.recommendationLabel || (rec === "CONTINUE" ? "Continue Investment (Hold / SIP)" : rec === "STOP" ? "Consider Stopping / Exiting" : "Monitor Closely"),
      confidence: parsedValuation.confidence || "Medium",
      summary: parsedValuation.summary || `Estimated value of ₹${estimatedCurrentValue.toLocaleString()} based on market benchmarks.`,
      detailedAnalysis: parsedValuation.detailedAnalysis || "Market evaluation based on fund performance and category benchmarks.",
    };

    return NextResponse.json({ valuation });
  } catch (error) {
    console.error("AI Valuation API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate AI market valuation." },
      { status: 500 }
    );
  }
}
