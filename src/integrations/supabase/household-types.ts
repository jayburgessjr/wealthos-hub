export type CategoryType = "fixed" | "variable" | "savings" | "debt";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  monthlyLimit: number;
  spent: number;
  icon?: string;
}

export type ExpenseType =
  | "one_off"
  | "recurring"
  | "bill_payment"
  | "subscription";

export interface Expense {
  id: string;
  amount: number;
  categoryId: string;
  date: string;
  description?: string;
  userId: string;
  userName: string;
  linkedBillId?: string;
  linkedSubscriptionId?: string;
  expenseType?: ExpenseType;
  transactionDate?: string;
  postedDate?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline?: string;
  linkedBillId?: string;
  imagePath?: string;
  notes?: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  nextDate: string;
  confirmed: boolean;
  notes?: string;
  paymentAccountId?: string;
  frequency: "monthly" | "annual";
  isAutoPay?: boolean;
}

export type BillPaymentStatus = "unpaid" | "partial" | "paid";

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO date string
  categoryId: string;
  isAutoPay: boolean;
  paymentStatus: BillPaymentStatus;
  amountPaid: number; // for partial payments
  totalBalance: number; // total amount owed (could be > amount for installments)
  notes?: string;
  paymentAccountId: string; // which account pays this bill
  isRecurring: boolean;
  frequency?: "monthly" | "weekly" | "yearly" | "biweekly";
  isActive: boolean; // when false, bill won't roll over to future months but stays for history
  // Advanced debt details (all optional)
  creditLimit?: number; // Only for revolving accounts (credit cards, lines of credit)
  apr?: number; // Annual Percentage Rate as decimal (e.g., 0.1999 for 19.99%)
  monthlyFees?: number; // Recurring monthly service/maintenance fees
  yearlyFees?: number; // Annual fees (amortized monthly in calculations)
  lateFees?: number; // Typical penalty if payment is missed
  idealPayment?: number; // User's preferred payment amount per month
}

export type AccountType = "checking" | "savings" | "credit_card" | "other";

export interface BankAccount {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number; // actual balance from bank (user entered)
  calculatedBalance: number; // app's calculated balance
  lastReconciled: string; // ISO date string
  isActive: boolean;
  notes?: string;
}

export interface CreditScoreEntry {
  id: string;
  userId: string;
  userName: string;
  score: number;
  date: string; // ISO date string
  bureau?: "experian" | "equifax" | "transunion" | "vantage";
}

export type IncomeType =
  | "salary"
  | "business"
  | "investment"
  | "rental"
  | "freelance"
  | "loan"
  | "tax_refund"
  | "gift"
  | "other";

export type PaymentMethod =
  | "direct_deposit"
  | "check"
  | "cash"
  | "transfer"
  | "other";

export type TaxStatus = "taxable" | "non_taxable" | "deferred";

export type RecurrenceFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface IncomeSource {
  id: string;
  name: string; // e.g., "My Salary", "Wife's Business"
  type: IncomeType;
  expectedAmount?: number; // for recurring income
  frequency?: RecurrenceFrequency;
  expectedDay?: number; // day of month/week when expected
  isActive: boolean;
  userId: string; // who receives this income
  userName: string;
  taxStatus: TaxStatus;
  notes?: string;
}

export interface IncomeEntry {
  id: string;
  amount: number;
  sourceId?: string; // link to IncomeSource if from a known source
  sourceName: string; // "My Salary", "Freelance Project X"
  type: IncomeType;
  date: string; // ISO date string (when received)
  userId: string; // who received it
  userName: string;
  paymentMethod: PaymentMethod;
  taxStatus: TaxStatus;
  notes?: string;
  isRecurring: boolean;
  // For business income
  grossAmount?: number; // before business expenses
  netAmount?: number; // after business expenses (same as amount)
  businessExpenses?: number;
  // For loans
  loanId?: string; // link to a Goal if it's a debt
  interestRate?: number;
  // Tax tracking
  taxWithheld?: number; // amount withheld for taxes
}

export interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  avatar?: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO date string YYYY-MM-DD
  assignedTo?: string; // user_id from household members
  assignedToName?: string; // Display name for UI
  tags: string[]; // Array of tag strings
  createdBy: string; // user_id
  createdByName: string; // Display name
  householdId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  position: number; // For ordering within status column
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedTo?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedTo?: string;
  tags?: string[];
  position?: number;
}

// ── Summaries ─────────────────────────────────────────────────────────────────

export interface WeeklySummary {
  id: string;
  householdId: string;
  period: string; // 'YYYY-Www'
  notes?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySummary {
  id: string;
  householdId: string;
  period: string; // 'YYYY-MM'
  notes?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QuarterlySummary {
  id: string;
  householdId: string;
  period: string; // 'YYYY-Q1'
  notes?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM format
  income: number; // DEPRECATED: kept for backwards compatibility, use incomeEntries instead
  incomeSources: IncomeSource[]; // expected/recurring income sources
  incomeEntries: IncomeEntry[]; // actual income received
  categories: Category[];
  expenses: Expense[];
  goals: Goal[];
  subscriptions: Subscription[];
  bills: Bill[];
  bankAccounts: BankAccount[];
  creditScores: CreditScoreEntry[];
  tasks: Task[];
  careerProfiles: CareerProfile[];
  weeklySummaries: WeeklySummary[];
  monthlySummaries: MonthlySummary[];
  quarterlySummaries: QuarterlySummary[];
  // Budget thresholds for KPI color-coding
  expectedMonthlyIncome: number;
  subscriptionBudget: number;
  billsBudget: number;
  expensesBudget: number;
}

export interface SimulationScenario {
  id: string;
  name: string;
  type: "income_change" | "expense_change" | "new_expense";
  amount: number;
  categoryId?: string;
  isRecurring: boolean;
}

export type BudgetStatus = "safe" | "warning" | "danger";

// Career Management Types
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "self_employed"
  | "unemployed";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type CareerGoalStatus = "planning" | "in_progress" | "completed";

export interface Skill {
  id: string;
  careerProfileId: string;
  name: string;
  level: SkillLevel;
  yearsExperience?: number;
}

export interface Achievement {
  id: string;
  careerProfileId: string;
  title: string;
  description?: string;
  date: string;
}

export interface CareerGoal {
  id: string;
  careerProfileId: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: CareerGoalStatus;
}

export interface CareerProfile {
  id: string;
  userId: string;
  userName: string;
  householdId: string;
  currentTitle: string;
  currentCompany: string;
  startDate: string;
  employmentType: EmploymentType;
  currentSalary: number;
  linkedIncomeSourceId?: string;
  nextReviewDate?: string;
  targetRaise?: number;
  jobSearchActive: boolean;
  skills: Skill[];
  achievements: Achievement[];
  careerGoals: CareerGoal[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCareerProfileInput {
  currentTitle: string;
  currentCompany: string;
  startDate: string;
  employmentType?: EmploymentType;
  currentSalary?: number;
  linkedIncomeSourceId?: string;
  nextReviewDate?: string;
  targetRaise?: number;
  jobSearchActive?: boolean;
}

export interface CreateSkillInput {
  name: string;
  level?: SkillLevel;
  yearsExperience?: number;
}

export interface CreateAchievementInput {
  title: string;
  description?: string;
  date: string;
}

export interface CreateCareerGoalInput {
  title: string;
  description?: string;
  targetDate?: string;
  status?: CareerGoalStatus;
}
