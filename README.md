# Finora Expense Manager

Finora is a premium, modern, glassmorphic personal finance dashboard and expense manager built to help you track your money, cash flow, investments, and debts at a glance.

---

## 🚀 Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router & Server Actions/API)
- **Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/)
- **UI Components**: [@base-ui/react](https://base-ui.com/) & custom tailwind-styled components
- **Styling**: TailwindCSS, CSS Variables, & Glassmorphism
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Formatting**: [Prettier](https://prettier.io/)

---

## ✨ Features

1. **Intelligent Home Route**: Detects authentication states. Unauthenticated users land on the login screen, while authenticated users land on the Dashboard.
2. **Interactive Financial Dashboard**:
   - Monthly and yearly breakdown of Income vs Expenses.
   - Dynamic pie-chart of expenses by category.
   - Quick action shortcuts to add Expense, Income, Investment, or Lending records instantly.
   - Summary cards showing total bank balance, net savings, credit card outstandings, and pending debts.
3. **Advanced Category Management**:
   - Manage your categories properly in the dedicated `/categories` section.
   - Dynamically create new categories by choosing "Other" in the Expense or Income dialog.
   - Renaming categories dynamically cascades changes to all existing transactions in the database.
   - Deleting custom categories safely resets matching transactions to "Other".
4. **Lending Ledger**:
   - Track money given to or borrowed from others.
   - Detail logs recording multiple repayments (dates and amounts) directly on entries.
   - Displays clear remaining balances and statuses (Pending, Partially Returned, Settled).
5. **Robust Routing & Errors**:
   - Custom premium `404 Not Found` page.
   - Global error boundary rendering fallback view with reset hooks.
6. **Data Portability**: Full support for importing and exporting transactions (income, expense, lending, bank transactions) using Excel/Sheets formats.

---

## 🛠️ Getting Started

### 1. Prerequisites

Create a `.env.local` file in the root of the project with the following configuration:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key_for_auth_tokens
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Seeding

Seed the database with initial default categories, mock bank accounts, and transactions:

```bash
npm run seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### 5. Code Formatting

Format the codebase using Prettier:

```bash
npm run format
```

### 6. Production Build

Verify everything builds correctly:

```bash
npm run build
```

---

## 🏦 Bank Integration & Lending Lifecycle

Finora handles complex financial operations behind the scenes to keep your **Lending History**, **Bank Statements**, and **Account Balances** in perfect sync automatically.

### 1. Bank Transfers (Bank-to-Bank)
* **Action**: Transfer money from one bank account to another.
* **Mechanism**:
  * Creates a **Debit** (outflow) transaction on the source bank account.
  * Creates a **Credit** (inflow) transaction on the destination bank account.
  * Links both transactions using their ID referencing (`refId`) to maintain a clean double-entry audit trail.

### 2. The 4 Lending & Repayment Cases
Lending operations automatically manage bank balances depending on whether you are giving, borrowing, receiving, or paying back money.

| Case | Action | Type | Bank Account Impact | Bank Transaction |
| :--- | :--- | :--- | :--- | :--- |
| **Case 1** | **I Lent Money** | Given | **Outflow** (Debited from your account) | `Debit` |
| **Case 2** | **Lent Money Returned** | Repayment | **Inflow** (Credited back to your account) | `Credit` |
| **Case 3** | **I Borrowed Money** | Taken | **Inflow** (Credited to your account) | `Credit` |
| **Case 4** | **Borrowed Money Repaid** | Repayment | **Outflow** (Debited to pay back lender) | `Debit` |

### 3. Automated Deletes & Edits
* **Offsetting Transactions (Audit Trail)**: If you delete a lending entry, Finora does not just wipe the ledger; it records **reversing/offsetting transactions** on the respective bank accounts (e.g. if you delete a $100 loan you gave, it records a $100 offsetting credit to restore your bank balance).
* **Edit Adjustments**: If you change the amount, type, or bank account of a lending entry, the system reverses the old balance impact first, then applies the new balance impact.
* **Lending / Borrowing More (Maintaining History)**: If a person asks for more money (or you borrow more from them), you should **not** edit and change the amount of the existing entry (which would overwrite the original loan transaction date/details). Instead, expand that person's card and click **"Lend More"** or **"Borrow More"**. This automatically creates a new transaction entry pre-filled for that person, maintaining a complete chronological history of every time they took or returned money.


