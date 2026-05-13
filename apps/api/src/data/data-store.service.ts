import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { categories } from "@fintwin/shared";
import type {
  Account,
  AccountCreateRequest,
  AccountType,
  AccountUpdateRequest,
  ActionItem,
  Budget,
  BudgetCreateRequest,
  BudgetUpdateRequest,
  Business,
  BusinessCashEvent,
  BusinessCashEventCreateRequest,
  BusinessCreateRequest,
  BusinessCustomer,
  BusinessCustomerCreateRequest,
  Category,
  Currency,
  DecisionEvent,
  DecisionEventCreateRequest,
  Goal,
  GoalCreateRequest,
  GoalUpdateRequest,
  InvestmentAssetType,
  InvestmentHolding,
  SimulationHistoryItem,
  Subscription,
  SubscriptionUpdateRequest,
  Transaction,
  UserProfile
} from "@fintwin/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  AUTO_SALARY_TAG,
  SALARY_MERCHANT,
  isSalaryDueForMonth,
  nextSalaryMonthKey,
  parseReferenceDate,
  salaryDueDateForMonth,
  salaryMonthKey,
  salaryMonthRange,
  salaryTransactionId
} from "../transactions/salary-scheduler.js";

interface StoredUser extends UserProfile {
  passwordHash: string;
  googleSubject?: string;
}

type FinanceProfileUpdate = Partial<Pick<UserProfile, "monthlyIncome" | "payday" | "currency">>;
type SavingsGoalType = "monthly" | "yearly";

const customCategoryColors = ["#0d9488", "#2563eb", "#9333ea", "#f97316", "#be123c", "#64748b", "#16a34a"];
const defaultDatabaseStartupRetryAttempts = 6;
const defaultDatabaseStartupRetryDelayMs = 2500;
const savingsGoalTitles: Record<SavingsGoalType, string> = {
  monthly: "Aylık birikim hedefi",
  yearly: "Yıllık birikim hedefi"
};

export class DataStoreNotReadyError extends Error {
  constructor() {
    super("DataStoreService is not hydrated from the database yet.");
  }
}

@Injectable()
export class DataStoreService implements OnModuleInit {
  categories: Category[] = [];
  budgets: Budget[] = [];
  goals: Goal[] = [];
  subscriptions: Subscription[] = [];
  businesses: Business[] = [];
  businessCustomers: BusinessCustomer[] = [];
  businessCashEvents: BusinessCashEvent[] = [];
  accounts: Account[] = [];
  investmentHoldings: InvestmentHolding[] = [];
  actions: ActionItem[] = [];
  transactions: Transaction[] = [];
  fcmTokens: Array<{ userId: string; token: string; platform: string }> = [];
  users: StoredUser[] = [];

  private readonly logger = new Logger(DataStoreService.name);
  private ready = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.hydrateFromDatabaseWithRetry();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getPersonalData(userId: string) {
    this.assertReady();
    return {
      user: this.users.find((user) => user.id === userId),
      categories: this.categories,
      accounts: this.accounts.filter((account) => account.userId === userId),
      budgets: this.budgets.filter((budget) => budget.userId === userId),
      goals: this.goals.filter((goal) => goal.userId === userId),
      subscriptions: this.subscriptions.filter((subscription) => subscription.userId === userId),
      actions: this.actions.filter((action) => action.userId === userId),
      transactions: this.transactions.filter((transaction) => transaction.userId === userId),
      investmentHoldings: this.investmentHoldings.filter((holding) => holding.userId === userId)
    };
  }

  getBusinessesForUser(userId: string) {
    this.assertReady();
    return this.businesses.filter((business) => business.ownerUserId === userId);
  }

  getBusinessForUser(userId: string, businessId: string) {
    this.assertReady();
    return this.businesses.find((business) => business.id === businessId && business.ownerUserId === userId);
  }

  getBusinessCustomers(businessId: string) {
    this.assertReady();
    return this.businessCustomers.filter((customer) => customer.businessId === businessId);
  }

  getBusinessCashEvents(businessId: string) {
    this.assertReady();
    return this.businessCashEvents.filter((event) => event.businessId === businessId);
  }

  async createBusiness(userId: string, input: BusinessCreateRequest) {
    this.assertReady();
    const created = await this.prisma.business.create({
      data: {
        ownerId: userId,
        name: input.name,
        sector: input.sector,
        cashBalance: input.cashBalance ?? 0
      }
    });
    const mapped = this.mapBusiness(created);
    this.businesses.push(mapped);
    return mapped;
  }

  async addBusinessCustomer(businessId: string, input: BusinessCustomerCreateRequest) {
    this.assertReady();
    const created = await this.prisma.businessCustomer.create({
      data: {
        businessId,
        name: input.name,
        averageDelayDays: input.averageDelayDays ?? 0,
        invoicesPaid: input.invoicesPaid ?? 0,
        invoicesLate: input.invoicesLate ?? 0,
        outstandingAmount: input.outstandingAmount ?? 0
      }
    });
    const mapped = this.mapBusinessCustomer(created);
    this.businessCustomers.push(mapped);
    return mapped;
  }

  async addBusinessCashEvent(businessId: string, input: BusinessCashEventCreateRequest) {
    this.assertReady();
    const created = await this.prisma.businessCashEvent.create({
      data: {
        businessId,
        title: input.title,
        amount: input.amount,
        type: input.type,
        dueAt: new Date(input.dueAt)
      }
    });
    const mapped = this.mapBusinessCashEvent(created);
    this.businessCashEvents.push(mapped);
    this.businessCashEvents.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
    return mapped;
  }

  defaultAccountIdFor(userId: string, paymentMethod: Transaction["paymentMethod"]) {
    const accounts = this.getPersonalData(userId).accounts;
    const preferredType: Account["type"] = paymentMethod === "credit_card" ? "credit" : paymentMethod === "cash" ? "cash" : "debit";
    const account = accounts.find((item) => item.type === preferredType) ?? accounts.find((item) => item.type === "debit") ?? accounts[0];
    if (!account) {
      throw new BadRequestException("Kullanıcı için işlem yazılacak hesap bulunamadı.");
    }
    return account.id;
  }

  accountIdFor(userId: string, paymentMethod: Transaction["paymentMethod"], requestedAccountId?: string) {
    if (!requestedAccountId) return this.defaultAccountIdFor(userId, paymentMethod);
    const owned = this.getPersonalData(userId).accounts.some((account) => account.id === requestedAccountId);
    if (!owned) {
      throw new BadRequestException("Seçilen hesap bu kullanıcıya ait değil.");
    }
    return requestedAccountId;
  }

  async findUserById(id: string) {
    this.assertReady();
    const cached = this.users.find((user) => user.id === id);
    if (cached) return cached;
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return undefined;
    const mapped = this.mapUser(user);
    this.users.push(mapped);
    return mapped;
  }

