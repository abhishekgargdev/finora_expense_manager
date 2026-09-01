import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
import { getSession } from "@/lib/auth";
import { generateContent, extractJsonObject } from "@/lib/gemini";

const PORTFOLIO_AUDIT_SYSTEM_PROMPT = `You are a Senior Investment Portfolio Analyst & Wealth Advisor AI.
Your task is to analyze an entire user's investment portfolio (comprising Market-Linked assets like Mutual Funds/Stocks and Fixed-Tenure assets like FDs/RDs/PPF).

You MUST return strictly a valid JSON object matching this exact TypeScript structure:
{
  "healthScore": number,                   // Overall Portfolio Health Score out of 100 (e.g. 85)
  "netReturnPercentage": number,          // Combined portfolio growth return percentage
  "portfolioSummary": string,             // 2-3 sentence executive summary of current wealth strategy
  "diversificationRating": "Excellent" | "Well Balanced" | "Moderate Risk" | "Overly Concentrated",
  "topActionables": string[],             // Array of 3-4 immediate strategic advice items
  "holdingRecommendations": [             // Array of recommendations for EACH holding in the user's portfolio
    {
      "id": string,                       // Must match the exact investment ID provided in input
      "name": string,                     // Name/Type of the investment
      "recommendation": "CONTINUE" | "STOP" | "MONITOR",
      "recommendationLabel": string,      // Short badge e.g. "Continue (Hold / SIP)" or "Consider Exiting"
      "estimatedCurrentValue": number,   // Updated estimated current value in ₹
      "rationale": string                 // Concise 1-2 sentence justification for the advice
    }
  ]
}

Guidelines for Analysis:
1. Health Score (0-100): Reward low-cost diversification, steady SIP habits, and risk-adjusted growth. Penalize poor category concentration, speculative hype, or high expense ratios.
2. Individual Holdings: Provide an explicit recommendation (CONTINUE, STOP, or MONITOR) for every single investment holding in the input array.
3. Return raw valid JSON without markdown block formatting.`;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || typeof session.userId !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    await connect();

    // Fetch user investments and contributions
    const investments = await InvestmentModel.find({ user: userId }).lean();
    if (!investments.length) {
      return NextResponse.json(
        { error: "No investment holdings found. Please add investments to run a portfolio audit." },
        { status: 400 }
      );
    }

    const contributions = await InvestmentContributionModel.find({ user: userId }).lean();

    // Map contributions by investment
    const contribMap: Record<string, { total: number; paid: number; paidAmount: number }> = {};
    contributions.forEach((c) => {
      const invId = c.investment.toString();
      if (!contribMap[invId]) {
        contribMap[invId] = { total: 0, paid: 0, paidAmount: 0 };
      }
      contribMap[invId].total++;
      if (c.status === "Paid") {
        contribMap[invId].paid++;
        contribMap[invId].paidAmount += c.amount || 0;
      }
    });

    // Compile portfolio payload
    let totalInvested = 0;
    let totalCurrentValue = 0;

    const holdingsData = investments.map((inv: any) => {
      const invId = inv._id.toString();
      const amountInvested = Number(inv.amountInvested) || Number(inv.principalAmount) || 0;
      const currentValue = Number(inv.currentValue) || amountInvested;
      totalInvested += amountInvested;
      totalCurrentValue += currentValue;

      const cData = contribMap[invId] || { total: 0, paid: 0, paidAmount: 0 };

      return {
        id: invId,
        name: inv.name || inv.planName || inv.type || "Investment",
        type: inv.type,
        category: inv.category || "Market-Linked",
        investmentMode: inv.investmentMode || "Lumpsum",
        institution: inv.institution || undefined,
        amountInvested,
        currentValue,
        startDate: inv.startDate || inv.date,
        interestRate: inv.interestRate || undefined,
        tenure: inv.tenureValue ? `${inv.tenureValue} ${inv.tenureUnit}` : undefined,
        paidInstallments: `${cData.paid} of ${cData.total}`,
        note: inv.note || undefined,
      };
    });

    const overallGain = totalCurrentValue - totalInvested;
    const overallReturnPercentage = totalInvested > 0 ? Number(((overallGain / totalInvested) * 100).toFixed(2)) : 0;

    const userPrompt = `Perform a comprehensive portfolio audit for the following holdings:

Portfolio Summary:
- Total Holdings: ${holdingsData.length}
- Total Capital Invested: ₹${totalInvested.toLocaleString()}
- Current Total Value: ₹${totalCurrentValue.toLocaleString()}
- Combined Growth: ${overallReturnPercentage}% (₹${overallGain.toLocaleString()})

Holdings JSON:
\`\`\`json
${JSON.stringify(holdingsData, null, 2)}
\`\`\`

Evaluate overall portfolio allocation, calculate Health Score (0-100), top actionables, and provide individual CONTINUE, STOP, or MONITOR recommendations for every holding (using its exact ID). Return raw valid JSON.`;

    const rawResult = await generateContent(userPrompt, {
      systemPrompt: PORTFOLIO_AUDIT_SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 3500,
      jsonMode: true,
    });

    const parsed = extractJsonObject(rawResult);

    const auditResult = {
      healthScore: Math.min(100, Math.max(0, Number(parsed.healthScore) || 80)),
      netReturnPercentage: Number(parsed.netReturnPercentage ?? overallReturnPercentage),
      totalInvested,
      totalCurrentValue,
      portfolioSummary: parsed.portfolioSummary || "Your investment portfolio maintains a steady growth foundation across your holdings.",
      diversificationRating: parsed.diversificationRating || "Well Balanced",
      topActionables: Array.isArray(parsed.topActionables) ? parsed.topActionables : ["Rebalance underperforming funds into index funds.", "Continue regular SIPs in high-performing assets."],
      holdingRecommendations: Array.isArray(parsed.holdingRecommendations) ? parsed.holdingRecommendations : [],
    };

    return NextResponse.json({ audit: auditResult });
  } catch (error) {
    console.error("AI Portfolio Audit Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate AI portfolio audit." },
      { status: 500 }
    );
  }
}
