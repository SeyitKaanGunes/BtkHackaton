import { BadRequestException, Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import type { Transaction } from "@fintwin/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

const CATEGORY_KINDS = new Set<Transaction["type"]>(["income", "expense"]);

@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list(@Query("kind") kind?: string) {
    return this.store.getCategories(optionalKind(kind));
  }

  @Post()
  create(@Body() body: { name?: unknown; kind?: unknown; color?: unknown }) {
    return this.store.ensureCategory({
      name: requiredText(body.name, "name"),
      kind: requiredKind(body.kind),
      color: optionalColor(body.color)
    });
  }
}

function optionalKind(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredKind(value);
}

function requiredKind(value: unknown): Transaction["type"] {
  if (typeof value !== "string" || !CATEGORY_KINDS.has(value as Transaction["type"])) {
    throw new BadRequestException("kind income veya expense olmalı.");
  }
  return value as Transaction["type"];
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} zorunlu.`);
  }
  return value.trim();
}

function optionalColor(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value.trim())) {
    throw new BadRequestException("color #RRGGBB formatında olmalı.");
  }
  return value.trim();
}
