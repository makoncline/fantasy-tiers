"""Score saved return probabilities against completed canonical mock boards."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import statistics

from experiment_statistics import paired_interval


def score(records):
    if not records:
        return {"count": 0}
    return {
        "count": len(records),
        "brier": statistics.mean((p - y) ** 2 for p, y in records),
        "logLoss": statistics.mean(-math.log(max(1e-12, min(1 - 1e-12, p if y else 1 - p))) for p, y in records),
        "meanPrediction": statistics.mean(p for p, _ in records),
        "observedSurvival": statistics.mean(y for _, y in records),
    }


def observations(log, artifact):
    decisions = log["decisions"]
    if artifact["summary"]["status"] != "complete":
        raise ValueError("Availability evaluation needs a complete draft.")
    for current, following in zip(decisions, decisions[1:]):
        if following["pickNo"] <= current["pickNo"]:
            raise ValueError("Decision picks must be strictly increasing.")
        intervening = {pick["player_id"] for pick in artifact["sleeper"]["picks"]
                       if current["pickNo"] < pick["pick_no"] < following["pickNo"]}
        distance = following["pickNo"] - current["pickNo"] - 1
        for candidate in current["topOptions"]:
            p = candidate["comebackProbability"]
            if candidate["playerId"] == current["selected"]["playerId"] or p is None:
                continue
            if not 0 <= p <= 1:
                raise ValueError("Invalid survival probability.")
            yield {"p": p, "y": int(candidate["playerId"] not in intervening),
                   "position": candidate["position"], "distance": distance,
                   "round": current["round"]}


def evaluate(batch_path):
    batch = json.loads(Path(batch_path).read_text())
    groups = defaultdict(list)
    board_scores = []
    for run in batch["runs"]:
        log = json.loads(Path(run["decisionsPath"]).read_text())
        artifact = json.loads(Path(run["draftResultPath"]).read_text())
        records = list(observations(log, artifact))
        board_scores.append(score([(r["p"], r["y"]) for r in records]))
        for row in records:
            distance = row["distance"]
            wait = "0-3" if distance <= 3 else "4-7" if distance <= 7 else "8-12" if distance <= 12 else "13+"
            keys = ["all", f"wait:{wait}", f"position:{row['position']}",
                    f"phase:{'early' if row['round'] <= 4 else 'middle' if row['round'] <= 9 else 'late'}",
                    f"calibration:{min(9, int(row['p'] * 10)) / 10:.1f}-{min(10, int(row['p'] * 10) + 1) / 10:.1f}"]
            for key in keys:
                groups[key].append((row["p"], row["y"]))
    return {"batch": str(batch_path), "boards": len(batch["runs"]), "botStrategy": batch["args"]["botStrategy"],
            "method": "Saved top-30 legal recommendations, excluding the selected player and final own pick. Outcome is availability immediately before the next own pick. Picks at the next own turn count as survived. These are correlated candidate observations on simulated boards, not independent live calibration evidence.",
            "groups": {key: score(values) for key, values in sorted(groups.items())},
            "boardScores": board_scores}


def evaluate_prototype(file):
    experiment = json.loads(Path(file).read_text())
    groups = defaultdict(list)
    for row in experiment["rows"]:
        if any(not 0 <= row[model] <= 1 for model in ["current", "platform", "roster"]):
            raise ValueError("Invalid model probability.")
        distance = row["distance"]
        wait = "0-3" if distance <= 3 else "4-7" if distance <= 7 else "8-12" if distance <= 12 else "13+"
        for key in ["all", f"wait:{wait}", f"position:{row['position']}"]:
            groups[key].append(row)
    boards = defaultdict(list)
    for row in experiment["rows"]:
        boards[row["board"]].append(row)
    deltas = [statistics.mean((r["roster"] - r["observed"]) ** 2 -
                              (r["current"] - r["observed"]) ** 2 for r in rows)
              for rows in boards.values()]
    return {"method": experiment["method"], "samples": experiment["samples"],
            "rosterVsCurrentBoardBootstrapBrierDelta": paired_interval(deltas) if len(deltas) > 1 else {
                "meanDelta": statistics.mean(deltas) if deltas else None,
                "interval": None,
                "reason": "At least two independent boards are required to estimate between-board uncertainty.",
            },
            "boards": len(experiment["inputs"]),
            "groups": {key: {model: score([(r[model], r["observed"]) for r in rows])
                              for model in ["current", "platform", "roster"]}
                       for key, rows in sorted(groups.items())}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batch")
    parser.add_argument("--output", required=True)
    parser.add_argument("--prototype", action="store_true")
    args = parser.parse_args()
    report = evaluate_prototype(args.batch) if args.prototype else evaluate(args.batch)
    Path(args.output).write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"boards": report["boards"], "groups": report["groups"]}, indent=2))


if __name__ == "__main__":
    main()
