import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import {
  accounts,
  actions,
  budgets,
  business,
  businessCashEvents,
  businessCustomers,
  categories,
  demoInvestmentHoldings,
  demoUser,
  goals,
  subscriptions,
  transactions
} from "@fintwin/shared";
import type {
  Account,
  ActionItem,
  Budget,
  Business,
  BusinessCashEvent,
  BusinessCustomer,
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

interface StoredUser extends UserProfile {
  passwordHash: string;
}

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
  business: Business = business;
  businessCustomers: BusinessCustomer[] = [];
  businessCashEvents: BusinessCashEvent[] = [];
  accounts: Account[] = [];
  investmentHoldings: InvestmentHolding[] = [];
  actions: ActionItem[] = [];
  transactions: Transaction[] = [];
  fcmTokens: Array<{ userId: string; token: string; platform: string }> = [];
  users: StoredUser[] = [];

  private ready = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeedData();
    await this.reload();
    this.ready = true;
  }

  getDemoUser() {
    this.assertReady();
    return this.users[0]!;
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

  async createUser(user: StoredUser) {
    this.assertReady();
    const created = await this.prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        persona: user.persona,
        monthlyIncome: user.monthlyIncome,
        payday: user.payday,
        currency: user.currency
      }
    });
    const mapped = this.mapUser(created);
    this.users.push(mapped);
    return mapped;
  }

  async addTransaction(transaction: Transaction) {
    this.assertReady();
    const created = await this.prisma.transaction.create({
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
    });
    const mapped = this.mapTransaction(created);
    this.transactions.unshift(mapped);
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
        createdAt: new Date(holding.createdAt),
        updatedAt: new Date(holding.updatedAt)
      }
    });
    const mapped = this.mapInvestmentHolding(created);
    this.investmentHoldings.unshift(mapped);
    return mapped;
  }

  async removeInvestmentHolding(id: string) {
    this.assertReady();
    const existing = this.investmentHoldings.find((holding) => holding.id === id);
    if (!existing) return undefined;
    await this.prisma.investmentHolding.delete({ where: { id } });
    this.investmentHoldings = this.investmentHoldings.filter((holding) => holding.id !== id);
    return existing;
  }

  async approveAction(id: string) {
    this.assertReady();
    const existing = this.actions.find((item) => item.id === id);
    if (!existing) return undefined;
    const updated = await this.prisma.actionItem.update({
      where: { id },
      data: { status: "approved" }
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
    const userCount = await this.prisma.user.count();
    if (userCount > 0) return;

    const passwordHash = "$2b$10$XUWXgP2dSqJbe1dTT4rC9O71yPUb4B3bVAeMzb7XHSc6uWXr6KI0m";
    await this.prisma.user.create({
      data: {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        passwordHash,
        persona: demoUser.persona,
        monthlyIncome: demoUser.monthlyIncome,
        payday: demoUser.payday,
        currency: demoUser.currency
      }
    });

    for (const account of accounts) {
      await this.prisma.account.create({
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
    }

    for (const budget of budgets) {
      await this.prisma.budget.create({
        data: {
          id: budget.id,
          userId: budget.userId,
          categoryId: budget.categoryId,
          monthlyLimit: budget.monthlyLimit
        }
      });
    }

    for (const goal of goals) {
      await this.prisma.goal.create({
        data: {
          id: goal.id,
          userId: goal.userId,
          title: goal.title,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          deadline: new Date(`${goal.deadline}T00:00:00.000Z`)
        }
      });
    }

    for (const subscription of subscriptions) {
      await this.prisma.subscription.create({
        data: {
          id: subscription.id,
          userId: subscription.userId,
          merchant: subscription.merchant,
          categoryId: subscription.categoryId,
          amount: subscription.amount,
          currency: subscription.currency,
          cadence: subscription.cadence,
          lastUsedAt: subscription.lastUsedAt ? new Date(`${subscription.lastUsedAt}T00:00:00.000Z`) : null,
          previousAmount: subscription.previousAmount
        }
      });
    }

    for (const accountTransaction of transactions) {
      await this.prisma.transaction.create({
        data: {
          id: accountTransaction.id,
          userId: accountTransaction.userId,
          accountId: accountTransaction.accountId,
          categoryId: accountTransaction.categoryId,
          merchant: accountTransaction.merchant,
          amount: accountTransaction.amount,
          currency: accountTransaction.currency,
          type: accountTransaction.type,
          occurredAt: new Date(accountTransaction.occurredAt),
          paymentMethod: accountTransaction.paymentMethod,
          tags: accountTransaction.tags ?? [],
          recurring: accountTransaction.recurring ?? false
        }
      });
    }

    for (const action of actions) {
      await this.prisma.actionItem.create({
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
    }

    await this.prisma.business.create({
      data: {
        id: business.id,
        ownerId: business.ownerUserId,
        name: business.name,
        sector: business.sector,
        cashBalance: business.cashBalance
      }
    });

    for (const customer of businessCustomers) {
      await this.prisma.businessCustomer.create({
        data: {
          id: customer.id,
          businessId: customer.businessId,
          name: customer.name,
          averageDelayDays: customer.averageDelayDays,
          invoicesPaid: customer.invoicesPaid,
          invoicesLate: customer.invoicesLate,
          outstandingAmount: customer.outstandingAmount
        }
      });
    }

    for (const event of businessCashEvents) {
      await this.prisma.businessCashEvent.create({
        data: {
          id: event.id,
          businessId: event.businessId,
          title: event.title,
          amount: event.amount,
          type: event.type,
          dueAt: new Date(`${event.dueAt}T00:00:00.000Z`)
        }
      });
    }

    for (const holding of demoInvestmentHoldings) {
      await this.prisma.investmentHolding.create({
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
          createdAt: new Date(holding.createdAt),
          updatedAt: new Date(holding.updatedAt)
        }
      });
    }
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
    this.business = businesses[0]
      ? {
          id: businesses[0].id,
          ownerUserId: businesses[0].ownerId,
          name: businesses[0].name,
          sector: businesses[0].sector,
          cashBalance: Number(businesses[0].cashBalance)
        }
      : business;
    this.businessCustomers = customers.map((customer) => ({
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      averageDelayDays: customer.averageDelayDays,
      invoicesPaid: customer.invoicesPaid,
      invoicesLate: customer.invoicesLate,
      outstandingAmount: Number(customer.outstandingAmount)
    }));
    this.businessCashEvents = cashEvents.map((event) => ({
      id: event.id,
      businessId: event.businessId,
      title: event.title,
      amount: Number(event.amount),
      type: event.type as BusinessCashEvent["type"],
      dueAt: this.dateOnly(event.dueAt)
    }));
    this.fcmTokens = fcmTokens.map((token) => ({
      userId: token.userId,
      token: token.token,
      platform: token.platform
    }));
  }

  private mapUser(user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    persona: string;
    monthlyIncome: unknown;
    payday: number;
    currency: string;
  }): StoredUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      persona: user.persona as StoredUser["persona"],
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
      createdAt: holding.createdAt.toISOString(),
      updatedAt: holding.updatedAt.toISOString()
    };
  }

  private dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private assertReady() {
    if (!this.ready) throw new DataStoreNotReadyError();
  }
}