  async findUserByEmail(email: string) {
    this.assertReady();
    const cached = this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (cached) return cached;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return undefined;
    const mapped = this.mapUser(user);
    this.users.push(mapped);
    return mapped;
  }

  async findUserByGoogleSubject(googleSubject: string) {
    this.assertReady();
    const cached = this.users.find((user) => user.googleSubject === googleSubject);
    if (cached) return cached;
    const user = await this.prisma.user.findUnique({ where: { googleSubject } });
    if (!user) return undefined;
    const mapped = this.mapUser(user);
    this.users.push(mapped);
    return mapped;
  }

  async linkGoogleSubject(userId: string, googleSubject: string) {
    this.assertReady();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { googleSubject }
    });
    const mapped = this.mapUser(updated);
    this.users = this.users.map((user) => (user.id === userId ? mapped : user));
    if (!this.users.some((user) => user.id === mapped.id)) this.users.push(mapped);
    return mapped;
  }

  async createUser(user: StoredUser) {
    this.assertReady();
    const created = await this.prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        googleSubject: user.googleSubject,
        passwordHash: user.passwordHash,
        persona: user.persona,
        monthlyIncome: user.monthlyIncome,
        payday: user.payday,
        currency: user.currency
      }
    });
    const mapped = this.mapUser(created);
    this.users.push(mapped);
    await this.createStarterAccounts(mapped.id, mapped.currency);
    return mapped;
  }

  async updateUserFinanceProfile(userId: string, input: FinanceProfileUpdate) {
    this.assertReady();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.monthlyIncome !== undefined ? { monthlyIncome: input.monthlyIncome } : {}),
        ...(input.payday !== undefined ? { payday: input.payday } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {})
      }
    });
    const mapped = this.mapUser(updated);
    this.users = this.users.map((user) => (user.id === userId ? { ...mapped, passwordHash: user.passwordHash } : user));
    if (!this.users.some((user) => user.id === userId)) this.users.push(mapped);
    return this.users.find((user) => user.id === userId) ?? mapped;
  }

  async createAccount(userId: string, input: AccountCreateRequest) {
    this.assertReady();
    const account = normalizeAccountInput(input);
    const created = await this.prisma.account.create({
      data: {
        userId,
        name: account.name,
        type: account.type,
        balance: account.balance,
        currency: account.currency,
        creditLimit: account.creditLimit
      }
    });
    const mapped = this.mapAccount(created);
    this.accounts.push(mapped);
    return mapped;
  }

  async updateAccount(userId: string, accountId: string, input: AccountUpdateRequest) {
    this.assertReady();
    const existing = this.accounts.find((account) => account.id === accountId && account.userId === userId);
    if (!existing) return undefined;
    const update = normalizeAccountUpdate(input);
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: update
    });
    const mapped = this.mapAccount(updated);
    this.accounts = this.accounts.map((account) => (account.id === accountId ? mapped : account));
    return mapped;
  }

  async deleteAccount(userId: string, accountId: string) {
    this.assertReady();
    const existing = this.accounts.find((account) => account.id === accountId && account.userId === userId);
    if (!existing) return undefined;
    if (this.transactions.some((transaction) => transaction.accountId === accountId)) {
      throw new BadRequestException("İşlem geçmişi olan hesap silinemez; önce bağlı işlemleri temizleyin.");
    }
    await this.prisma.account.delete({ where: { id: accountId } });
    this.accounts = this.accounts.filter((account) => account.id !== accountId);
    return existing;
  }

  async createBudget(userId: string, input: BudgetCreateRequest) {
    this.assertReady();
    const budget = this.normalizeBudgetInput(input);
    const existing = this.budgets.find((item) => item.userId === userId && item.categoryId === budget.categoryId);
    if (existing) {
      throw new BadRequestException("Bu kategori için zaten bütçe var; güncelleme endpoint'ini kullanın.");
    }
    const created = await this.prisma.budget.create({
      data: {
        userId,
        categoryId: budget.categoryId,
        monthlyLimit: budget.monthlyLimit
      }
    });
    const mapped = this.mapBudget(created);
    this.budgets.push(mapped);
    return mapped;
  }

  async updateBudget(userId: string, budgetId: string, input: BudgetUpdateRequest) {
    this.assertReady();
    const existing = this.budgets.find((budget) => budget.id === budgetId && budget.userId === userId);
    if (!existing) return undefined;
    const update = this.normalizeBudgetUpdate(input, existing);
    const duplicate = this.budgets.find((budget) => budget.userId === userId && budget.id !== budgetId && budget.categoryId === update.categoryId);
    if (duplicate) throw new BadRequestException("Bu kategori için başka bir bütçe zaten var.");
    const updated = await this.prisma.budget.update({
      where: { id: budgetId },
      data: update
    });
    const mapped = this.mapBudget(updated);
    this.budgets = this.budgets.map((budget) => (budget.id === budgetId ? mapped : budget));
    return mapped;
  }

  async deleteBudget(userId: string, budgetId: string) {
    this.assertReady();
    const existing = this.budgets.find((budget) => budget.id === budgetId && budget.userId === userId);
    if (!existing) return undefined;
    await this.prisma.budget.delete({ where: { id: budgetId } });
    this.budgets = this.budgets.filter((budget) => budget.id !== budgetId);
    return existing;
  }

  async createGoal(userId: string, input: GoalCreateRequest) {
    this.assertReady();
    const goal = normalizeGoalInput(input);
    const created = await this.prisma.goal.create({
      data: {
        userId,
        title: goal.title,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        deadline: new Date(`${goal.deadline}T12:00:00.000Z`)
      }
    });
    const mapped = this.mapGoal(created);
    this.goals.push(mapped);
    this.goals.sort((left, right) => left.deadline.localeCompare(right.deadline));
    return mapped;
  }

  async updateGoal(userId: string, goalId: string, input: GoalUpdateRequest) {
    this.assertReady();
    const existing = this.goals.find((goal) => goal.id === goalId && goal.userId === userId);
    if (!existing) return undefined;
    const update = normalizeGoalUpdate(input);
    const nextTargetAmount = update.targetAmount ?? existing.targetAmount;
    const nextCurrentAmount = update.currentAmount ?? existing.currentAmount;
    if (nextCurrentAmount > nextTargetAmount) throw new BadRequestException("currentAmount targetAmount değerinden büyük olamaz.");
    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        ...update,
        ...(update.deadline ? { deadline: new Date(`${update.deadline}T12:00:00.000Z`) } : {})
      }
    });
    const mapped = this.mapGoal(updated);
    this.goals = this.goals.map((goal) => (goal.id === goalId ? mapped : goal)).sort((left, right) => left.deadline.localeCompare(right.deadline));
    return mapped;
  }

  async deleteGoal(userId: string, goalId: string) {
    this.assertReady();
    const existing = this.goals.find((goal) => goal.id === goalId && goal.userId === userId);
    if (!existing) return undefined;
    await this.prisma.goal.delete({ where: { id: goalId } });
    this.goals = this.goals.filter((goal) => goal.id !== goalId);
    return existing;
  }

  getCategories(kind?: Transaction["type"]) {
    this.assertReady();
    const filtered = kind ? this.categories.filter((category) => category.kind === kind) : this.categories;
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name, "tr-TR"));
  }

  async ensureCategory(input: { name: string; kind: Transaction["type"]; color?: string }) {
    this.assertReady();
    const name = input.name.trim();
    if (!name) throw new BadRequestException("categoryName zorunlu.");
    const kind = input.kind;
    const normalizedName = normalizeCategoryName(name);
    const existing = this.categories.find((category) => category.kind === kind && normalizeCategoryName(category.name) === normalizedName);
    if (existing) return existing;

    const category: Category = {
      id: `cat-custom-${kind}-${slugifyCategoryName(name)}`,
      name,
      kind,
      color: input.color ?? customCategoryColor(name)
    };
    const created = await this.prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        kind: category.kind,
        color: category.color
      },
      create: category
    });
    const mapped: Category = {
      id: created.id,
      name: created.name,
      kind: created.kind as Category["kind"],
      color: created.color
    };
    this.categories = [mapped, ...this.categories.filter((item) => item.id !== mapped.id)];
    return mapped;
  }

  async addTransaction(transaction: Transaction) {
    this.assertReady();
    const balanceDelta = transaction.type === "income" ? transaction.amount : -transaction.amount;
    const [created, updatedAccount] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          id: transaction.id,
          userId: transaction.userId,
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          merchant: transaction.merchant,
          amount: transaction.amount,
          currency: transaction.currency,
          type: transaction.type,
          occurredAt: new Date(transaction.occurredAt),
          paymentMethod: transaction.paymentMethod,
          tags: transaction.tags ?? [],
          recurring: transaction.recurring ?? false
        }
      }),
      this.prisma.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: balanceDelta } }
      })
    ]);
    const mapped = this.mapTransaction(created);
    this.transactions.unshift(mapped);
    this.accounts = this.accounts.map((account) =>
      account.id === updatedAccount.id
        ? {
            ...account,
            balance: Number(updatedAccount.balance),
            creditLimit: updatedAccount.creditLimit === null ? undefined : Number(updatedAccount.creditLimit)
          }
        : account
    );
    return mapped;
  }

  async ensureMonthlySalaryTransactions(userId: string, referenceDateInput: Date | string = new Date()) {
    this.assertReady();
    const user = await this.findUserById(userId);
    if (!user || user.monthlyIncome <= 0) return [];

    const referenceDate = parseReferenceDate(referenceDateInput);
    const currentMonthKey = salaryMonthKey(referenceDate);
    const salaryCategory = await this.ensureCategory({ name: SALARY_MERCHANT, kind: "income", color: "#16a34a" });
    const autoTransactions = this.transactions
      .filter((transaction) => transaction.userId === userId && transaction.tags?.includes(AUTO_SALARY_TAG))
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const firstMonth = autoTransactions.length ? nextSalaryMonthKey(salaryMonthKey(autoTransactions.at(-1)!.occurredAt)) : currentMonthKey;
    const monthKeys = Array.from(new Set([...salaryMonthRange(firstMonth, currentMonthKey), currentMonthKey]));
    const touched: Transaction[] = [];

    for (const monthKey of monthKeys) {
      if (!isSalaryDueForMonth(monthKey, user.payday, referenceDate)) continue;
      const dueDate = salaryDueDateForMonth(monthKey, user.payday);
      const id = salaryTransactionId(userId, monthKey);
      const existing =
        this.transactions.find((transaction) => transaction.id === id) ??
        this.transactions.find((transaction) => transaction.userId === userId && transaction.tags?.includes(AUTO_SALARY_TAG) && salaryMonthKey(transaction.occurredAt) === monthKey);
      if (existing) {
        if (monthKey === currentMonthKey && (existing.amount !== user.monthlyIncome || existing.currency !== user.currency || existing.categoryId !== salaryCategory.id)) {
          touched.push(await this.updateSalaryTransaction(existing, user.monthlyIncome, user.currency, salaryCategory.id));
        }
        continue;
      }

      touched.push(
        await this.addTransaction({
          id,
          userId,
          accountId: this.accountIdFor(userId, "transfer"),
          categoryId: salaryCategory.id,
          merchant: SALARY_MERCHANT,
          amount: Number(user.monthlyIncome.toFixed(2)),
          currency: user.currency,
          type: "income",
          occurredAt: dueDate.toISOString(),
          paymentMethod: "transfer",
          tags: [AUTO_SALARY_TAG, "salary"],
          recurring: true
        })
      );
    }

    return touched;
  }

  private async updateSalaryTransaction(existing: Transaction, amount: number, currency: Currency, categoryId: string) {
    const normalizedAmount = Number(amount.toFixed(2));
    const balanceDelta = normalizedAmount - existing.amount;
    const [updated, updatedAccount] = await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: existing.id },
        data: {
          amount: normalizedAmount,
          currency,
          categoryId,
          recurring: true,
          tags: Array.from(new Set([...(existing.tags ?? []), AUTO_SALARY_TAG, "salary"]))
        }
      }),
      this.prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: balanceDelta } }
      })
    ]);
    const mapped = this.mapTransaction(updated);
    this.transactions = this.transactions.map((transaction) => (transaction.id === mapped.id ? mapped : transaction));
    this.accounts = this.accounts.map((account) =>
      account.id === updatedAccount.id
        ? {
            ...account,
            balance: Number(updatedAccount.balance),
            creditLimit: updatedAccount.creditLimit === null ? undefined : Number(updatedAccount.creditLimit)
          }
        : account
    );
    return mapped;
  }

  async addInvestmentHolding(holding: InvestmentHolding) {
    this.assertReady();
    const created = await this.prisma.investmentHolding.create({
      data: {
        id: holding.id,
        userId: holding.userId,
        symbol: holding.symbol,
        name: holding.name,
        assetType: holding.assetType,
        quantity: holding.quantity,
        averageCost: holding.averageCost,
        costCurrency: holding.costCurrency,
        exchange: holding.exchange,
        micCode: holding.micCode,
        marketCurrency: holding.marketCurrency,
        annualInterestRate: holding.annualInterestRate,
        createdAt: new Date(holding.createdAt),
        updatedAt: new Date(holding.updatedAt)
      }
    });
    const mapped = this.mapInvestmentHolding(created);
    this.investmentHoldings.unshift(mapped);
    return mapped;
  }

  async removeInvestmentHolding(id: string, userId: string) {
    this.assertReady();
    const existing = this.investmentHoldings.find((holding) => holding.id === id && holding.userId === userId);
    if (!existing) return undefined;
    await this.prisma.investmentHolding.delete({ where: { id } });
    this.investmentHoldings = this.investmentHoldings.filter((holding) => holding.id !== id);
    return existing;
  }

  async approveAction(id: string, userId: string) {
    return this.updateActionStatus(id, userId, "approved");
  }

  async dismissAction(id: string, userId: string) {
    return this.updateActionStatus(id, userId, "dismissed");
  }

  private async updateActionStatus(id: string, userId: string, status: ActionItem["status"]) {
    this.assertReady();
    const existing = this.actions.find((item) => item.id === id && item.userId === userId);
    if (!existing) return undefined;
    const updated = await this.prisma.actionItem.update({
      where: { id },
      data: { status }
    });
    const mapped = this.mapAction(updated);
    this.actions = this.actions.map((item) => (item.id === id ? mapped : item));
    return mapped;
  }

  async addAction(action: ActionItem) {
    this.assertReady();
    const created = await this.prisma.actionItem.create({
      data: {
        id: action.id,
        userId: action.userId,
        type: action.type,
        title: action.title,
        description: action.description,
        dueAt: action.dueAt ? new Date(action.dueAt) : null,
        status: action.status,
        source: action.source
      }
    });
    const mapped = this.mapAction(created);
    this.actions.unshift(mapped);
    return mapped;
  }

  async addGoal(userId: string, input: GoalCreateRequest) {
    this.assertReady();
    const title = input.title.trim();
    if (!title) throw new BadRequestException("Hedef adı zorunlu.");
    const targetAmount = positiveMoney(input.targetAmount, "targetAmount");
    const currentAmount = nonNegativeMoney(input.currentAmount ?? 0, "currentAmount");
    const deadline = normalizeDateOnly(input.deadline, "deadline");
    if (currentAmount > targetAmount) {
      throw new BadRequestException("Mevcut birikim hedef tutarını aşamaz.");
    }
    const created = await this.prisma.goal.create({
      data: {
        id: `goal-${randomUUID()}`,
        userId,
        title,
        targetAmount,
        currentAmount,
        deadline: new Date(`${deadline}T12:00:00.000Z`)
      }
    });
    const mapped = this.mapGoal(created);
    this.goals = [...this.goals, mapped].sort((left, right) => left.deadline.localeCompare(right.deadline));
    return mapped;
  }

  async upsertBudget(userId: string, input: { categoryId: string; monthlyLimit: number }) {
    this.assertReady();
    const category = this.categories.find((item) => item.id === input.categoryId && item.kind === "expense");
    if (!category) throw new BadRequestException("Geçerli bir gider kategorisi seçilmeli.");
    const monthlyLimit = nonNegativeMoney(input.monthlyLimit, "monthlyLimit");
    const existing = this.budgets.find((budget) => budget.userId === userId && budget.categoryId === category.id);
    const persisted = existing
      ? await this.prisma.budget.update({
          where: { id: existing.id },
          data: { monthlyLimit }
        })
      : await this.prisma.budget.create({
          data: {
            id: `budget-${randomUUID()}`,
            userId,
            categoryId: category.id,
            monthlyLimit
          }
        });
    const mapped = this.mapBudget(persisted);
    this.budgets = [mapped, ...this.budgets.filter((budget) => budget.id !== mapped.id)];
    return mapped;
  }

  async upsertSavingsPlan(userId: string, input: { monthlyAmount: number; yearlyAmount: number }) {
    this.assertReady();
    const monthly = await this.upsertSavingsGoal(userId, "monthly", input.monthlyAmount);
    const yearly = await this.upsertSavingsGoal(userId, "yearly", input.yearlyAmount);
    return { monthly, yearly };
  }

  private async upsertSavingsGoal(userId: string, type: SavingsGoalType, amountInput: number) {
    const targetAmount = nonNegativeMoney(amountInput, `${type}Amount`);
    const title = savingsGoalTitles[type];
    const existing = this.goals.find((goal) => goal.userId === userId && goal.title === title);
    const deadline = type === "monthly" ? endOfCurrentMonth() : endOfCurrentYear();
    const currentAmount = existing ? Math.min(existing.currentAmount, targetAmount) : 0;
    const persisted = existing
      ? await this.prisma.goal.update({
          where: { id: existing.id },
          data: {
            targetAmount,
            currentAmount,
            deadline: new Date(`${deadline}T12:00:00.000Z`)
          }
        })
      : await this.prisma.goal.create({
          data: {
            id: `goal-${type}-${randomUUID()}`,
            userId,
            title,
            targetAmount,
            currentAmount,
            deadline: new Date(`${deadline}T12:00:00.000Z`)
          }
        });
    const mapped = this.mapGoal(persisted);
    this.goals = [mapped, ...this.goals.filter((goal) => goal.id !== mapped.id)].sort((left, right) => left.deadline.localeCompare(right.deadline));
    return mapped;
  }

  async upsertSubscription(
    userId: string,
    input: Pick<Subscription, "merchant" | "categoryId" | "amount" | "currency" | "cadence" | "lastUsedAt">
  ) {
    this.assertReady();
    const merchant = input.merchant.trim();
    if (!merchant) throw new BadRequestException("subscription merchant is required.");
    const category = this.categories.find((item) => item.id === input.categoryId && item.kind === "expense");
    if (!category) throw new BadRequestException("subscription category is invalid.");
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException("subscription amount must be greater than zero.");
    const lastUsedAt = input.lastUsedAt ? normalizeDateOnly(input.lastUsedAt, "subscription lastUsedAt") : undefined;
    const existing = this.subscriptions.find(
      (subscription) =>
        subscription.userId === userId &&
        subscription.categoryId === input.categoryId &&
        normalizeSubscriptionMerchant(subscription.merchant) === normalizeSubscriptionMerchant(merchant)
    );

    if (existing) {
      const mapped: Subscription = {
        ...existing,
        merchant,
        categoryId: input.categoryId,
        amount: Number(input.amount.toFixed(2)),
        currency: input.currency,
        cadence: input.cadence,
        lastUsedAt,
        previousAmount: existing.amount !== input.amount ? existing.amount : existing.previousAmount
      };
      const updated = await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          merchant: mapped.merchant,
          categoryId: mapped.categoryId,
          amount: mapped.amount,
          currency: mapped.currency,
          cadence: mapped.cadence,
          lastUsedAt: mapped.lastUsedAt ? new Date(`${mapped.lastUsedAt}T12:00:00.000Z`) : null,
          previousAmount: mapped.previousAmount ?? null,
          status: "active",
          source: "statement"
        }
      });
      const persisted = this.mapSubscription(updated);
      this.subscriptions = this.subscriptions.map((subscription) => (subscription.id === persisted.id ? persisted : subscription));
      return persisted;
    }

    const subscription: Subscription = {
      id: `sub-${randomUUID()}`,
      userId,
      merchant,
      categoryId: input.categoryId,
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency,
      cadence: input.cadence,
      lastUsedAt,
      status: "active",
      source: "statement"
    };
    const created = await this.prisma.subscription.create({
      data: {
        id: subscription.id,
        userId,
        merchant: subscription.merchant,
        categoryId: subscription.categoryId,
        amount: subscription.amount,
        currency: subscription.currency,
        cadence: subscription.cadence,
        lastUsedAt: subscription.lastUsedAt ? new Date(`${subscription.lastUsedAt}T12:00:00.000Z`) : null,
        status: subscription.status,
        source: subscription.source
      }
    });
    const mapped = this.mapSubscription(created);
    this.subscriptions.unshift(mapped);
    return mapped;
  }

  async updateSubscription(userId: string, subscriptionId: string, input: SubscriptionUpdateRequest) {
    this.assertReady();
    const existing = this.subscriptions.find((subscription) => subscription.id === subscriptionId && subscription.userId === userId);
    if (!existing) return undefined;
    const update = normalizeSubscriptionUpdate(input);
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...(update.status ? { status: update.status } : {}),
        ...(update.nextExpectedAt !== undefined ? { nextExpectedAt: update.nextExpectedAt ? new Date(`${update.nextExpectedAt}T12:00:00.000Z`) : null } : {}),
        ...(update.note !== undefined ? { note: update.note } : {})
      }
    });
    const mapped = this.mapSubscription(updated);
    this.subscriptions = this.subscriptions.map((subscription) => (subscription.id === subscriptionId ? mapped : subscription));
    return mapped;
  }

  async saveSimulation(userId: string, kind: string, input: unknown, output: unknown) {
    this.assertReady();
    return this.prisma.simulation.create({
      data: {
        userId,
        kind,
        input: input as object,
        output: output as object
      }
    });
  }

  async listSimulationHistory(userId: string): Promise<SimulationHistoryItem[]> {
    this.assertReady();
    const rows = await this.prisma.simulation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { decisions: { orderBy: { createdAt: "desc" } } }
    });
    return rows.map((row) => this.mapSimulationHistory(row));
  }

  async recordDecisionEvent(userId: string, simulationId: string, input: DecisionEventCreateRequest): Promise<DecisionEvent | undefined> {
    this.assertReady();
    const simulation = await this.prisma.simulation.findFirst({ where: { id: simulationId, userId } });
    if (!simulation) return undefined;
    const output = asRecord(simulation.output);
    const normalized = normalizeDecisionEventInput(input, output);
    const created = await this.prisma.decisionEvent.create({
      data: {
        userId,
        simulationId,
        scenarioId: String(output.scenarioId ?? simulationId),
        userAction: normalized.userAction,
        originalAmount: normalized.originalAmount,
        finalAmount: normalized.finalAmount,
        categoryId: normalized.categoryId,
        categoryName: normalized.categoryName,
        note: normalized.note
      }
    });
    return this.mapDecisionEvent(created);
  }

  async saveAgentConversation(userId: string, input: { message: string; answer: string; evidence: unknown }) {
    this.assertReady();
    return this.prisma.agentConversation.create({
      data: {
        userId,
        message: input.message,
        answer: input.answer,
        evidence: input.evidence as object
      }
    });
  }

  async listAgentConversations(userId: string) {
    this.assertReady();
    const rows = await this.prisma.agentConversation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30
    });
    return rows.map((row) => ({
      id: row.id,
      message: row.message,
      answer: row.answer,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      createdAt: row.createdAt.toISOString()
    }));
  }

  async getAgentConversation(userId: string, id: string) {
    this.assertReady();
    const row = await this.prisma.agentConversation.findFirst({ where: { id, userId } });
    if (!row) return undefined;
    return {
      id: row.id,
      message: row.message,
      answer: row.answer,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      createdAt: row.createdAt.toISOString()
    };
  }

  async saveFcmToken(input: { userId: string; token: string; platform: string }) {
    this.assertReady();
    const saved = await this.prisma.fcmToken.upsert({
      where: { token: input.token },
      update: { userId: input.userId, platform: input.platform },
      create: input
    });
    const mapped = { userId: saved.userId, token: saved.token, platform: saved.platform };
    this.fcmTokens = [mapped, ...this.fcmTokens.filter((item) => item.token !== saved.token)];
    return mapped;
  }

  private async ensureSeedData() {
    await this.seedCategories();
  }

  private async seedCategories() {
    for (const category of categories) {
      await this.prisma.category.upsert({
        where: { id: category.id },
        update: {
          name: category.name,
          kind: category.kind,
          color: category.color
        },
        create: category
      });
    }
  }

  private async createStarterAccounts(userId: string, currency: Currency) {
    const starterAccounts: Account[] = [
      { id: `acc-main-${userId}`, userId, name: "Vadesiz Hesap", type: "debit", balance: 0, currency },
      { id: `acc-card-${userId}`, userId, name: "Kredi Kartı", type: "credit", balance: 0, currency, creditLimit: 0 },
      { id: `acc-save-${userId}`, userId, name: "Birikim", type: "savings", balance: 0, currency }
    ];

    for (const account of starterAccounts) {
      const created = await this.prisma.account.create({
        data: {
          id: account.id,
          userId: account.userId,
          name: account.name,
          type: account.type,
          balance: account.balance,
          currency: account.currency,
          creditLimit: account.creditLimit
        }
      });
      this.accounts.push(this.mapAccount(created));
    }
  }

  private async hydrateFromDatabaseWithRetry() {
    const attempts = positiveIntegerEnv("DATASTORE_DB_STARTUP_RETRY_ATTEMPTS", defaultDatabaseStartupRetryAttempts);
    const baseDelayMs = positiveIntegerEnv("DATASTORE_DB_STARTUP_RETRY_DELAY_MS", defaultDatabaseStartupRetryDelayMs);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.prisma.ensureConnected();
        await this.ensureSeedData();
        await this.reload();
        return;
      } catch (error) {
        this.ready = false;
        lastError = error;
        if (attempt === attempts) break;
        const delayMs = Math.min(baseDelayMs * attempt, 15000);
        this.logger.warn(`Database hydration attempt ${attempt}/${attempts} failed; retrying in ${delayMs}ms. ${errorMessage(error)}`);
        await delay(delayMs);
      }
    }

    throw new Error(
      `DataStoreService database hydration failed after ${attempts} attempts. Supabase DATABASE_URL/DIRECT_URL must be reachable before API startup. ${errorMessage(lastError)}`
    );
  }

  private async reload() {
    const [
      users,
      storedCategories,
      storedAccounts,
      storedBudgets,
      storedGoals,
      storedSubscriptions,
      storedTransactions,
      storedActions,
      holdings,
      businesses,
      customers,
      cashEvents,
      fcmTokens
    ] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.category.findMany({ orderBy: { id: "asc" } }),
      this.prisma.account.findMany({ orderBy: { id: "asc" } }),
      this.prisma.budget.findMany({ orderBy: { id: "asc" } }),
      this.prisma.goal.findMany({ orderBy: { deadline: "asc" } }),
      this.prisma.subscription.findMany({ orderBy: { id: "asc" } }),
      this.prisma.transaction.findMany({ orderBy: { occurredAt: "desc" } }),
      this.prisma.actionItem.findMany({ orderBy: { id: "asc" } }),
      this.prisma.investmentHolding.findMany({ orderBy: { createdAt: "desc" } }),
      this.prisma.business.findMany({ orderBy: { id: "asc" } }),
      this.prisma.businessCustomer.findMany({ orderBy: { id: "asc" } }),
      this.prisma.businessCashEvent.findMany({ orderBy: { dueAt: "asc" } }),
      this.prisma.fcmToken.findMany({ orderBy: { createdAt: "desc" } })
    ]);

    this.users = users.map((user) => this.mapUser(user));
    this.categories = storedCategories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind as Category["kind"],
      color: category.color
    }));
    this.accounts = storedAccounts.map((account) => this.mapAccount(account));
    this.budgets = storedBudgets.map((budget) => this.mapBudget(budget));
    this.goals = storedGoals.map((goal) => this.mapGoal(goal));
    this.subscriptions = storedSubscriptions.map((subscription) => this.mapSubscription(subscription));
    this.transactions = storedTransactions.map((transaction) => this.mapTransaction(transaction));
    this.actions = storedActions.map((action) => this.mapAction(action));
    this.investmentHoldings = holdings.map((holding) => this.mapInvestmentHolding(holding));
    this.businesses = businesses.map((business) => this.mapBusiness(business));
    this.businessCustomers = customers.map((customer) => this.mapBusinessCustomer(customer));
    this.businessCashEvents = cashEvents.map((event) => this.mapBusinessCashEvent(event));
    this.fcmTokens = fcmTokens.map((token) => ({
      userId: token.userId,
      token: token.token,
      platform: token.platform
    }));
  }

  private mapAccount(account: {
    id: string;
    userId: string;
    name: string;
    type: string;
    balance: unknown;
    currency: string;
    creditLimit: unknown | null;
  }): Account {
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type as Account["type"],
      balance: Number(account.balance),
      currency: account.currency as Currency,
      creditLimit: account.creditLimit === null ? undefined : Number(account.creditLimit)
    };
  }

  private mapBudget(budget: { id: string; userId: string; categoryId: string; monthlyLimit: unknown }): Budget {
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      monthlyLimit: Number(budget.monthlyLimit)
    };
  }

  private mapGoal(goal: { id: string; userId: string; title: string; targetAmount: unknown; currentAmount: unknown; deadline: Date }): Goal {
    return {
      id: goal.id,
      userId: goal.userId,
      title: goal.title,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      deadline: this.dateOnly(goal.deadline)
    };
  }

  private mapUser(user: {
    id: string;
    email: string;
    googleSubject: string | null;
    name: string;
    passwordHash: string;
    persona: string;
    monthlyIncome: unknown;
    payday: number;
    currency: string;
  }): StoredUser {
    const persona = normalizePersona(user.persona);
    return {
      id: user.id,
      email: user.email,
      googleSubject: user.googleSubject ?? undefined,
      name: user.name,
      passwordHash: user.passwordHash,
      persona,
      accountType: accountTypeFromPersona(persona),
      monthlyIncome: Number(user.monthlyIncome),
      payday: user.payday,
      currency: user.currency as Currency
    };
  }

  private mapTransaction(transaction: {
    id: string;
    userId: string;
    accountId: string;
    categoryId: string;
    merchant: string;
    amount: unknown;
    currency: string;
    type: string;
    occurredAt: Date;
    paymentMethod: string;
    tags: string[];
    recurring: boolean;
  }): Transaction {
    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      merchant: transaction.merchant,
      amount: Number(transaction.amount),
      currency: transaction.currency as Currency,
      type: transaction.type as Transaction["type"],
      occurredAt: transaction.occurredAt.toISOString(),
      paymentMethod: transaction.paymentMethod as Transaction["paymentMethod"],
      tags: transaction.tags,
      recurring: transaction.recurring
    };
  }

  private mapAction(action: {
    id: string;
    userId: string;
    type: string;
    title: string;
    description: string;
    dueAt: Date | null;
    status: string;
    source: string;
  }): ActionItem {
    return {
      id: action.id,
      userId: action.userId,
      type: action.type as ActionItem["type"],
      title: action.title,
      description: action.description,
      dueAt: action.dueAt?.toISOString(),
      status: action.status as ActionItem["status"],
      source: action.source as ActionItem["source"]
    };
  }

  private mapSubscription(subscription: {
    id: string;
    userId: string;
    merchant: string;
    categoryId: string;
    amount: unknown;
    currency: string;
    cadence: string;
    lastUsedAt: Date | null;
    previousAmount: unknown | null;
    status: string;
    nextExpectedAt: Date | null;
    note: string | null;
    source: string;
  }): Subscription {
    return {
      id: subscription.id,
      userId: subscription.userId,
      merchant: subscription.merchant,
      categoryId: subscription.categoryId,
      amount: Number(subscription.amount),
      currency: subscription.currency as Currency,
      cadence: subscription.cadence as Subscription["cadence"],
      lastUsedAt: subscription.lastUsedAt ? this.dateOnly(subscription.lastUsedAt) : undefined,
      previousAmount: subscription.previousAmount === null ? undefined : Number(subscription.previousAmount),
      status: subscription.status as Subscription["status"],
      nextExpectedAt: subscription.nextExpectedAt ? this.dateOnly(subscription.nextExpectedAt) : undefined,
      note: subscription.note ?? undefined,
      source: subscription.source as Subscription["source"]
    };
  }

  private mapDecisionEvent(event: {
    id: string;
    userId: string;
    simulationId: string;
    scenarioId: string;
    userAction: string;
    originalAmount: unknown;
    finalAmount: unknown | null;
    categoryId: string | null;
    categoryName: string | null;
    note: string | null;
    createdAt: Date;
  }): DecisionEvent {
    return {
      id: event.id,
      userId: event.userId,
      simulationId: event.simulationId,
      scenarioId: event.scenarioId,
      userAction: event.userAction as DecisionEvent["userAction"],
      originalAmount: Number(event.originalAmount),
      finalAmount: event.finalAmount === null ? undefined : Number(event.finalAmount),
      categoryId: event.categoryId ?? undefined,
      categoryName: event.categoryName ?? undefined,
      note: event.note ?? undefined,
      createdAt: event.createdAt.toISOString()
    };
  }

  private mapSimulationHistory(row: {
    id: string;
    kind: string;
    input: unknown;
    output: unknown;
    createdAt: Date;
    decisions: Array<{
      id: string;
      userId: string;
      simulationId: string;
      scenarioId: string;
      userAction: string;
      originalAmount: unknown;
      finalAmount: unknown | null;
      categoryId: string | null;
      categoryName: string | null;
      note: string | null;
      createdAt: Date;
    }>;
  }): SimulationHistoryItem {
    const input = asRecord(row.input);
    const output = asRecord(row.output);
    return {
      id: row.id,
      kind: row.kind,
      scenarioId: stringOrUndefined(output.scenarioId),
      question: stringOrUndefined(output.question) ?? stringOrUndefined(input.description) ?? "Karar senaryosu",
      amount: numberOrUndefined(input.amount),
      categoryId: stringOrUndefined(input.categoryId) ?? stringOrUndefined(output.resolvedCategoryId),
      categoryName: stringOrUndefined(output.resolvedCategoryName),
      decisionDate: stringOrUndefined(input.decisionDate),
      riskLevel: riskLevelFromOutput(output),
      emotionalDelayMinutes: numberOrUndefined(output.emotionalDelayMinutes),
      safeLimit: numberOrUndefined(output.safeLimit),
      createdAt: row.createdAt.toISOString(),
      decisionEvents: row.decisions.map((decision) => this.mapDecisionEvent(decision))
    };
  }

  private mapInvestmentHolding(holding: {
    id: string;
    userId: string;
    symbol: string;
    name: string;
    assetType: string;
    quantity: unknown;
    averageCost: unknown;
    costCurrency: string;
    exchange: string | null;
    micCode: string | null;
    marketCurrency: string | null;
    annualInterestRate: unknown | null;
    createdAt: Date;
    updatedAt: Date;
  }): InvestmentHolding {
    return {
      id: holding.id,
      userId: holding.userId,
      symbol: holding.symbol,
      name: holding.name,
      assetType: holding.assetType as InvestmentAssetType,
      quantity: Number(holding.quantity),
      averageCost: Number(holding.averageCost),
      costCurrency: holding.costCurrency as Currency,
      exchange: holding.exchange ?? undefined,
      micCode: holding.micCode ?? undefined,
      marketCurrency: holding.marketCurrency ?? undefined,
      annualInterestRate: holding.annualInterestRate === null ? undefined : Number(holding.annualInterestRate),
      createdAt: holding.createdAt.toISOString(),
      updatedAt: holding.updatedAt.toISOString()
    };
  }

  private mapBusiness(business: { id: string; ownerId: string; name: string; sector: string; cashBalance: unknown }): Business {
    return {
      id: business.id,
      ownerUserId: business.ownerId,
      name: business.name,
      sector: business.sector,
      cashBalance: Number(business.cashBalance)
    };
  }

  private mapBusinessCustomer(customer: {
    id: string;
    businessId: string;
    name: string;
    averageDelayDays: number;
    invoicesPaid: number;
    invoicesLate: number;
    outstandingAmount: unknown;
  }): BusinessCustomer {
    return {
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      averageDelayDays: customer.averageDelayDays,
      invoicesPaid: customer.invoicesPaid,
      invoicesLate: customer.invoicesLate,
      outstandingAmount: Number(customer.outstandingAmount)
    };
  }

  private mapBusinessCashEvent(event: {
    id: string;
    businessId: string;
    title: string;
    amount: unknown;
    type: string;
    dueAt: Date;
  }): BusinessCashEvent {
    return {
      id: event.id,
      businessId: event.businessId,
      title: event.title,
      amount: Number(event.amount),
      type: event.type as BusinessCashEvent["type"],
      dueAt: this.dateOnly(event.dueAt)
    };
  }

  private normalizeBudgetInput(input: BudgetCreateRequest) {
    const categoryId = requireNonEmptyText(input.categoryId, "categoryId");
    const category = this.categories.find((item) => item.id === categoryId && item.kind === "expense");
    if (!category) throw new BadRequestException("categoryId geçerli bir gider kategorisi olmalı.");
    return {
      categoryId,
      monthlyLimit: requirePositiveFiniteNumber(input.monthlyLimit, "monthlyLimit")
    };
  }

  private normalizeBudgetUpdate(input: BudgetUpdateRequest, existing: Budget) {
    const categoryId = input.categoryId === undefined ? existing.categoryId : requireNonEmptyText(input.categoryId, "categoryId");
    const category = this.categories.find((item) => item.id === categoryId && item.kind === "expense");
    if (!category) throw new BadRequestException("categoryId geçerli bir gider kategorisi olmalı.");
    return {
      categoryId,
      monthlyLimit: input.monthlyLimit === undefined ? existing.monthlyLimit : requirePositiveFiniteNumber(input.monthlyLimit, "monthlyLimit")
    };
  }

  private dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private assertReady() {
    if (!this.ready) throw new DataStoreNotReadyError();
  }
}

