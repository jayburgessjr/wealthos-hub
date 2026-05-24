import { supabase } from "@/integrations/supabase/client";
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import type {
  Budget,
  Category,
  Expense,
  Goal,
  Bill,
  IncomeSource,
  IncomeEntry,
  BankAccount,
  CreditScoreEntry,
  Subscription,
  Task,
  TaskStatus,
  TaskPriority,
  CareerProfile,
  Skill,
  Achievement,
  CareerGoal,
} from "@/integrations/supabase/household-types";

export interface FetchBudgetResult {
  budget: Budget;
  raw: {
    household: Tables<"households"> | null;
    categories: Tables<"categories">[];
    expenses: Tables<"expenses">[];
    profilesById: Record<string, { display_name: string; email: string }>;
    bills: Tables<"bills">[];
  };
}

export async function getHouseholdIdForUser(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.household_id as string | null) ?? null;
}

export async function fetchHousehold(householdId: string) {
  const { data, error } = await supabase
    .from("households")
    .select("*")
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProfilesForHousehold(householdId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, household_id")
    .eq("household_id", householdId);
  if (error) throw error;
  const map: Record<string, { display_name: string; email: string }> = {};
  for (const p of data ?? []) {
    map[p.id] = { display_name: p.display_name, email: p.email };
  }
  return map;
}

// Invitations & Households
export async function createInvitation(
  householdId: string,
  email: string,
  invitedByUserId: string,
) {
  const token = cryptoRandomToken();
  const payload: TablesInsert<"invitations"> = {
    token,
    household_id: householdId,
    email,
    invited_by: invitedByUserId,
    status: "pending",
  };
  const { data, error } = await supabase
    .from("invitations")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchInvitationsForHousehold(householdId: string) {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInvitationByToken(token: string) {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function acceptInvitation(token: string, userId: string) {
  // 1) Load invitation (requires invited email policy or owner)
  const invite = await getInvitationByToken(token);
  if (!invite) throw new Error("Invalid invitation");
  if (invite.status !== "pending") throw new Error("Invitation not pending");
  const householdId = invite.household_id as string;

  // 2) Update invitation status (policy allows invited user)
  const { error: updErr } = await supabase
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (updErr) throw updErr;

  // 3) Attach user to household
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ household_id: householdId })
    .eq("id", userId);
  if (profErr) throw profErr;

  // 4) Upsert member role
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: userId, household_id: householdId, role: "member" },
      { onConflict: "user_id,household_id" },
    );
  if (roleErr) throw roleErr;

  return { householdId };
}

export async function listUserHouseholds(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("household_id, role, households:household_id (id, name)");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.households.id,
    name: r.households.name,
    role: r.role,
  }));
}

export async function switchActiveHousehold(
  userId: string,
  householdId: string,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ household_id: householdId })
    .eq("id", userId);
  if (error) throw error;
}

function cryptoRandomToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function fetchHouseholdMembers(householdId: string) {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, household_id")
        .eq("household_id", householdId),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("household_id", householdId),
    ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  const roleMap = new Map<string, string>();
  (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    email: p.email,
    name: p.display_name,
    role: roleMap.get(p.id) || "member",
  }));
}

export async function updateMemberRole(
  userId: string,
  householdId: string,
  role: "owner" | "member",
) {
  const { error } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: userId, household_id: householdId, role },
      { onConflict: "user_id,household_id" },
    );
  if (error) throw error;
}

export async function removeMemberFromHousehold(
  userId: string,
  householdId: string,
) {
  // Remove role
  const { error: rErr } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("household_id", householdId);
  if (rErr) throw rErr;
  // Clear profile household_id
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ household_id: null })
    .eq("id", userId)
    .eq("household_id", householdId);
  if (pErr) throw pErr;
}

