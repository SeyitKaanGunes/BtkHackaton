import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ActionsController } from "./actions/actions.controller.js";
import { AgentController } from "./agent/agent.controller.js";
import { AgentService } from "./agent/agent.service.js";
import { QwenService } from "./ai/qwen.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { BusinessController } from "./business/business.controller.js";
import { CampaignsController } from "./campaigns/campaigns.controller.js";
import { getJwtSecret, validateApiEnvironment } from "./config/env.js";
import { DataStoreService } from "./data/data-store.service.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { DocumentsController } from "./documents/documents.controller.js";
import { DocumentsService } from "./documents/documents.service.js";
import { PdfExtractorService } from "./documents/pdf-extractor.service.js";
import { ReceiptExpenseAgentService } from "./documents/receipt-expense-agent.service.js";
import { StatementDocumentRepository } from "./documents/statement-document.repository.js";
import { StatementExpenseAgentService } from "./documents/statement-expense-agent.service.js";
import { StatementExtractorService } from "./documents/statement-extractor.service.js";
import { StatementImportFilter } from "./documents/statement-import.filter.js";
import { InvestmentsController } from "./investments/investments.controller.js";
import { TwelveDataService } from "./investments/twelve-data.service.js";
import { NotificationsController } from "./notifications/notifications.controller.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { SimulationsController } from "./simulations/simulations.controller.js";
import { SpendingDnaController } from "./spending-dna/spending-dna.controller.js";
import { SubscriptionsController } from "./subscriptions/subscriptions.controller.js";
import { TransactionsController } from "./transactions/transactions.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["apps/api/.env", ".env", "../../.env"],
      validate: validateApiEnvironment
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getJwtSecret(config),
        signOptions: { expiresIn: "7d" }
      })
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
    InvestmentsController,
    NotificationsController,
    SimulationsController,
    SpendingDnaController,
    SubscriptionsController,
    TransactionsController
  ],
  providers: [
    AgentService,
    AuthService,
    DataStoreService,
    DocumentsService,
    JwtAuthGuard,
    PdfExtractorService,
    PrismaService,
    QwenService,
    ReceiptExpenseAgentService,
    StatementDocumentRepository,
    StatementExpenseAgentService,
    StatementExtractorService,
    StatementImportFilter,
    TwelveDataService
  ]
})
export class AppModule {}
