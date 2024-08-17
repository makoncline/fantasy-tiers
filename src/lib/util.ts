// src/lib/utils.ts
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export const normalizePlayerName = (str: string) => {
  const transformations: Record<string, string> = {
    "elijah mitchell": "eli mitchell",
    "ken walker iii": "kenneth walker",
  };

  // Apply specific name transformations if a match is found
  const normalized = transformations[str.toLowerCase()];
  if (normalized) return normalized;
  return str
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(" iii", "")
    .replace(" ii", "")
    .replace(" jr", "")
    .replace(" sr", "");
};
