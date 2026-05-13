import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { getApiPort, getCorsOrigins } from "./config/env.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = getApiPort(config);

  // Allow OCR / receipt / statement uploads carrying base64 images.
  app.use(json({ limit: "20mb" }));
  app.use(urlencoded({ limit: "20mb", extended: true }));
  app.use(helmet());

  app.enableCors({
    origin: getCorsOrigins(config),
    credentials: true
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(port);
  console.log(`Fintwin API running on port ${port}`);
}

void bootstrap();
