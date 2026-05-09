import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { StatementImportException } from "./statement-import.exception.js";

type JsonResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => unknown;
  };
};

@Catch(StatementImportException)
export class StatementImportFilter implements ExceptionFilter {
  catch(exception: StatementImportException, host: ArgumentsHost) {
    const statusCode = exception.getStatus();
    const body = exception.getResponse() as { code: string; message: string };
    const response = host.switchToHttp().getResponse<JsonResponse>();

    response.status(statusCode).json({
      statusCode,
      code: body.code,
      message: body.message
    });
  }
}
