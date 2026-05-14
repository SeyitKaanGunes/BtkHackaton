import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const defaultConnectTimeoutMs = 30000;
const defaultConnectAttempts = 6;
const defaultRetryDelayMs = 2500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
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

    this.connectionPromise ??= this.connectWithRetries()
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

  private async connectWithRetries(): Promise<void> {
    const attempts = parsePositiveInteger(process.env.PRISMA_CONNECT_ATTEMPTS, defaultConnectAttempts);
    const retryDelayMs = parsePositiveInteger(process.env.PRISMA_CONNECT_RETRY_DELAY_MS, defaultRetryDelayMs);
    const timeoutMs = parsePositiveInteger(process.env.PRISMA_CONNECT_TIMEOUT_MS, defaultConnectTimeoutMs);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await withTimeout(this.connectAndValidate(), timeoutMs);
        return;
      } catch (error: unknown) {
        lastError = error;
        await this.$disconnect().catch(() => undefined);
        if (attempt >= attempts) break;
        this.logger.warn(`Database connection attempt ${attempt}/${attempts} failed; retrying in ${retryDelayMs}ms. ${formatError(error)}`);
        await sleep(retryDelayMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unknown database error");
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown database error";
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

function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}
