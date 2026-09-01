import { requireAuth } from "@/lib/auth";

const TYPES = [
  "Mutual Fund",
  "Stocks",
  "FD",
  "RD",
  "Gold",
  "Crypto",
  "PPF",
  "NPS",
  "Bonds",
  "Bank RD Plan",
  "Other",
] as const;

type InvestmentInput = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function parseInvestment(input: InvestmentInput, partial = false) {
  const values: Record<string, any> = {};

  if (!partial || input.category !== undefined) {
    const category = text(input.category) || "Market-Linked";
    if (!["Market-Linked", "Fixed-Tenure"].includes(category)) throw new Error("Invalid category.");
    values.category = category;
  }

  const category = values.category ?? (input.category !== undefined ? text(input.category) : undefined);

  if (!partial || input.type !== undefined) {
    const type = text(input.type);
    if (!TYPES.includes(type as (typeof TYPES)[number])) throw new Error("Choose a valid investment type.");
    values.type = type;
  }

  if (input.name !== undefined || !partial) values.name = text(input.name) || undefined;
  if (input.note !== undefined || !partial) values.note = text(input.note) || undefined;

  if (!partial || input.date !== undefined) {
    const isFixedTenure = category === "Fixed-Tenure";
    const dateStr = text(input.date) || (isFixedTenure ? text(input.startDate) : "");
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
    values.date = date;
  }

  // Handle amount fields
  if (!partial || input.amountInvested !== undefined) {
    if (input.amountInvested !== undefined && input.amountInvested !== null) {
      const val = Number(input.amountInvested);
      if (!Number.isFinite(val) || val < 0) throw new Error("Amount invested must be valid.");
      values.amountInvested = val;
    }
  }

  if (!partial || input.currentValue !== undefined) {
    if (input.currentValue !== undefined && input.currentValue !== null) {
      const val = Number(input.currentValue);
      if (!Number.isFinite(val) || val < 0) throw new Error("Current value must be valid.");
      values.currentValue = val;
    }
  }

  const isFixedTenure = category === "Fixed-Tenure";

  if (!partial || input.investmentMode !== undefined) {
    if (isFixedTenure || input.investmentMode !== undefined) {
      const mode = text(input.investmentMode);
      if (mode && !["Lumpsum", "Recurring"].includes(mode)) throw new Error("Invalid investment mode.");
      values.investmentMode = mode || undefined;
    }
  }

  const mode = values.investmentMode ?? input.investmentMode;

  if (!partial || input.institution !== undefined) {
    if (isFixedTenure && !partial) {
      const inst = text(input.institution);
      if (!inst) throw new Error("Institution is required.");
      values.institution = inst;
    } else if (input.institution !== undefined) {
      values.institution = text(input.institution) || undefined;
    }
  }

  if (input.planName !== undefined || !partial) values.planName = text(input.planName) || undefined;
  if (input.accountOrPolicyNumber !== undefined || !partial)
    values.accountOrPolicyNumber = text(input.accountOrPolicyNumber) || undefined;

  if (input.bankAccount !== undefined) {
    const val = text(input.bankAccount);
    values.bankAccount = val && val !== "none" ? val : null;
  }

  if (input.expenseRef !== undefined) {
    values.expenseRef = input.expenseRef ? String(input.expenseRef) : null;
  }

  if (!partial || input.principalAmount !== undefined) {
    if (isFixedTenure && mode === "Lumpsum" && !partial) {
      const val = Number(input.principalAmount);
      if (!Number.isFinite(val) || val <= 0) throw new Error("Principal amount must be positive.");
      values.principalAmount = val;
    } else if (input.principalAmount !== undefined) {
      values.principalAmount = input.principalAmount !== null ? Number(input.principalAmount) : 0;
    }
  }

  if (!partial || input.installmentAmount !== undefined) {
    if (isFixedTenure && mode === "Recurring" && !partial) {
      const val = Number(input.installmentAmount);
      if (!Number.isFinite(val) || val <= 0) throw new Error("Installment amount must be positive.");
      values.installmentAmount = val;
    } else if (input.installmentAmount !== undefined) {
      values.installmentAmount = input.installmentAmount !== null ? Number(input.installmentAmount) : undefined;
    }
  }

  if (!partial || input.installmentFrequency !== undefined) {
    if (isFixedTenure && mode === "Recurring" && !partial) {
      const freq = text(input.installmentFrequency) || "Monthly";
      if (!["Monthly", "Quarterly"].includes(freq)) throw new Error("Invalid installment frequency.");
      values.installmentFrequency = freq;
    } else if (input.installmentFrequency !== undefined) {
      values.installmentFrequency = input.installmentFrequency ? text(input.installmentFrequency) : undefined;
    }
  }

  if (!partial || input.interestRate !== undefined) {
    if (isFixedTenure && !partial) {
      const rate = Number(input.interestRate);
      if (!Number.isFinite(rate) || rate < 0) throw new Error("Interest rate must be non-negative.");
      values.interestRate = rate;
    } else if (input.interestRate !== undefined) {
      values.interestRate = input.interestRate !== null ? Number(input.interestRate) : undefined;
    }
  }

  if (!partial || input.compoundingFrequency !== undefined) {
    const freq = text(input.compoundingFrequency) || "Quarterly";
    if (freq && !["Monthly", "Quarterly", "Half-Yearly", "Annually", "At Maturity"].includes(freq)) {
      throw new Error("Invalid compounding frequency.");
    }
    values.compoundingFrequency = freq;
  }

  if (!partial || input.startDate !== undefined) {
    if (isFixedTenure && !partial) {
      const date = new Date(text(input.startDate));
      if (Number.isNaN(date.getTime())) throw new Error("A valid start date is required.");
      values.startDate = date;
    } else if (input.startDate !== undefined) {
      values.startDate = input.startDate ? new Date(text(input.startDate)) : undefined;
    }
  }

  if (!partial || input.tenureValue !== undefined) {
    if (isFixedTenure && !partial) {
      const val = Number(input.tenureValue);
      if (!Number.isFinite(val) || val <= 0) throw new Error("Tenure value must be positive.");
      values.tenureValue = val;
    } else if (input.tenureValue !== undefined) {
      values.tenureValue = input.tenureValue !== null ? Number(input.tenureValue) : undefined;
    }
  }

  if (!partial || input.tenureUnit !== undefined) {
    if (isFixedTenure && !partial) {
      const unit = text(input.tenureUnit);
      if (!["Months", "Years"].includes(unit)) throw new Error("Invalid tenure unit.");
      values.tenureUnit = unit;
    } else if (input.tenureUnit !== undefined) {
      values.tenureUnit = input.tenureUnit ? text(input.tenureUnit) : undefined;
    }
  }

  if (input.maturityDate !== undefined) {
    values.maturityDate = input.maturityDate ? new Date(text(input.maturityDate)) : undefined;
  }
  if (input.expectedMaturityAmount !== undefined) {
    values.expectedMaturityAmount = input.expectedMaturityAmount !== null ? Number(input.expectedMaturityAmount) : undefined;
  }

  if (input.status !== undefined) {
    const status = text(input.status);
    if (status && !["Active", "Matured", "Closed Prematurely"].includes(status)) {
      throw new Error("Invalid status.");
    }
    values.status = status || undefined;
  }
  if (input.actualMaturityAmount !== undefined) {
    values.actualMaturityAmount = input.actualMaturityAmount !== null ? Number(input.actualMaturityAmount) : undefined;
  }
  if (input.actualClosureDate !== undefined) {
    values.actualClosureDate = input.actualClosureDate ? new Date(text(input.actualClosureDate)) : undefined;
  }

  return values;
}

