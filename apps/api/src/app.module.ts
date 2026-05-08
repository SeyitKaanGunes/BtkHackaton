import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ActionsController } from "./actions/actions.controller.js";
import { AgentController } from "./agent/agent.controller.js";
import { AgentService } from "./agent/agent.service.js";
import { QwenService } from "./ai/qwen.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { BusinessController } from "./business/business.controller.js";
import { CampaignsController } from "./campaigns/campaigns.controller.js";
import { DataStoreService } from "./data/data-store.service.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { DocumentsController } from "./documents/documents.controller.js";
import { DocumentsService } from "./documents/documents.service.js";
import { NotificationsController } from "./notifications/notifications.controller.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { SimulationsController } from "./simulations/simulations.controller.js";
import { SpendingDnaController } from "./spending-dna/spending-dna.controller.js";
import { SubscriptionsController } from "./subscriptions/subscriptions.controller.js";
import { TransactionsController } from "./transactions/transactions.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", "apps/api/.env", ".env"] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "finshadow-local-dev-secret",
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [
    ActionsController,
    AgentController,
    AuthController,
    BusinessController,
    CampaignsController,
    DashboardController,
    DocumentsController,
    NotificationsController,
    SimulationsController,
    SpendingDnaController,
    SubscriptionsController,
    TransactionsController
  ],
  providers: [AgentService, AuthService, DataStoreService, DocumentsService, PrismaService, QwenService]
})
export class AppModule {}
