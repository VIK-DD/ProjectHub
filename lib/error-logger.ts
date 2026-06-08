import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

type ErrorDetails = {
  area: string;
  message: string;
  stack?: string | null;
  digest?: string | null;
  metadata?: Record<string, unknown>;
};

const LOG_DIR = join(process.cwd(), ".logs");
const LOG_FILE = join(LOG_DIR, "app-errors.ndjson");

function serializeUnknown(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) return value.map(serializeUnknown);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, serializeUnknown(nested)]),
    );
  }
  return value;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function errorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}

export async function logAppError(details: ErrorDetails) {
  const eventId = randomUUID();
  const entry = {
    eventId,
    timestamp: new Date().toISOString(),
    ...details,
    metadata: details.metadata ? serializeUnknown(details.metadata) : undefined,
  };

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (writeError) {
    console.error("[error-log] failed:", writeError);
  }

  return eventId;
}
