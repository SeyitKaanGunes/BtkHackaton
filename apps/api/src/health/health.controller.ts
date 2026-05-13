import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { DataStoreService } from "../data/data-store.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller()
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DataStoreService) private readonly store: DataStoreService
  ) {}

  @Get("health")
  health() {
    return {
      status: "ok",
      service: "fintwin-api",
      timestamp: new Date().toISOString()
    };
  }

  @Get("ready")
  ready() {
    const database = this.prisma.isConnected();
    const datastore = this.store.isReady();
    if (!database || !datastore) {
      throw new ServiceUnavailableException({
        status: "not_ready",
        database,
        datastore,
        timestamp: new Date().toISOString()
      });
    }

    return {
      status: "ready",
      database,
      datastore,
      timestamp: new Date().toISOString()
    };
  }
}