export async function fetchCategories(householdId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchExpenses(householdId: string, monthISO: string) {
  // monthISO is YYYY-MM; filter expenses within that month
  const [year, month] = monthISO.split("-").map(Number);
  // First day of month
  const startDate = `${monthISO}-01`;
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${monthISO}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("household_id", householdId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchBills(householdId: string) {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", householdId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Subscriptions table
export async function fetchSubscriptions(
  householdId: string,
): Promise<{ items: any[]; available: boolean }> {
  try {
    // Use generic query approach to avoid type issues before types regenerate
    const { data, error } = await (supabase as any)
      .from("subscriptions")
      .select("*")
      .eq("household_id", householdId)
      .order("next_date", { ascending: true });
    if (error) throw error;
    return { items: data ?? [], available: true };
  } catch (e: any) {
    // If the table doesn't exist yet, return flag so UI can fallback to local
    if (
      e?.code === "42P01" ||
      /relation .* does not exist/i.test(String(e?.message || ""))
    ) {
      return { items: [], available: false };
    }
    throw e;
  }
}

export interface CreateSubscriptionInput {
  name: string;
  amount: number;
  nextDate: string;
  categoryId?: string;
  confirmed?: boolean;
  notes?: string;
  paymentAccountId?: string;
  frequency?: "monthly" | "annual";
  isAutoPay?: boolean;
}

export async function createSubscription(
  householdId: string,
  input: CreateSubscriptionInput,
) {
  const payload = {
    household_id: householdId,
    name: input.name,
    amount: input.amount,
    next_date: input.nextDate,
    category_id: input.categoryId ?? null,
    confirmed: input.confirmed ?? true,
    notes: input.notes ?? null,
    payment_account_id: input.paymentAccountId ?? null,
    frequency: input.frequency ?? "monthly",
    is_auto_pay: input.isAutoPay ?? false,
  };
  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubscriptionDb(
  id: string,
  updates: Partial<CreateSubscriptionInput>,
) {
  const patch: Record<string, any> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.amount !== undefined) patch.amount = updates.amount;
  if (updates.nextDate !== undefined) patch.next_date = updates.nextDate;
  if (updates.categoryId !== undefined) patch.category_id = updates.categoryId;
  if (updates.confirmed !== undefined) patch.confirmed = updates.confirmed;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.paymentAccountId !== undefined)
    patch.payment_account_id = updates.paymentAccountId;
  if (updates.frequency !== undefined) patch.frequency = updates.frequency;
  if (updates.isAutoPay !== undefined) patch.is_auto_pay = updates.isAutoPay;

  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubscriptionDb(id: string) {
  const { error } = await (supabase as any)
    .from("subscriptions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Income sources and entries
export async function fetchIncomeSources(householdId: string) {
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchIncomeEntries(
  householdId: string,
  monthISO: string,
) {
  // Parse year and month from ISO string (e.g., "2025-12")
  const [year, month] = monthISO.split("-").map(Number);
  // First day of month
  const startDate = `${monthISO}-01`;
  // Last day of month: create date for first of next month, then subtract 1 day
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-indexed here, so this gives last day of that month
  const endDate = `${monthISO}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("income_entries")
    .select("*")
    .eq("household_id", householdId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface CreateIncomeSourceInput {
  name: string;
  type?: string;
  expectedAmount?: number;
  frequency?: string;
  expectedDay?: number;
  isActive?: boolean;
  taxStatus?: string;
  notes?: string;
}

export async function createIncomeSource(
  householdId: string,
  userId: string,
  input: CreateIncomeSourceInput,
) {
  const payload: TablesInsert<"income_sources"> = {
    household_id: householdId,
    user_id: userId,
    name: input.name,
    type: input.type ?? "salary",
    expected_amount: input.expectedAmount ?? null,
    frequency: input.frequency ?? "monthly",
    expected_day: input.expectedDay ?? null,
    is_active: input.isActive ?? true,
    tax_status: input.taxStatus ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("income_sources")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateIncomeSourceDb(
  id: string,
  updates: Partial<CreateIncomeSourceInput>,
) {
  const patch: TablesUpdate<"income_sources"> = {
    name: updates.name,
    type: updates.type,
    expected_amount: updates.expectedAmount,
    frequency: updates.frequency,
    expected_day: updates.expectedDay,
    is_active: updates.isActive,
    tax_status: updates.taxStatus,
    notes: updates.notes,
  };
  const { data, error } = await supabase
    .from("income_sources")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIncomeSourceDb(id: string) {
  const { error } = await supabase.from("income_sources").delete().eq("id", id);
  if (error) throw error;
}

export interface CreateIncomeEntryInput {
  amount: number;
  sourceId?: string | null;
  sourceName: string;
  type: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: string;
  taxStatus?: string;
  notes?: string;
  grossAmount?: number;
  netAmount?: number;
  businessExpenses?: number;
  paymentAccountId?: string | null;
}

export async function createIncomeEntry(
  householdId: string,
  userId: string,
  input: CreateIncomeEntryInput,
) {
  const payload: TablesInsert<"income_entries"> = {
    household_id: householdId,
    user_id: userId,
    source_id: input.sourceId ?? null,
    source_name: input.sourceName,
    type: input.type,
    amount: input.amount,
    date: input.date,
    payment_method: input.paymentMethod ?? null,
    tax_status: input.taxStatus ?? null,
    notes: input.notes ?? null,
    gross_amount: input.grossAmount ?? null,
    net_amount: input.netAmount ?? null,
    business_expenses: input.businessExpenses ?? null,
    payment_account_id: input.paymentAccountId ?? null,
  };
  const { data, error } = await supabase
    .from("income_entries")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateIncomeEntryDb(
  id: string,
  updates: Partial<CreateIncomeEntryInput>,
) {
  const patch: TablesUpdate<"income_entries"> = {
    source_id: updates.sourceId,
    source_name: updates.sourceName,
    type: updates.type,
    amount: updates.amount,
    date: updates.date,
    payment_method: updates.paymentMethod,
    tax_status: updates.taxStatus,
    notes: updates.notes,
    gross_amount: updates.grossAmount,
    net_amount: updates.netAmount,
    business_expenses: updates.businessExpenses,
    payment_account_id: updates.paymentAccountId,
  };
  const { data, error } = await supabase
    .from("income_entries")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIncomeEntryDb(id: string) {
  const { error } = await supabase.from("income_entries").delete().eq("id", id);
  if (error) throw error;
}

// Bank accounts
export async function fetchBankAccounts(householdId: string) {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface CreateBankAccountInput {
  name: string;
  type: string;
  currentBalance: number;
  calculatedBalance: number;
  lastReconciled?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export async function createBankAccount(
  householdId: string,
  input: CreateBankAccountInput,
) {
  const payload: TablesInsert<"bank_accounts"> = {
    household_id: householdId,
    name: input.name,
    type: input.type,
    current_balance: input.currentBalance,
    calculated_balance: input.calculatedBalance,
    last_reconciled: input.lastReconciled ?? null,
    is_active: input.isActive ?? true,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateBankAccountDb(
  id: string,
  updates: Partial<CreateBankAccountInput>,
) {
  const patch: TablesUpdate<"bank_accounts"> = {
    name: updates.name,
    type: updates.type,
    current_balance: updates.currentBalance,
    calculated_balance: updates.calculatedBalance,
    last_reconciled: updates.lastReconciled,
    is_active: updates.isActive,
    notes: updates.notes,
  };
  const { data, error } = await supabase
    .from("bank_accounts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBankAccountDb(id: string) {
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) throw error;
}

// Credit scores
export async function fetchCreditScores(householdId: string) {
  const { data, error } = await supabase
    .from("credit_scores")
    .select("*")
    .eq("household_id", householdId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface CreateCreditScoreInput {
  userId: string;
  score: number;
  date: string;
  bureau?: string | null;
}

export async function createCreditScore(
  householdId: string,
  input: CreateCreditScoreInput,
) {
  const payload: TablesInsert<"credit_scores"> = {
    household_id: householdId,
    user_id: input.userId,
    score: input.score,
    date: input.date,
    bureau: input.bureau ?? null,
  };
  const { data, error } = await supabase
    .from("credit_scores")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCreditScoreDb(id: string) {
  const { error } = await supabase.from("credit_scores").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchGoals(householdId: string) {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type ExpenseTypeDb =
  | "one_off"
  | "recurring"
  | "bill_payment"
  | "subscription";

export interface CreateExpenseInput {
  amount: number;
  categoryId: string;
  date: string; // YYYY-MM-DD
  description?: string;
  linkedBillId?: string | null;
  linkedSubscriptionId?: string | null;
  expenseType?: ExpenseTypeDb;
  transactionDate?: string;
  postedDate?: string;
}

export async function createExpense(
  householdId: string,
  userId: string,
  input: CreateExpenseInput,
) {
  const payload: TablesInsert<"expenses"> = {
    amount: input.amount,
    category_id: input.categoryId,
    date: input.date,
    description: input.description ?? null,
    household_id: householdId,
    user_id: userId,
    linked_bill_id: input.linkedBillId ?? null,
    linked_subscription_id: input.linkedSubscriptionId ?? null,
    expense_type: input.expenseType ?? "one_off",
    transaction_date: input.transactionDate ?? input.date,
    posted_date: input.postedDate ?? null,
  } as any;
  const { data, error } = await supabase
    .from("expenses")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateExpense(
  id: string,
  updates: Partial<
    Omit<CreateExpenseInput, "categoryId"> & { categoryId: string }
  >,
) {
  const patch: TablesUpdate<"expenses"> = {
    amount: updates.amount,
    category_id: updates.categoryId,
    date: updates.date,
    description: updates.description ?? undefined,
    linked_bill_id: updates.linkedBillId,
    linked_subscription_id: updates.linkedSubscriptionId,
    expense_type: updates.expenseType,
    transaction_date: updates.transactionDate,
    posted_date: updates.postedDate,
  } as any;
  const { data, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// Bills CRUD
export interface CreateBillInput {
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  categoryId?: string | null;
  isRecurring?: boolean;
  frequency?: "monthly" | "weekly" | "yearly" | "biweekly";
  isAutoPay?: boolean;
  notes?: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  amountPaid?: number;
  totalBalance?: number;
  paymentAccountId?: string | null;
  isActive?: boolean;
  // Advanced debt details (all optional)
  creditLimit?: number | null;
  apr?: number | null;
  monthlyFees?: number | null;
  yearlyFees?: number | null;
  lateFees?: number | null;
  idealPayment?: number | null;
}

export async function createBill(householdId: string, input: CreateBillInput) {
  const payload: Record<string, any> = {
    household_id: householdId,
    name: input.name,
    amount: input.amount,
    due_date: input.dueDate,
    category_id: input.categoryId ?? null,
    is_recurring: input.isRecurring ?? true,
    frequency: input.frequency ?? "monthly",
    is_auto_pay: input.isAutoPay ?? false,
    notes: input.notes ?? null,
    payment_status: (input.paymentStatus as any) ?? "unpaid",
    amount_paid: input.amountPaid ?? 0,
    total_balance: input.totalBalance ?? input.amount,
    payment_account_id: input.paymentAccountId ?? null,
    // Advanced debt details
    credit_limit: input.creditLimit ?? null,
    apr: input.apr ?? null,
    monthly_fees: input.monthlyFees ?? null,
    yearly_fees: input.yearlyFees ?? null,
    late_fees: input.lateFees ?? null,
    ideal_payment: input.idealPayment ?? null,
  };
  const { data, error } = await supabase
    .from("bills")
    .insert(payload as any)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateBillDb(
  id: string,
  updates: Partial<CreateBillInput>,
) {
  const patch: Record<string, any> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.amount !== undefined) patch.amount = updates.amount;
  if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
  if (updates.categoryId !== undefined) patch.category_id = updates.categoryId;
  if (updates.isRecurring !== undefined)
    patch.is_recurring = updates.isRecurring;
  if (updates.frequency !== undefined) patch.frequency = updates.frequency;
  if (updates.isAutoPay !== undefined) patch.is_auto_pay = updates.isAutoPay;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.paymentStatus !== undefined)
    patch.payment_status = updates.paymentStatus;
  if (updates.amountPaid !== undefined) patch.amount_paid = updates.amountPaid;
  if (updates.totalBalance !== undefined)
    patch.total_balance = updates.totalBalance;
  if (updates.paymentAccountId !== undefined)
    patch.payment_account_id = updates.paymentAccountId;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;
  // Advanced debt details
  if (updates.creditLimit !== undefined)
    patch.credit_limit = updates.creditLimit;
  if (updates.apr !== undefined) patch.apr = updates.apr;
  if (updates.monthlyFees !== undefined)
    patch.monthly_fees = updates.monthlyFees;
  if (updates.yearlyFees !== undefined) patch.yearly_fees = updates.yearlyFees;
  if (updates.lateFees !== undefined) patch.late_fees = updates.lateFees;
  if (updates.idealPayment !== undefined)
    patch.ideal_payment = updates.idealPayment;

  const { data, error } = await supabase
    .from("bills")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBillDb(id: string) {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw error;
}

// Debts CRUD
export interface CreateDebtInput {
  name: string;
  totalBalance: number;
  currentBalance: number;
  monthlyPayment: number;
  interestRate?: number | null;
  categoryId?: string | null;
  paymentBillId?: string | null;
  isActive?: boolean;
  notes?: string | null;
  syncToBill?: boolean;
  userId?: string | null;
}

export async function fetchDebts(householdId: string) {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("household_id", householdId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDebt(householdId: string, input: CreateDebtInput) {
  const payload: any = {
    household_id: householdId,
    user_id: input.userId ?? null,
    name: input.name,
    total_balance: input.totalBalance,
    current_balance: input.currentBalance,
    monthly_payment: input.monthlyPayment,
    interest_rate: input.interestRate ?? null,
    category_id: input.categoryId ?? null,
    payment_bill_id: input.paymentBillId ?? null,
    is_active: input.isActive ?? true,
    notes: input.notes ?? null,
    sync_to_bill: input.syncToBill ?? true,
  };
  const { data, error } = await supabase
    .from("debts")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateDebtDb(
  id: string,
  updates: Partial<CreateDebtInput>,
) {
  const patch: any = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.totalBalance !== undefined)
    patch.total_balance = updates.totalBalance;
  if (updates.currentBalance !== undefined)
    patch.current_balance = updates.currentBalance;
  if (updates.monthlyPayment !== undefined)
    patch.monthly_payment = updates.monthlyPayment;
  if (updates.interestRate !== undefined)
    patch.interest_rate = updates.interestRate;
  if (updates.categoryId !== undefined) patch.category_id = updates.categoryId;
  if (updates.paymentBillId !== undefined)
    patch.payment_bill_id = updates.paymentBillId;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.syncToBill !== undefined) patch.sync_to_bill = updates.syncToBill;
  const { data, error } = await supabase
    .from("debts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDebtDb(id: string) {
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
}

// Categories CRUD
export interface CreateCategoryInput {
  name: string;
  type: Category["type"];
  monthlyLimit: number;
  icon?: string;
  color?: string | null;
}

export async function createCategory(
  householdId: string,
  input: CreateCategoryInput,
) {
  const payload: TablesInsert<"categories"> = {
    household_id: householdId,
    name: input.name,
    type: input.type,
    monthly_limit: input.monthlyLimit,
    icon: input.icon ?? null,
    color: input.color ?? null,
  };
  const { data, error } = await supabase
    .from("categories")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategoryDb(
  id: string,
  updates: Partial<CreateCategoryInput>,
) {
  const patch: TablesUpdate<"categories"> = {
    name: updates.name,
    type: updates.type as any,
    monthly_limit: updates.monthlyLimit,
    icon: updates.icon ?? undefined,
    color: updates.color ?? undefined,
  };
  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategoryDb(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

// Goals CRUD
export interface CreateGoalInput {
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate?: string | null;
  linkedBillId?: string | null;
  imagePath?: string | null;
  notes?: string | null;
}

export async function createGoal(householdId: string, input: CreateGoalInput) {
  const payload: TablesInsert<"goals"> = {
    household_id: householdId,
    name: input.name,
    target_amount: input.targetAmount,
    current_amount: input.currentAmount,
    monthly_contribution: input.monthlyContribution,
    target_date: input.targetDate ?? null,
    linked_bill_id: input.linkedBillId ?? null,
    image_path: input.imagePath ?? null,
    notes: input.notes ?? null,
  } as any;
  const { data, error } = await supabase
    .from("goals")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoalDb(
  id: string,
  updates: Partial<CreateGoalInput>,
) {
  const patch: TablesUpdate<"goals"> = {
    name: updates.name,
    target_amount: updates.targetAmount,
    current_amount: updates.currentAmount,
    monthly_contribution: updates.monthlyContribution,
    target_date: updates.targetDate,
    linked_bill_id: updates.linkedBillId,
    image_path: updates.imagePath,
    notes: updates.notes,
  } as any;
  const { data, error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoalDb(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// Household setup
export async function createHousehold(name: string, monthlyIncome: number) {
  // Use secure RPC to perform the full setup in one call
  const { data, error } = await supabase.rpc("create_household", {
    name,
    monthly_income: monthlyIncome,
  });
  if (error) throw error;
  // RPC returns the new household id (UUID)
  return {
    id: data as string,
    name,
    monthly_income: monthlyIncome,
  } as Tables<"households">;
}

export interface UpdateHouseholdInput {
  name?: string;
  monthlyIncome?: number;
  expectedMonthlyIncome?: number;
  subscriptionBudget?: number;
  billsBudget?: number;
  expensesBudget?: number;
  notes?: string;
}

export async function updateHousehold(
  householdId: string,
  updates: UpdateHouseholdInput,
) {
  const patch: TablesUpdate<"households"> = {
    name: updates.name,
    monthly_income: updates.monthlyIncome,
    expected_monthly_income: updates.expectedMonthlyIncome,
    subscription_budget: updates.subscriptionBudget,
    bills_budget: updates.billsBudget,
    expenses_budget: updates.expensesBudget,
    notes: updates.notes,
  };
  const { data, error } = await supabase
    .from("households")
    .update(patch)
    .eq("id", householdId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setProfileHousehold(userId: string, householdId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ household_id: householdId })
    .eq("id", userId);
  if (error) throw error;
}

export async function upsertOwnerRole(userId: string, householdId: string) {
  const payload: TablesInsert<"user_roles"> = {
    user_id: userId,
    household_id: householdId,
    role: "owner",
  };
  const { error } = await supabase
    .from("user_roles")
    .upsert(payload, { onConflict: "user_id,household_id" });
  if (error) throw error;
}

export async function seedDefaultCategories(householdId: string) {
  const defaults: TablesInsert<"categories">[] = [
    {
      household_id: householdId,
      name: "Rent",
      type: "fixed",
      monthly_limit: 1500,
      icon: "🏠",
    },
    {
      household_id: householdId,
      name: "Utilities",
      type: "fixed",
      monthly_limit: 200,
      icon: "💡",
    },
    {
      household_id: householdId,
      name: "Groceries",
      type: "variable",
      monthly_limit: 600,
      icon: "🛒",
    },
    {
      household_id: householdId,
      name: "Transportation",
      type: "variable",
      monthly_limit: 300,
      icon: "🚗",
    },
  ];
  const { error } = await supabase.from("categories").insert(defaults);
  if (error) throw error;
}

export async function fetchBudget(
  householdId: string,
  monthISO: string,
): Promise<FetchBudgetResult> {
  const [
    household,
    profilesById,
    cats,
    exps,
    goals,
    bills,
    incomeSources,
    incomeEntries,
    bankAccounts,
    creditScores,
    weeklySummariesRaw,
    monthlySummariesRaw,
    subsResult,
    tasks,
    careerProfiles,
  ] = await Promise.all([
    fetchHousehold(householdId),
    fetchProfilesForHousehold(householdId),
    fetchCategories(householdId),
    fetchExpenses(householdId, monthISO),
    fetchGoals(householdId),
    fetchBills(householdId),
    fetchIncomeSources(householdId),
    fetchIncomeEntries(householdId, monthISO),
    fetchBankAccounts(householdId),
    fetchCreditScores(householdId),
    fetchWeeklySummaries(householdId),
    fetchMonthlySummaries(householdId),
    fetchSubscriptions(householdId).catch(() => ({
      items: [],
      available: false,
    })),
    fetchTasks(householdId).catch(() => []),
    fetchCareerProfiles(householdId).catch(() => []),
  ]);

  const { items: subsRaw, available: subsAvailable } = subsResult;

  // Map DB categories to app Category while computing monthly spent
  const zeroSpentCats: Category[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as Category["type"],
    monthlyLimit: Number(c.monthly_limit ?? 0),
    spent: 0,
    icon: c.icon ?? undefined,
  }));

  // Map expenses with usernames
  const expenses: Expense[] = (exps ?? []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    categoryId: e.category_id,
    date: e.date,
    description: e.description ?? undefined,
    userId: e.user_id,
    userName: profilesById[e.user_id]?.display_name ?? "Member",
    linkedBillId: (e as any).linked_bill_id ?? undefined,
    linkedSubscriptionId: (e as any).linked_subscription_id ?? undefined,
  }));

  // Compute spent per category for the month
  const spentByCat = new Map<string, number>();
  for (const e of expenses) {
    spentByCat.set(
      e.categoryId,
      (spentByCat.get(e.categoryId) ?? 0) + e.amount,
    );
  }
  const categories: Category[] = zeroSpentCats.map((c) => ({
    ...c,
    spent: Number(spentByCat.get(c.id) ?? 0),
  }));

  const goalsMapped: Goal[] = (goals ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    targetAmount: Number(g.target_amount),
    currentAmount: Number(g.current_amount ?? 0),
    monthlyContribution: Number(g.monthly_contribution ?? 0),
    deadline: g.target_date ?? undefined,
    linkedBillId: g.linked_bill_id ?? undefined,
    imagePath: g.image_path ?? undefined,
    notes: g.notes ?? undefined,
  }));

  const incomeSourcesMapped: IncomeSource[] = (incomeSources ?? []).map(
    (s) => ({
      id: s.id,
      name: s.name,
      type: s.type as any,
      expectedAmount: s.expected_amount ? Number(s.expected_amount) : undefined,
      frequency: (s.frequency ?? undefined) as any,
      expectedDay: s.expected_day ?? undefined,
      isActive: !!s.is_active,
      userId: s.user_id,
      userName: profilesById[s.user_id]?.display_name ?? "Member",
      taxStatus: (s.tax_status ?? undefined) as any,
      notes: s.notes ?? undefined,
    }),
  );

  const incomeEntriesMapped: IncomeEntry[] = (incomeEntries ?? []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    sourceId: e.source_id ?? undefined,
    sourceName: e.source_name,
    type: e.type as any,
    date: e.date,
    userId: e.user_id,
    userName: profilesById[e.user_id]?.display_name ?? "Member",
    paymentMethod: (e.payment_method ?? undefined) as any,
    taxStatus: (e.tax_status ?? undefined) as any,
    notes: e.notes ?? undefined,
    grossAmount: e.gross_amount ?? undefined,
    netAmount: e.net_amount ?? undefined,
    businessExpenses: e.business_expenses ?? undefined,
    isRecurring: false,
  }));

  const totalIncome = incomeEntriesMapped.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );

  const bankAccountsMapped: BankAccount[] = (bankAccounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as any,
    currentBalance: Number(a.current_balance ?? 0),
    calculatedBalance: Number(a.calculated_balance ?? 0),
    lastReconciled: a.last_reconciled ?? "",
    isActive: !!a.is_active,
    notes: a.notes ?? undefined,
  }));

  const creditScoresMapped: CreditScoreEntry[] = (creditScores ?? []).map(
    (c) => ({
      id: c.id,
      userId: c.user_id,
      userName: profilesById[c.user_id]?.display_name ?? "Member",
      score: Number(c.score),
      date: c.date,
      bureau: (c.bureau ?? undefined) as any,
    }),
  );

  const tasksMapped: Task[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    dueDate: t.due_date ?? undefined,
    assignedTo: t.assigned_to ?? undefined,
    assignedToName: t.assigned_to
      ? (profilesById[t.assigned_to]?.display_name ?? "Member")
      : undefined,
    tags: t.tags ?? [],
    createdBy: t.created_by,
    createdByName: profilesById[t.created_by]?.display_name ?? "Member",
    householdId: t.household_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    position: t.position ?? 0,
  }));

  const careerProfilesMapped: CareerProfile[] = (careerProfiles ?? []).map(
    (cp: any) => ({
      id: cp.id,
      userId: cp.user_id,
      userName: profilesById[cp.user_id]?.display_name ?? "Member",
      householdId: cp.household_id,
      currentTitle: cp.current_title,
      currentCompany: cp.current_company,
      startDate: cp.start_date,
      employmentType: cp.employment_type,
      currentSalary: Number(cp.current_salary ?? 0),
      linkedIncomeSourceId: cp.linked_income_source_id ?? undefined,
      nextReviewDate: cp.next_review_date ?? undefined,
      targetRaise: cp.target_raise ? Number(cp.target_raise) : undefined,
      jobSearchActive: !!cp.job_search_active,
      skills: cp.skills ?? [],
      achievements: cp.achievements ?? [],
      careerGoals: cp.career_goals ?? [],
      createdAt: cp.created_at,
      updatedAt: cp.updated_at,
    }),
  );

  const billsMapped: Bill[] = (bills ?? []).map((b: any) => ({
    id: b.id,
    name: b.name,
    amount: Number(b.amount),
    dueDate: b.due_date,
    categoryId: b.category_id ?? "",
    isRecurring: !!b.is_recurring,
    frequency: (b.frequency ?? undefined) as any,
    isAutoPay: !!b.is_auto_pay,
    paymentStatus: (b.payment_status as any) ?? "unpaid",
    amountPaid: Number(b.amount_paid ?? 0),
    totalBalance: Number(b.total_balance ?? 0),
    notes: b.notes ?? undefined,
    paymentAccountId: b.payment_account_id ?? "",
    isActive: b.is_active !== false, // default true if not present
    // Advanced debt details
    creditLimit: b.credit_limit != null ? Number(b.credit_limit) : undefined,
    apr: b.apr != null ? Number(b.apr) : undefined,
    monthlyFees: b.monthly_fees != null ? Number(b.monthly_fees) : undefined,
    yearlyFees: b.yearly_fees != null ? Number(b.yearly_fees) : undefined,
    lateFees: b.late_fees != null ? Number(b.late_fees) : undefined,
    idealPayment: b.ideal_payment != null ? Number(b.ideal_payment) : undefined,
  }));

  const budget: Budget = {
    id: householdId,
    month: monthISO,
    income: totalIncome, // deprecated but used by UI
    incomeEntries: incomeEntriesMapped,
    incomeSources: incomeSourcesMapped,
    categories,
    expenses,
    goals: goalsMapped,
    subscriptions: subsAvailable
      ? (subsRaw as any[]).map((s: any) => ({
          id: s.id,
          name: s.name,
          amount: Number(s.amount ?? 0),
          categoryId: s.category_id ?? "",
          nextDate: s.next_date,
          confirmed: !!s.confirmed,
          notes: s.notes ?? undefined,
          paymentAccountId: s.payment_account_id ?? undefined,
          frequency: s.frequency === "annual" ? "annual" : "monthly",
        }))
      : [],
    bills: billsMapped,
    bankAccounts: bankAccountsMapped,
    creditScores: creditScoresMapped,
    tasks: tasksMapped,
    careerProfiles: careerProfilesMapped,
    weeklySummaries: (weeklySummariesRaw ?? []).map((s: any) => ({
      id: s.id,
      householdId: s.household_id,
      weekStartDate: s.week_start_date,
      notes: s.notes,
      data: s.data,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    monthlySummaries: (monthlySummariesRaw ?? []).map((s: any) => ({
      id: s.id,
      householdId: s.household_id,
      month: s.month,
      notes: s.notes,
      data: s.data,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    // Budget thresholds from household
    expectedMonthlyIncome: Number(household?.expected_monthly_income ?? 0),
    subscriptionBudget: Number(household?.subscription_budget ?? 0),
    billsBudget: Number(household?.bills_budget ?? 0),
    expensesBudget: Number(household?.expenses_budget ?? 0),
  };

  return {
    budget,
    raw: {
      household,
      categories: cats ?? [],
      expenses: exps ?? [],
      profilesById,
      bills: bills ?? [],
    },
  };
}

// ==================== TASKS CRUD ====================

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  assignedTo?: string | null;
  tags?: string[];
  position?: number;
}

export async function fetchTasks(householdId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("household_id", householdId)
    .order("status", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(
  householdId: string,
  userId: string,
  input: CreateTaskInput,
) {
  const payload: TablesInsert<"tasks"> = {
    household_id: householdId,
    created_by: userId,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    due_date:
      input.dueDate && input.dueDate.trim() !== "" ? input.dueDate : null,
    assigned_to:
      input.assignedTo && input.assignedTo.trim() !== ""
        ? input.assignedTo
        : null,
    tags: input.tags ?? [],
    position: input.position ?? 0,
  };
  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskDb(
  id: string,
  updates: Partial<CreateTaskInput>,
) {
  const patch: TablesUpdate<"tasks"> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined)
    patch.description = updates.description;
  if (updates.status !== undefined) patch.status = updates.status as any;
  if (updates.priority !== undefined) patch.priority = updates.priority as any;
  if (updates.dueDate !== undefined)
    patch.due_date =
      updates.dueDate && updates.dueDate.trim() !== "" ? updates.dueDate : null;
  if (updates.assignedTo !== undefined)
    patch.assigned_to =
      updates.assignedTo && updates.assignedTo.trim() !== ""
        ? updates.assignedTo
        : null;
  if (updates.tags !== undefined) patch.tags = updates.tags;
  if (updates.position !== undefined) patch.position = updates.position;

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTaskDb(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTaskPositions(
  updates: { id: string; status: string; position: number }[],
) {
  if (!updates.length) return;
  const { error } = await supabase.from("tasks").upsert(
    updates.map(({ id, status, position }) => ({
      id,
      status: status as any,
      position,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

// ==================== CAREER PROFILES CRUD ====================

export interface CreateCareerProfileInput {
  currentTitle: string;
  currentCompany: string;
  startDate: string;
  employmentType?:
    | "full_time"
    | "part_time"
    | "contract"
    | "self_employed"
    | "unemployed";
  currentSalary?: number;
  linkedIncomeSourceId?: string | null;
  nextReviewDate?: string | null;
  targetRaise?: number | null;
  jobSearchActive?: boolean;
}

export async function fetchCareerProfiles(householdId: string) {
  const { data, error } = await supabase
    .from("career_profiles")
    .select("*")
    .eq("household_id", householdId)
    .order("user_id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCareerProfile(
  householdId: string,
  userId: string,
  input: CreateCareerProfileInput,
) {
  const payload: TablesInsert<"career_profiles"> = {
    household_id: householdId,
    user_id: userId,
    current_title: input.currentTitle,
    current_company: input.currentCompany,
    start_date: input.startDate,
    employment_type: input.employmentType ?? "full_time",
    current_salary: input.currentSalary ?? 0,
    linked_income_source_id: input.linkedIncomeSourceId ?? null,
    next_review_date:
      input.nextReviewDate && String(input.nextReviewDate).trim() !== ""
        ? input.nextReviewDate
        : null,
    target_raise: input.targetRaise ?? null,
    job_search_active: input.jobSearchActive ?? false,
  };
  const { data, error } = await supabase
    .from("career_profiles")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCareerProfileDb(
  id: string,
  updates: Partial<CreateCareerProfileInput>,
) {
  const patch: TablesUpdate<"career_profiles"> = {};
  if (updates.currentTitle !== undefined)
    patch.current_title = updates.currentTitle;
  if (updates.currentCompany !== undefined)
    patch.current_company = updates.currentCompany;
  if (updates.startDate !== undefined) patch.start_date = updates.startDate;
  if (updates.employmentType !== undefined)
    patch.employment_type = updates.employmentType as any;
  if (updates.currentSalary !== undefined)
    patch.current_salary = updates.currentSalary;
  if (updates.linkedIncomeSourceId !== undefined)
    patch.linked_income_source_id = updates.linkedIncomeSourceId;
  if (updates.nextReviewDate !== undefined)
    patch.next_review_date = updates.nextReviewDate;
  if (updates.targetRaise !== undefined)
    patch.target_raise = updates.targetRaise;
  if (updates.jobSearchActive !== undefined)
    patch.job_search_active = updates.jobSearchActive;

  const { data, error } = await supabase
    .from("career_profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCareerProfileDb(id: string) {
  const { error } = await supabase
    .from("career_profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ==================== SKILLS CRUD ====================

export interface CreateSkillInput {
  name: string;
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  yearsExperience?: number | null;
}

export async function fetchSkills(careerProfileId: string) {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("career_profile_id", careerProfileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSkill(
  careerProfileId: string,
  input: CreateSkillInput,
) {
  const payload: TablesInsert<"skills"> = {
    career_profile_id: careerProfileId,
    name: input.name,
    level: input.level ?? "beginner",
    years_experience: input.yearsExperience ?? 0,
  };
  const { data, error } = await supabase
    .from("skills")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSkillDb(
  id: string,
  updates: Partial<CreateSkillInput>,
) {
  const patch: TablesUpdate<"skills"> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.level !== undefined) patch.level = updates.level as any;
  if (updates.yearsExperience !== undefined)
    patch.years_experience = updates.yearsExperience;

  const { data, error } = await supabase
    .from("skills")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSkillDb(id: string) {
  const { error } = await supabase.from("skills").delete().eq("id", id);
  if (error) throw error;
}

// ==================== ACHIEVEMENTS CRUD ====================

export interface CreateAchievementInput {
  title: string;
  description?: string | null;
  date: string;
}

export async function fetchAchievements(careerProfileId: string) {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("career_profile_id", careerProfileId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAchievement(
  careerProfileId: string,
  input: CreateAchievementInput,
) {
  const payload: TablesInsert<"achievements"> = {
    career_profile_id: careerProfileId,
    title: input.title,
    description: input.description ?? "",
    date: input.date,
  };
  const { data, error } = await supabase
    .from("achievements")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAchievementDb(
  id: string,
  updates: Partial<CreateAchievementInput>,
) {
  const patch: TablesUpdate<"achievements"> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined)
    patch.description = updates.description;
  if (updates.date !== undefined) patch.date = updates.date;

  const { data, error } = await supabase
    .from("achievements")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAchievementDb(id: string) {
  const { error } = await supabase.from("achievements").delete().eq("id", id);
  if (error) throw error;
}

// ==================== CAREER GOALS CRUD ====================

export interface CreateCareerGoalInput {
  title: string;
  description?: string | null;
  targetDate?: string | null;
  status?: "planning" | "in_progress" | "completed";
}

export async function fetchCareerGoals(careerProfileId: string) {
  const { data, error } = await supabase
    .from("career_goals")
    .select("*")
    .eq("career_profile_id", careerProfileId)
    .order("status", { ascending: true })
    .order("target_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCareerGoal(
  careerProfileId: string,
  input: CreateCareerGoalInput,
) {
  const payload: TablesInsert<"career_goals"> = {
    career_profile_id: careerProfileId,
    title: input.title,
    description: input.description ?? "",
    target_date: input.targetDate ?? null,
    status: input.status ?? "planning",
  };
  const { data, error } = await supabase
    .from("career_goals")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCareerGoalDb(
  id: string,
  updates: Partial<CreateCareerGoalInput>,
) {
  const patch: TablesUpdate<"career_goals"> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined)
    patch.description = updates.description;
  if (updates.targetDate !== undefined) patch.target_date = updates.targetDate;
  if (updates.status !== undefined) patch.status = updates.status as any;

  const { data, error } = await supabase
    .from("career_goals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCareerGoalDb(id: string) {
  const { error } = await supabase.from("career_goals").delete().eq("id", id);
  if (error) throw error;
}

// ==================== SUMMARIES CRUD ====================

export interface CreateWeeklySummaryInput {
  weekStartDate: string;
  notes?: string;
  data?: any;
}

export async function fetchWeeklySummaries(householdId: string) {
  const { data, error } = await supabase
    .from("weekly_summaries" as any)
    .select("*")
    .eq("household_id", householdId)
    .order("week_start_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWeeklySummary(
  householdId: string,
  input: CreateWeeklySummaryInput,
) {
  const payload: any = {
    household_id: householdId,
    week_start_date: input.weekStartDate,
    notes: input.notes ?? "",
    data: input.data ?? {},
  };
  const { data, error } = await supabase
    .from("weekly_summaries" as any)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateWeeklySummary(
  id: string,
  updates: Partial<CreateWeeklySummaryInput>,
) {
  const patch: any = {};
  if (updates.weekStartDate !== undefined)
    patch.week_start_date = updates.weekStartDate;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.data !== undefined) patch.data = updates.data;

  const { data, error } = await supabase
    .from("weekly_summaries" as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeeklySummary(id: string) {
  const { error } = await supabase
    .from("weekly_summaries" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export interface CreateMonthlySummaryInput {
  month: string;
  notes?: string;
  data?: any;
}

export async function fetchMonthlySummaries(householdId: string) {
  const { data, error } = await supabase
    .from("monthly_summaries" as any)
    .select("*")
    .eq("household_id", householdId)
    .order("month", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMonthlySummary(
  householdId: string,
  input: CreateMonthlySummaryInput,
) {
  const payload: any = {
    household_id: householdId,
    month: input.month,
    notes: input.notes ?? "",
    data: input.data ?? {},
  };
  const { data, error } = await supabase
    .from("monthly_summaries" as any)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMonthlySummary(
  id: string,
  updates: Partial<CreateMonthlySummaryInput>,
) {
  const patch: any = {};
  if (updates.month !== undefined) patch.month = updates.month;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.data !== undefined) patch.data = updates.data;

  const { data, error } = await supabase
    .from("monthly_summaries" as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMonthlySummary(id: string) {
  const { error } = await supabase
    .from("monthly_summaries" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Quarterly Summaries ───────────────────────────────────────────────────────

export interface CreateQuarterlySummaryInput {
  householdId: string;
  period: string;
  notes?: string;
  data?: Record<string, unknown>;
}

export async function fetchQuarterlySummaries(householdId: string) {
  const { data, error } = await supabase
    .from("quarterly_summaries")
    .select("*")
    .eq("household_id", householdId)
    .order("period", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertQuarterlySummary(
  input: CreateQuarterlySummaryInput,
) {
  const { data, error } = await supabase
    .from("quarterly_summaries")
    .upsert(
      {
        household_id: input.householdId,
        period: input.period,
        notes: input.notes ?? null,
        data: input.data ?? {},
      },
      { onConflict: "household_id,period" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuarterlySummary(id: string) {
  const { error } = await supabase
    .from("quarterly_summaries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
