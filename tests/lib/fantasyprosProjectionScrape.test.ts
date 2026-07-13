import { describe, expect, it } from "vitest";
import { parseTable } from "../../scripts/fp/scrape-fantasypros";
import {
  assertUsableProjectionRows,
  isLikelyRegistrationFenced,
} from "../../scripts/fp/fantasyprosProjectionQuality";

describe("FantasyPros projection table parsing", () => {
  it("keeps grouped rushing and receiving columns distinct", () => {
    const html = `
      <table>
        <thead>
          <tr>
            <td>&nbsp;</td>
            <td colspan="3"><small><b>RUSHING</b></small></td>
            <td colspan="3"><small><b>RECEIVING</b></small></td>
            <td colspan="2"><small><b>MISC</b></small></td>
          </tr>
          <tr>
            <th>Player</th>
            <th><small>ATT</small></th>
            <th><small>YDS</small></th>
            <th><small>TDS</small></th>
            <th><small>REC</small></th>
            <th><small>YDS</small></th>
            <th><small>TDS</small></th>
            <th><small>FL</small></th>
            <th><small>FPTS</small></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <a href="/nfl/projections/jahmyr-gibbs.php">Jahmyr Gibbs</a> DET
            </td>
            <td>274.4<div class="max-cell">283.1</div><div class="min-cell">261.0</div></td>
            <td>1,379.9<div class="max-cell">1,422.0</div><div class="min-cell">1,345.0</div></td>
            <td>13.8<div class="max-cell">15.0</div><div class="min-cell">12.0</div></td>
            <td>70.9<div class="max-cell">73.0</div><div class="min-cell">67.8</div></td>
            <td>580.5<div class="max-cell">623.0</div><div class="min-cell">546.5</div></td>
            <td>4.1<div class="max-cell">5.0</div><div class="min-cell">3.4</div></td>
            <td>1.1<div class="max-cell">1.0</div><div class="min-cell">1.3</div></td>
            <td>301.5<div class="max-cell">307.3</div><div class="min-cell">295.4</div></td>
          </tr>
        </tbody>
      </table>
    `;

    const { columns, rows } = parseTable(html);

    expect(columns.map((column) => column.key)).toEqual([
      "ATT",
      "RUSHING_YDS",
      "RUSHING_TDS",
      "REC",
      "RECEIVING_YDS",
      "RECEIVING_TDS",
      "FL",
      "FPTS",
    ]);
    expect(rows[0]).toMatchObject({
      Player: "Jahmyr Gibbs",
      Team: "DET",
      PlayerFilename: "jahmyr-gibbs.php",
      ATT_AVG: "274.4",
      RUSHING_YDS_AVG: "1,379.9",
      RUSHING_TDS_AVG: "13.8",
      REC_AVG: "70.9",
      RECEIVING_YDS_AVG: "580.5",
      RECEIVING_TDS_AVG: "4.1",
      FL_AVG: "1.1",
      FPTS_AVG: "301.5",
    });
  });

  it("rejects short registration-fenced projection pages", () => {
    const html = `
      <html>
        <body>
          <div class="report-page-fence">Sign Up</div>
          <script>var registrationData = {"is_visible":true};</script>
        </body>
      </html>
    `;

    expect(isLikelyRegistrationFenced(html)).toBe(true);
    expect(() =>
      assertUsableProjectionRows({
        position: "RB",
        scoring: "STD",
        week: "draft",
        rowCount: 10,
        html,
      })
    ).toThrow(/registration-fenced/);
  });
});