function normalizeCategoryName(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function slugifyCategoryName(value: string) {
  const slug = normalizeCategoryName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "kategori";
}

function customCategoryColor(name: string) {
  const charTotal = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
  return customCategoryColors[charTotal % customCategoryColors.length]!;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function positiveIntegerEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizePersona(persona: string): StoredUser["persona"] {
  if (persona === "student" || persona === "young_professional" || persona === "family" || persona === "senior" || persona === "business_owner") return persona;
  return "young_professional";
}

function accountTypeFromPersona(persona: StoredUser["persona"]): AccountType {
  return persona === "business_owner" ? "business" : "personal";
}

function normalizeDateOnly(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid date.`);
  }
  return value;
}

function positiveMoney(value: unknown, field: string) {
  const parsed = moneyValue(value, field);
  if (parsed <= 0) throw new BadRequestException(`${field} pozitif olmalı.`);
  return parsed;
}

function nonNegativeMoney(value: unknown, field: string) {
  const parsed = moneyValue(value, field);
  if (parsed < 0) throw new BadRequestException(`${field} sıfır veya pozitif olmalı.`);
  return parsed;
}

function moneyValue(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} sayı olmalı.`);
  return Number(parsed.toFixed(2));
}

function endOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function endOfCurrentYear() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 11, 31)).toISOString().slice(0, 10);
}

