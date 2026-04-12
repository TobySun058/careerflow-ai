import { ZodError } from "zod";

export function toPublicErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return "We couldn't fully parse that source. Try uploading a cleaner file or paste the source text directly.";
  }

  if (
    error instanceof Error &&
    error.message.includes('"code":"invalid_type"')
  ) {
    return "We couldn't fully parse that source. Try uploading a cleaner file or paste the source text directly.";
  }

  return error instanceof Error ? error.message : fallback;
}
