import { Metadata } from "next";
import AIAdvisorClient from "@/components/finance/AIAdvisorClient";

export const metadata: Metadata = {
  title: "AI Advisor - Finora",
  description: "Receive personalized financial analysis, spend audit, and investment advisory powered by Gemini AI.",
};

export default function AIAdvisorPage() {
  return <AIAdvisorClient />;
}