export function serializeInvestment(item: any, countsMap?: Map<string, { total: number; paid: number }>): any {
  const counts = countsMap?.get(item._id.toString()) || { total: 0, paid: 0 };
  return {
    id: item._id.toString(),
    type: item.type,
    name: item.name,
    amountInvested: item.amountInvested,
    currentValue: item.currentValue ?? item.amountInvested,
    date: item.date.toISOString(),
    note: item.note,

    category: item.category ?? "Market-Linked",
    investmentMode: item.investmentMode,
    institution: item.institution,
    planName: item.planName,
    accountOrPolicyNumber: item.accountOrPolicyNumber,
    bankAccount: item.bankAccount?.toString() || null,
    expenseRef: item.expenseRef?.toString() || null,
    principalAmount: item.principalAmount,
    installmentAmount: item.installmentAmount,
    installmentFrequency: item.installmentFrequency,
    interestRate: item.interestRate,
    compoundingFrequency: item.compoundingFrequency,
    startDate: item.startDate ? item.startDate.toISOString() : undefined,
    tenureValue: item.tenureValue,
    tenureUnit: item.tenureUnit,
    maturityDate: item.maturityDate ? item.maturityDate.toISOString() : undefined,
    expectedMaturityAmount: item.expectedMaturityAmount,
    status: item.status ?? "Active",
    actualMaturityAmount: item.actualMaturityAmount,
    actualClosureDate: item.actualClosureDate ? item.actualClosureDate.toISOString() : undefined,
    
    totalInstallments: counts.total,
    paidInstallments: counts.paid,
  };
}


export async function getUserId() {
  const session = await requireAuth();
  if (typeof session.userId !== "string") throw new Error("Unauthorized");
  return session.userId;
}
