import { describe, expect, it, vi } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import { StatementImportException } from "../src/documents/statement-import.exception.js";
import { StatementImportFilter } from "../src/documents/statement-import.filter.js";

describe("StatementImportFilter", () => {
  it("serializes statement import exceptions with code and message", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status })
      })
    } as unknown as ArgumentsHost;

    new StatementImportFilter().catch(new StatementImportException("STATEMENT_NO_VALID_ITEMS", "Hiç kalem yok"), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: "STATEMENT_NO_VALID_ITEMS",
      message: "Hiç kalem yok"
    });
  });
});
