import { HttpException } from "@nestjs/common";

export type StatementErrorCode =
  | "STATEMENT_AI_NOT_CONFIGURED"
  | "STATEMENT_TEXT_EXTRACTION_FAILED"
  | "STATEMENT_OCR_FAILED"
  | "STATEMENT_JSON_PARSE_FAILED"
  | "STATEMENT_NO_VALID_ITEMS"
  | "STATEMENT_FILE_TOO_LARGE"
  | "STATEMENT_UNSUPPORTED_FILE_TYPE";

export class StatementImportException extends HttpException {
  constructor(
    public readonly code: StatementErrorCode,
    message: string,
    status = 400
  ) {
    super({ code, message }, status);
  }
}
