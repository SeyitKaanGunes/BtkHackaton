import { Injectable } from "@nestjs/common";
import {
  accounts,
  actions,
  budgets,
  business,
  businessCashEvents,
  businessCustomers,
  categories,
  demoUser,
  goals,
  subscriptions,
  transactions
} from "@fintwin/shared";
import type { Account, ActionItem, Transaction, UserProfile } from "@fintwin/shared";

interface StoredUser extends UserProfile {
  passwordHash: string;
}

@Injectable()
export class DataStoreService {
  readonly categories = [...categories];
  readonly budgets = [...budgets];
  readonly goals = [...goals];
  readonly subscriptions = [...subscriptions];
  readonly business = business;
  readonly businessCustomers = [...businessCustomers];
  readonly businessCashEvents = [...businessCashEvents];
  readonly accounts: Account[] = [...accounts];
  readonly actions: ActionItem[] = [...actions];
  readonly transactions: Transaction[] = [...transactions];
  readonly fcmTokens: Array<{ userId: string; token: string; platform: string }> = [];
  readonly users: StoredUser[] = [
    {
      ...demoUser,
      passwordHash: "$2b$10$XUWXgP2dSqJbe1dTT4rC9O71yPUb4B3bVAeMzb7XHSc6uWXr6KI0m"
    }
  ];

  getDemoUser() {
    return this.users[0]!;
  }

  findUserByEmail(email: string) {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: StoredUser) {
    this.users.push(user);
    return user;
  }

  addTransaction(transaction: Transaction) {
    this.transactions.unshift(transaction);
    return transaction;
  }

  approveAction(id: string) {
    const action = this.actions.find((item) => item.id === id);
    if (action) {
      action.status = "approved";
    }
    return action;
  }

  addAction(action: ActionItem) {
    this.actions.unshift(action);
    return action;
  }
}
