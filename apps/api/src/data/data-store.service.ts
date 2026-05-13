import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { categories } from "@fintwin/shared";
import type {
  Account,
  AccountType,
  ActionItem,
  Budget,
  Business,
  BusinessCashEvent,
  BusinessCashEventCreateRequest,
  BusinessCreateRequest,
  BusinessCustomer,
  BusinessCustomerCreateRequest,
  Category,
  Currency,
  Goal,
  GoalCreateRequest,
  InvestmentAssetType,
  InvestmentHolding,
  Subscription,
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
          previousAmount: mapped.previousAmount ?? null
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
      lastUsedAt
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
        lastUsedAt: subscription.lastUsedAt ? new Date(`${subscription.lastUsedAt}T12:00:00.000Z`) : null
      }
    });
    const mapped = this.mapSubscription(created);
    this.subscriptions.unshift(mapped);
    return mapped;
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
      this.accounts.push({
        id: created.id,
        userId: created.userId,
        name: created.name,
        type: created.type as Account["type"],
        balance: Number(created.balance),
        currency: created.currency as Currency,
        creditLimit: created.creditLimit === null ? undefined : Number(created.creditLimit)
      });
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
    this.accounts = storedAccounts.map((account) => ({
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type as Account["type"],
      balance: Number(account.balance),
      currency: account.currency as Currency,
      creditLimit: account.creditLimit === null ? undefined : Number(account.creditLimit)
    }));
    this.budgets = storedBudgets.map((budget) => ({
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      monthlyLimit: Number(budget.monthlyLimit)
    }));
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
      previousAmount: subscription.previousAmount === null ? undefined : Number(subscription.previousAmount)
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

  private mapBudget(budget: { id: string; userId: string; categoryId: string; monthlyLimit: unknown }): Budget {
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      monthlyLimit: Number(budget.monthlyLimit)
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

function normalizeSubscriptionMerchant(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
