"""Audit position leaders on consecutive owner turns in saved full drafts."""

import collections
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
report = {}
for source in ("fp", "sleeper"):
    counts = collections.Counter()
    switches = []
    excluded = []
    files = sorted((root / f"position-stability-{source}").glob("*-baseline.json"))
    for file in files:
        run = json.loads(file.read_text())
        original = json.loads((root / f"source-order-{source}" / file.name).read_text())
        assert run["picks"] == original["picks"], f"Draft path changed: {file}"
        assert run["summary"]["legal"], f"Illegal roster: {file}"
        counts["turns"] += len(run["decisions"])
        for turn in run["decisions"]:
            for position, old in turn["previousPositionLeaders"].items():
                counts["comparisons"] += 1
                if old["drafted"]:
                    counts["previousPlayerDrafted"] += 1
                    continue
                counts["previousPlayerAvailable"] += 1
                new = turn["positionLeaders"].get(position)
                event = {"slot": run["summary"]["slot"], "seed": run["summary"]["seed"],
                         "pick": turn["pick"], "position": position}
                if new is None:
                    assert not old["eligible"]
                    counts["positionNoLongerEligible"] += 1
                    excluded.append({**event, "previous": old["name"]})
                elif new["id"] == old["id"]:
                    counts["sameLeader"] += 1
                else:
                    counts["leaderChangedWhileAvailable"] += 1
                    if old["components"]["risk"] != new["components"]["risk"]:
                        counts["switchWithDifferentRisk"] += 1
                    else:
                        counts["switchWithEqualRisk"] += 1
                    switches.append({**event, "previousAtCurrentTurn": old, "new": new})
    report[source] = {"drafts": len(files), "counts": dict(counts),
                      "switches": switches, "excludedPositions": excluded}
output = root / "position-stability-report.json"
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({source: {"drafts": r["drafts"], **r["counts"]}
                  for source, r in report.items()}, indent=2))
