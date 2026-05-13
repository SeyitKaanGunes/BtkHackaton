import { BadRequestException, Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { categories } from "@fintwin/shared";
import {
  accounts as demoAccounts,
  actions as demoActions,
  budgets as demoBudgets,
  business as demoBusiness,
  businessCashEvents as demoBusinessCashEvents,
  businessCustomers as demoBusinessCustomers,
  demoInvestmentHoldings,
  demoUser,
  goals as demoGoals,
  subscriptions as demoSubscriptions,
  transactions as demoTransactions
} from "@fintwin/shared/dist/demo-data.js";
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

const customCategoryColors = ["#0d9488", "#2563eb", "#9333ea", "#f97316", "#be123c", "#64748b", "#16a34a"];
const fallbackPasswordHash = "$2b$10$8v4sBex/34PoLRuhaPKgpeB8YqdaptNu2rq4o0MUetVfN/VK1tcOa";
const fallbackBusinessUserId = "user-demo-business";

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

  private ready = false;
  private databaseAvailable = true;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (!this.prisma.isConnected()) {
      this.loadDemoFallback();
      this.ready = true;
      return;
    }

    await this.ensureSeedData();
    await this.reload();
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
    if (!this.databaseAvailable) {
      const created: Business = {
        id: `business-${randomUUID()}`,
        ownerUserId: userId,
        name: input.name,
        sector: input.sector,
        cashBalance: input.cashBalance ?? 0
      };
      this.businesses.push(created);
      return created;
    }

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
    if (!this.databaseAvailable) {
      const created: BusinessCustomer = {
        id: `cus-${randomUUID()}`,
        businessId,
        name: input.name,
        averageDelayDays: input.averageDelayDays ?? 0,
        invoicesPaid: input.invoicesPaid ?? 0,
        invoicesLate: input.invoicesLate ?? 0,
        outstandingAmount: input.outstandingAmount ?? 0
      };
      this.businessCustomers.push(created);
      return created;
    }

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
    if (!this.databaseAvailable) {
      const created: BusinessCashEvent = {
        id: `be-${randomUUID()}`,
        businessId,
        title: input.title,
        amount: input.amount,
        type: input.type,
        dueAt: input.dueAt
      };
      this.businessCashEvents.push(created);
      this.businessCashEvents.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
      return created;
    }

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
    if (!this.databaseAvailable) return undefined;
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
    if (!this.databaseAvailable) return undefined;
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
    if (!this.databaseAvailable) return undefined;
    const user = await this.prisma.user.findUnique({ where: { googleSubject } });
    if (!user) return undefined;
    const mapped = this.mapUser(user);
    this.users.push(mapped);
    return mapped;
  }

  async linkGoogleSubject(userId: string, googleSubject: string) {
    this.assertReady();
    if (!this.databaseAvailable) {
      const existing = this.users.find((user) => user.id === userId);
      if (!existing) throw new BadRequestException("Kullanıcı bulunamadı.");
      const mapped = { ...existing, googleSubject };
      this.users = this.users.map((user) => (user.id === userId ? mapped : user));
      return mapped;
    }

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
    if (!this.databaseAvailable) {
      this.users.push(user);
      this.addStarterAccountsToCache(user.id, user.currency);
      return user;
    }

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
    if (!this.databaseAvailable) {
      const existing = this.users.find((user) => user.id === userId);
      if (!existing) throw new BadRequestException("Kullanıcı bulunamadı.");
      const mapped = { ...existing, ...input };
      this.users = this.users.map((user) => (user.id === userId ? mapped : user));
      return mapped;
    }

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
    if (!this.databaseAvailable) {
      this.categories = [category, ...this.categories.filter((item) => item.id !== category.id)];
      return category;
    }

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
    if (!this.databaseAvailable) {
      this.transactions.unshift(transaction);
      this.accounts = this.accounts.map((account) =>
        account.id === transaction.accountId
          ? {
              ...account,
              balance: Number((account.balance + balanceDelta).toFixed(2))
            }
          : account
      );
      return transaction;
    }

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
    if (!this.databaseAvailable) {
      const mapped: Transaction = {
        ...existing,
        amount: normalizedAmount,
        currency,
        categoryId,
        recurring: true,
        tags: Array.from(new Set([...(existing.tags ?? []), AUTO_SALARY_TAG, "salary"]))
      };
      this.transactions = this.transactions.map((transaction) => (transaction.id === mapped.id ? mapped : transaction));
      this.accounts = this.accounts.map((account) =>
        account.id === mapped.accountId
          ? {
              ...account,
              balance: Number((account.balance + balanceDelta).toFixed(2))
            }
          : account
      );
      return mapped;
    }

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
    if (!this.databaseAvailable) {
      this.investmentHoldings.unshift(holding);
      return holding;
    }

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
    if (!this.databaseAvailable) {
      this.investmentHoldings = this.investmentHoldings.filter((holding) => holding.id !== id);
      return existing;
    }

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
    if (!this.databaseAvailable) {
      const mapped = { ...existing, status };
      this.actions = this.actions.map((item) => (item.id === id ? mapped : item));
      return mapped;
    }

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
    if (!this.databaseAvailable) {
      this.actions.unshift(action);
      return action;
    }

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

  async saveFcmToken(input: { userId: string; token: string; platform: string }) {
    this.assertReady();
    if (!this.databaseAvailable) {
      const mapped = { userId: input.userId, token: input.token, platform: input.platform };
      this.fcmTokens = [mapped, ...this.fcmTokens.filter((item) => item.token !== mapped.token)];
      return mapped;
    }

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

  private loadDemoFallback(): void {
    this.databaseAvailable = false;
    this.categories = [...categories];
    this.users = [
      {
        ...demoUser,
        passwordHash: fallbackPasswordHash
      },
      {
        id: fallbackBusinessUserId,
        name: "KOBİ Demo",
        email: "kobi.owner@example.com",
        persona: "business_owner",
        accountType: "business",
        monthlyIncome: 0,
        payday: 5,
        currency: "TRY",
        passwordHash: fallbackPasswordHash
      }
    ];
    this.accounts = demoAccounts.map((account) => ({ ...account }));
    this.budgets = demoBudgets.map((budget) => ({ ...budget }));
    this.goals = demoGoals.map((goal) => ({ ...goal }));
    this.subscriptions = demoSubscriptions.map((subscription) => ({ ...subscription }));
    this.transactions = demoTransactions.map((transaction) => ({ ...transaction, tags: transaction.tags ? [...transaction.tags] : undefined }));
    this.actions = demoActions.map((action) => ({ ...action }));
    this.investmentHoldings = demoInvestmentHoldings.map((holding) => ({ ...holding }));
    this.businesses = [
      {
        ...demoBusiness,
        ownerUserId: fallbackBusinessUserId,
        name: "Fintwin KOBİ Studio"
      }
    ];
    this.businessCustomers = demoBusinessCustomers.map((customer) => ({ ...customer }));
    this.businessCashEvents = demoBusinessCashEvents.map((event) => ({ ...event }));
    this.fcmTokens = [];
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

  private addStarterAccountsToCache(userId: string, currency: Currency): void {
    const starterAccounts: Account[] = [
      { id: `acc-main-${userId}`, userId, name: "Vadesiz Hesap", type: "debit", balance: 0, currency },
      { id: `acc-card-${userId}`, userId, name: "Kredi Kartı", type: "credit", balance: 0, currency, creditLimit: 0 },
      { id: `acc-save-${userId}`, userId, name: "Birikim", type: "savings", balance: 0, currency }
    ];
    this.accounts.push(...starterAccounts);
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
    this.goals = storedGoals.map((goal) => ({
      id: goal.id,
      userId: goal.userId,
      title: goal.title,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      deadline: this.dateOnly(goal.deadline)
    }));
    this.subscriptions = storedSubscriptions.map((subscription) => ({
      id: subscription.id,
      userId: subscription.userId,
      merchant: subscription.merchant,
      categoryId: subscription.categoryId,
      amount: Number(subscription.amount),
      currency: subscription.currency as Currency,
      cadence: subscription.cadence as Subscription["cadence"],
      lastUsedAt: subscription.lastUsedAt ? this.dateOnly(subscription.lastUsedAt) : undefined,
      previousAmount: subscription.previousAmount === null ? undefined : Number(subscription.previousAmount)
    }));
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

function normalizePersona(persona: string): StoredUser["persona"] {
  if (persona === "student" || persona === "young_professional" || persona === "family" || persona === "senior" || persona === "business_owner") return persona;
  return "young_professional";
}

function accountTypeFromPersona(persona: StoredUser["persona"]): AccountType {
  return persona === "business_owner" ? "business" : "personal";
}
