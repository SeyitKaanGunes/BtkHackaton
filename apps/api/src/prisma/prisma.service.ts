import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const defaultConnectTimeoutMs = 8000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private connected = false;

  async onModuleInit(): Promise<void> {
    try {
      await withTimeout(this.$connect(), Number(process.env.PRISMA_CONNECT_TIMEOUT_MS ?? defaultConnectTimeoutMs));
      this.connected = true;
    } catch (error) {
      this.connected = false;
      if (process.env.NODE_ENV === "production") throw error;
      console.warn(`Prisma connection skipped; API will use local demo cache. ${error instanceof Error ? error.message : "Unknown database error"}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.$disconnect();
  }

  isConnected(): boolean {
    return this.connected;
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
