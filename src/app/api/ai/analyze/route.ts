import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFinancialDataForAI } from "@/lib/ai-data-fetcher";
import { generateContent } from "@/lib/gemini";

const DEFAULT_SYSTEM_PROMPT = `You are a highly skilled, professional, and empathetic AI Financial Advisor.
Your goal is to analyze the user's financial profile (incomes, expenses, and investments) and provide deep insights, advice, and constructive criticism.

Address the following aspects in detail:
1. **Financial Health & Spending Habits**: Identify potential mistakes, excessive spending, or warning signs. Evaluate their savings rate (Net Savings / Total Income) and compare it to general healthy benchmarks.
2. **Investment Strategy**: Analyze their current asset allocation (e.g. Mutual Funds, Stocks, FDs, etc.). Recommend opportunities for growth, protection, or diversification.
3. **Actionable Checklist**: Provide a prioritized, bulleted list of 3-5 immediate steps they should take to improve their financial situation.

Guidelines:
- Be encouraging but direct, honest, and precise.
- Ground your advice in the user's actual numbers and percentages.
- Avoid generic platitudes; customize your recommendations to their specific categories, saving trends, and ratio profiles.
- Format your response beautifully in clean, professional Markdown (using bold, bullet points, headers, and emphasis).`;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authentication
    const session = await getSession();
    if (!session || typeof session.userId !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    // 2. Parse request body
    let userMessage = "";
    let includeIncome = true;
    let includeExpenses = true;
    let includeInvestments = true;
    try {
      const body = await request.json();
      userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
      includeIncome = body.includeIncome !== false;
      includeExpenses = body.includeExpenses !== false;
      includeInvestments = body.includeInvestments !== false;
    } catch {
      // Body is optional or empty
    }

    // 3. Fetch User's Financial Data
    const financialData = await getFinancialDataForAI(userId);

    // Filter financialData based on preferences
    const filteredData: Record<string, any> = {
      summary: {
        netSavings: financialData.summary.netSavings,
        savingsRatePercentage: financialData.summary.savingsRatePercentage,
        bankBalance: financialData.summary.bankBalance,
        cashBalance: financialData.summary.cashBalance,
      }
    };

    if (includeIncome) {
      filteredData.summary.totalIncome = financialData.summary.totalIncome;
      filteredData.incomeRecords = financialData.incomeRecords;
    }
    if (includeExpenses) {
      filteredData.summary.totalExpenses = financialData.summary.totalExpenses;
      filteredData.expenseSummary = financialData.expenseSummary;
    }
    if (includeInvestments) {
      filteredData.summary.totalInvested = financialData.summary.totalInvested;
      filteredData.investmentRecords = financialData.investmentRecords;
    }

    // 4. Construct user prompt with context data
    const userPrompt = `Below is my financial data (including incomes, expenses, and investments):

\`\`\`json
${JSON.stringify(filteredData, null, 2)}
\`\`\`

${
  userMessage
    ? `I have this specific question or concern: "${userMessage}"\n\nPlease answer my question/concern, and also integrate it into your general review of my finances.`
    : "Please perform a general review and provide your financial analysis and advisory recommendations."
}`;

    // 5. Query the Gemini API using the service with key rotation
    const analysis = await generateContent(userPrompt, {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 3072, // generous limit for detailed financial analysis
    });

    // 6. Return response
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("AI Analysis Route Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred during AI analysis." },
      { status: 500 }
    );
  }
}