function requireNonEmptyText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} zorunlu.`);
  return value.trim();
}

function optionalTextValue(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new BadRequestException(`${field} metin olmalı.`);
  const text = value.trim();
  return text || null;
}

function requirePositiveFiniteNumber(value: unknown, field: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) throw new BadRequestException(`${field} pozitif sayı olmalı.`);
  return Number(numberValue.toFixed(2));
}

function optionalNonNegativeFiniteNumber(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new BadRequestException(`${field} sıfır veya pozitif sayı olmalı.`);
  return Number(numberValue.toFixed(2));
}

function optionalPositiveFiniteNumber(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  return requirePositiveFiniteNumber(value, field);
}

function requireCurrencyValue(value: unknown, field = "currency"): Currency {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (currency !== "TRY" && currency !== "USD" && currency !== "EUR") throw new BadRequestException(`${field} TRY, USD veya EUR olmalı.`);
  return currency;
}

function optionalCurrencyValue(value: unknown, fallback: Currency): Currency {
  if (value === undefined || value === null || value === "") return fallback;
  return requireCurrencyValue(value);
}

function requireAccountTypeValue(value: unknown): Account["type"] {
  if (value === "cash" || value === "debit" || value === "credit" || value === "savings") return value;
  throw new BadRequestException("type cash, debit, credit veya savings olmalı.");
}

function optionalAccountTypeValue(value: unknown): Account["type"] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireAccountTypeValue(value);
}

function normalizeAccountInput(input: AccountCreateRequest) {
  const type = requireAccountTypeValue(input.type);
  const balance = optionalNonNegativeFiniteNumber(input.balance, "balance") ?? 0;
  const creditLimit = type === "credit" ? optionalNonNegativeFiniteNumber(input.creditLimit, "creditLimit") ?? 0 : undefined;
  return {
    name: requireNonEmptyText(input.name, "name"),
    type,
    balance,
    currency: optionalCurrencyValue(input.currency, "TRY"),
    creditLimit
  };
}

function normalizeAccountUpdate(input: AccountUpdateRequest) {
  const type = optionalAccountTypeValue(input.type);
  const update: {
    name?: string;
    type?: Account["type"];
    balance?: number;
    currency?: Currency;
    creditLimit?: number | null;
  } = {};
  if (input.name !== undefined) update.name = requireNonEmptyText(input.name, "name");
  if (type) update.type = type;
  if (input.balance !== undefined) update.balance = optionalNonNegativeFiniteNumber(input.balance, "balance");
  if (input.currency !== undefined) update.currency = requireCurrencyValue(input.currency);
  if (input.creditLimit !== undefined) {
    update.creditLimit = input.creditLimit === null ? null : optionalNonNegativeFiniteNumber(input.creditLimit, "creditLimit");
  }
  if (!Object.keys(update).length) throw new BadRequestException("Güncellenecek hesap alanı yok.");
  return update;
}

function normalizeGoalInput(input: GoalCreateRequest) {
  const targetAmount = requirePositiveFiniteNumber(input.targetAmount, "targetAmount");
  const currentAmount = optionalNonNegativeFiniteNumber(input.currentAmount, "currentAmount") ?? 0;
  if (currentAmount > targetAmount) throw new BadRequestException("currentAmount targetAmount değerinden büyük olamaz.");
  return {
    title: requireNonEmptyText(input.title, "title"),
    targetAmount,
    currentAmount,
    deadline: normalizeDateOnly(requireNonEmptyText(input.deadline, "deadline"), "deadline")
  };
}

function normalizeGoalUpdate(input: GoalUpdateRequest) {
  const update: { title?: string; targetAmount?: number; currentAmount?: number; deadline?: string } = {};
  if (input.title !== undefined) update.title = requireNonEmptyText(input.title, "title");
  if (input.targetAmount !== undefined) update.targetAmount = requirePositiveFiniteNumber(input.targetAmount, "targetAmount");
  if (input.currentAmount !== undefined) update.currentAmount = optionalNonNegativeFiniteNumber(input.currentAmount, "currentAmount");
  if (input.deadline !== undefined) update.deadline = normalizeDateOnly(requireNonEmptyText(input.deadline, "deadline"), "deadline");
  if (!Object.keys(update).length) throw new BadRequestException("Güncellenecek hedef alanı yok.");
  if (update.targetAmount !== undefined && update.currentAmount !== undefined && update.currentAmount > update.targetAmount) {
    throw new BadRequestException("currentAmount targetAmount değerinden büyük olamaz.");
  }
  return update;
}

function normalizeSubscriptionUpdate(input: SubscriptionUpdateRequest) {
  const update: { status?: Subscription["status"]; nextExpectedAt?: string | null; note?: string | null } = {};
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "watching" && input.status !== "cancelled" && input.status !== "ignored") {
      throw new BadRequestException("status active, watching, cancelled veya ignored olmalı.");
    }
    update.status = input.status;
  }
  if (input.nextExpectedAt !== undefined) {
    update.nextExpectedAt = input.nextExpectedAt === null ? null : normalizeDateOnly(requireNonEmptyText(input.nextExpectedAt, "nextExpectedAt"), "nextExpectedAt");
  }
  if (input.note !== undefined) update.note = optionalTextValue(input.note, "note");
  if (!Object.keys(update).length) throw new BadRequestException("Güncellenecek abonelik alanı yok.");
  return update;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberOrUndefined(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function riskLevelFromOutput(output: Record<string, unknown>) {
  const cards = Array.isArray(output.cards) ? output.cards : [];
  const risky = cards.find((item) => asRecord(item).id === "risky");
  const risk = stringOrUndefined(asRecord(risky).riskLevel);
  return risk === "low" || risk === "medium" || risk === "high" || risk === "critical" ? risk : undefined;
}

function normalizeDecisionEventInput(input: DecisionEventCreateRequest, output: Record<string, unknown>) {
  if (input.userAction !== "bought" && input.userAction !== "delayed" && input.userAction !== "cancelled" && input.userAction !== "reduced" && input.userAction !== "planned") {
    throw new BadRequestException("userAction bought, delayed, cancelled, reduced veya planned olmalı.");
  }
  const cards = Array.isArray(output.cards) ? output.cards.map(asRecord) : [];
  const riskyCard = cards.find((card) => card.id === "risky") ?? cards[0] ?? {};
  const originalAmount = requirePositiveFiniteNumber(riskyCard.spendAmount ?? output.amount ?? 0, "originalAmount");
  const finalAmount = optionalPositiveFiniteNumber(input.finalAmount, "finalAmount");
  if (input.userAction === "reduced") {
    if (finalAmount === undefined) throw new BadRequestException("reduced kararı için finalAmount gerekli.");
    if (finalAmount >= originalAmount) throw new BadRequestException("finalAmount originalAmount değerinden küçük olmalı.");
  }
  return {
    userAction: input.userAction,
    originalAmount,
    finalAmount,
    categoryId: stringOrUndefined(output.resolvedCategoryId),
    categoryName: stringOrUndefined(output.resolvedCategoryName),
    note: optionalTextValue(input.note, "note") ?? undefined
  };
}

function normalizeSubscriptionMerchant(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
