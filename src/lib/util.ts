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
    "hollywood brown": "marquise brown",
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

// other possible replacements
// Patrick Mahomes	Patrick Mahomes II
// Anthony Richardson	Anthony Richardson Sr.
// Aaron Jones	Aaron Jones Sr.
// Travis Etienne	Travis Etienne Jr.
// Gus Edwards
// Pierre Strong Jr.
// Chris Rodriguez	Chris Rodriguez Jr.
// Chigoziem Okonkwo	Chig Okonkwo
// Kyle Pitts	Kyle Pitts Sr.
// Donald Parham
// D.J. Moore	DJ Moore
// D.K. Metcalf	DK Metcalf
// Deebo Samuel	Deebo Samuel Sr.
// Gabriel Davis	Gabe Davis
// Tyler Boyd
// Nelson Agholor
// D.J. Chark Jr.	DJ Chark Jr.
// John Metchie	John Metchie III
// Mecole Hardman	Mecole Hardman Jr.
// Laviska Shenault	Laviska Shenault Jr.
// Mike Williams	Mike Williams

export const normalizePosition = (position: string) => {
  return position === "DST" ? "DEF" : position;
};
