export type UserDecisionAction = "purchased" | "delayed" | "cancelled" | "reduced_amount";

export interface UserDecisionEvent {
  scenarioId: string;
  userAction: UserDecisionAction;
  originalAmount: number;
  finalAmount?: number;
  category: string;
  timestamp: Date;
}

export interface UserDecisionEventInput {
  scenarioId: string;
  userAction: UserDecisionAction;
  originalAmount: number;
  finalAmount?: number;
  category: string;
  timestamp?: Date;
}

export interface UserDecisionEventValidationResult {
  valid: boolean;
  errors: string[];
}

const validUserDecisionActions = new Set<UserDecisionAction>(["purchased", "delayed", "cancelled", "reduced_amount"]);
let scenarioIdCounter = 0;

export function generateScenarioId(prefix = "scenario"): string {
  scenarioIdCounter += 1;
  const safePrefix = prefix.trim().replace(/[^a-z0-9_-]/gi, "-") || "scenario";
  return `${safePrefix}-${Date.now().toString(36)}-${scenarioIdCounter.toString(36)}`;
}

export function createUserDecisionEvent(input: UserDecisionEventInput): UserDecisionEvent {
  return {
    ...input,
    timestamp: input.timestamp ?? new Date()
  };
}

export function validateUserDecisionEvent(event: UserDecisionEvent): UserDecisionEventValidationResult {
  const errors: string[] = [];

  if (!event.scenarioId?.trim()) errors.push("scenarioId boş olamaz.");
  if (!validUserDecisionActions.has(event.userAction)) errors.push("userAction geçerli bir karar tipi olmalı.");
  if (!Number.isFinite(event.originalAmount) || event.originalAmount <= 0) errors.push("originalAmount pozitif olmalı.");
  if (!event.category?.trim()) errors.push("category boş olamaz.");
  if (!(event.timestamp instanceof Date) || Number.isNaN(event.timestamp.getTime())) errors.push("timestamp geçerli bir Date olmalı.");

  if (event.userAction === "reduced_amount") {
    if (event.finalAmount === undefined) {
      errors.push("reduced_amount için finalAmount gerekli.");
    } else if (!Number.isFinite(event.finalAmount) || event.finalAmount <= 0) {
      errors.push("finalAmount pozitif olmalı.");
    } else if (event.finalAmount >= event.originalAmount) {
      errors.push("reduced_amount için finalAmount originalAmount'tan küçük olmalı.");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export class InMemoryUserDecisionEventRepository {
  private readonly events: UserDecisionEvent[] = [];

  async save(event: UserDecisionEvent): Promise<UserDecisionEvent> {
    const validation = validateUserDecisionEvent(event);
    if (!validation.valid) {
      throw new Error(`Invalid user decision event: ${validation.errors.join(" ")}`);
    }
    this.events.push(event);
    return event;
  }

  async findByScenarioId(scenarioId: string): Promise<UserDecisionEvent[]> {
    return this.events.filter((event) => event.scenarioId === scenarioId);
  }

  async list(): Promise<UserDecisionEvent[]> {
    return [...this.events];
  }
}
