export type DraftAvailabilityClass =
  | "healthy"
  | "short-term-concern"
  | "material-risk"
  | "unavailable"
  | "unknown";

export type DraftAvailability = {
  classification: DraftAvailabilityClass;
  eligible: boolean;
  penalty: number;
  status: string | null;
  notes: string | null;
  newsUpdated: number | null;
  rankingsUpdatedAt: number | null;
  rankingsMayBeStale: boolean;
  label: string;
  detail: string;
};

export function classifyDraftAvailability(input: {
  injuryStatus?: string | null;
  injuryNotes?: string | null;
  newsUpdated?: number | null;
  rankingsUpdatedAt?: number | null;
  currentRound: number;
  rounds: number;
  irSlots: number;
}): DraftAvailability {
  const status = cleanText(input.injuryStatus);
  const notes = cleanText(input.injuryNotes);
  const normalizedStatus = status?.toLowerCase() ?? "";
  const normalizedEvidence = `${normalizedStatus} ${notes?.toLowerCase() ?? ""}`;
  const classification = availabilityClass(normalizedStatus, normalizedEvidence);
  const newsUpdated = epochMillis(input.newsUpdated);
  const rankingsUpdatedAt = epochMillis(input.rankingsUpdatedAt);
  const rankingsMayBeStale =
    classification !== "healthy" &&
    classification !== "unknown" &&
    newsUpdated != null &&
    rankingsUpdatedAt != null &&
    newsUpdated > rankingsUpdatedAt;
  const penalty = availabilityPenalty({
    classification,
    currentRound: input.currentRound,
    rounds: input.rounds,
    irSlots: input.irSlots,
    rankingsMayBeStale,
  });

  return {
    classification,
    eligible: classification !== "unavailable",
    penalty,
    status,
    notes,
    newsUpdated,
    rankingsUpdatedAt,
    rankingsMayBeStale,
    ...availabilityCopy(classification, status, notes),
  };
}

function availabilityClass(
  normalizedStatus: string,
  normalizedEvidence: string
): DraftAvailabilityClass {
  if (
    /out for (the )?season|season[- ]ending|retired|deceased/.test(
      normalizedEvidence
    )
  ) {
    return "unavailable";
  }
  if (
    /(^|\b)(ir|pup|nfi|reserve|suspended|doubtful|out)(\b|$)/.test(
      normalizedStatus
    )
  ) {
    return "material-risk";
  }
  if (
    /questionable|day[- ]to[- ]day|probable|limited/.test(normalizedStatus)
  ) {
    return "short-term-concern";
  }
  if (
    !normalizedStatus ||
    normalizedStatus === "healthy" ||
    normalizedStatus === "active"
  ) {
    return "healthy";
  }
  return "unknown";
}

function availabilityPenalty(input: {
  classification: DraftAvailabilityClass;
  currentRound: number;
  rounds: number;
  irSlots: number;
  rankingsMayBeStale: boolean;
}) {
  if (input.classification === "short-term-concern") {
    return input.rankingsMayBeStale ? 2 : 1;
  }
  if (input.classification !== "material-risk") return 0;

  const lateDraft = input.currentRound > Math.ceil(input.rounds / 2);
  const stashable = input.irSlots > 0 && lateDraft;
  const basePenalty = stashable ? 5 : 9;
  return basePenalty + (input.rankingsMayBeStale ? 1 : 0);
}

function availabilityCopy(
  classification: DraftAvailabilityClass,
  status: string | null,
  notes: string | null
) {
  const evidence = [status, notes].filter((value): value is string => Boolean(value));
  const detail = evidence.length > 0 ? evidence.join(": ") : "No injury flag.";
  if (classification === "healthy") {
    return { label: "Healthy", detail };
  }
  if (classification === "short-term-concern") {
    return { label: "Short-term concern", detail };
  }
  if (classification === "material-risk") {
    return { label: "Material availability risk", detail };
  }
  if (classification === "unavailable") {
    return { label: "Unavailable", detail };
  }
  return { label: "Availability unknown", detail };
}

function cleanText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function epochMillis(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value < 1_000_000_000_000 ? value * 1_000 : value;
}
