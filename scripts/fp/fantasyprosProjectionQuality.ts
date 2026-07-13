export type ProjectionPosition = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST";

const MIN_PROJECTION_ROWS_BY_POSITION = {
  QB: 30,
  RB: 50,
  WR: 80,
  TE: 30,
  FLEX: 100,
  K: 20,
  DST: 20,
} satisfies Record<ProjectionPosition, number>;

export function minimumProjectionRows(position: ProjectionPosition): number {
  return MIN_PROJECTION_ROWS_BY_POSITION[position];
}

export function isUsableProjectionRowCount(
  position: ProjectionPosition,
  rowCount: number
): boolean {
  return rowCount >= minimumProjectionRows(position);
}

export function isLikelyRegistrationFenced(html: string): boolean {
  return (
    html.includes('"fp_proj_fence":"show-fence"') ||
    html.includes("report-page-fence") ||
    /registrationData\s*=\s*\{[\s\S]*?["']?is_visible["']?\s*:\s*true/i.test(
      html
    )
  );
}

export function projectionQualityError({
  position,
  scoring,
  week,
  rowCount,
  html,
}: {
  position: ProjectionPosition;
  scoring: string;
  week: string;
  rowCount: number;
  html: string;
}): string {
  const minimumRows = minimumProjectionRows(position);
  const reason = isLikelyRegistrationFenced(html)
    ? "registration-fenced"
    : "unexpectedly short";
  return (
    `FantasyPros ${position} ${scoring} ${week} projection scrape returned ` +
    `${rowCount} rows; expected at least ${minimumRows}. Page appears ` +
    `${reason}; refusing to overwrite raw data.`
  );
}

export function assertUsableProjectionRows(params: {
  position: ProjectionPosition;
  scoring: string;
  week: string;
  rowCount: number;
  html: string;
}): void {
  if (isUsableProjectionRowCount(params.position, params.rowCount)) return;
  throw new Error(projectionQualityError(params));
}
