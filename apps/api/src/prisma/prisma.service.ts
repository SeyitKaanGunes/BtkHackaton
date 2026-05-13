import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const defaultConnectTimeoutMs = 30000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private connected = false;
  private connectionPromise?: Promise<void>;

  async onModuleInit(): Promise<void> {
    await this.ensureConnected();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.$disconnect();
  }

  async ensureConnected(): Promise<void> {
    if (this.connected) return;

    this.connectionPromise ??= withTimeout(this.connectAndValidate(), Number(process.env.PRISMA_CONNECT_TIMEOUT_MS ?? defaultConnectTimeoutMs))
      .then(() => {
        this.connected = true;
      })
      .catch((error: unknown) => {
        this.connected = false;
        this.connectionPromise = undefined;
        throw new Error(
          `Prisma database connection failed. Supabase DATABASE_URL/DIRECT_URL must be reachable before API startup. ${
            error instanceof Error ? error.message : "Unknown database error"
          }`
        );
      });

    await this.connectionPromise;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async connectAndValidate(): Promise<void> {
    await this.$connect();
    await this.$queryRawUnsafe("select 1");
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Database connection timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
