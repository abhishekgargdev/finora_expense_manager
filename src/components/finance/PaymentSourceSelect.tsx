"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type PaymentAccountOption,
  type PaymentSourceValue,
  paymentSourceLabel,
} from "@/lib/payment-source";

type Props = {
  value: PaymentSourceValue;
  onValueChange: (value: PaymentSourceValue) => void;
  bankAccounts: PaymentAccountOption[];
  creditCards: PaymentAccountOption[];
  label?: string;
  placeholder?: string;
  id?: string;
};

export default function PaymentSourceSelect({
  value,
  onValueChange,
  bankAccounts,
  creditCards,
  label = "Payment source",
  placeholder = "Choose bank account or credit card",
  id,
}: Props) {
  const displayLabel = paymentSourceLabel(value, bankAccounts, creditCards);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || "none"}
        onValueChange={(next) => onValueChange(next === "none" ? "" : (next as PaymentSourceValue))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder}>{displayLabel || undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{placeholder}</SelectItem>
          {bankAccounts.length > 0 && (
            <SelectGroup>
              <SelectLabel>Bank accounts</SelectLabel>
              {bankAccounts.map((account) => (
                <SelectItem key={account.id} value={`bank:${account.id}`}>
                  {account.name}
                  {account.last4Digits ? ` · ${account.last4Digits}` : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {creditCards.length > 0 && (
            <SelectGroup>
              <SelectLabel>Credit cards</SelectLabel>
              {creditCards.map((card) => (
                <SelectItem key={card.id} value={`credit:${card.id}`}>
                  {card.name}
                  {card.last4Digits ? ` · ${card.last4Digits}` : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
