"""Compare paired canonical mock batches. All value metrics are internal proxies."""
import argparse
import json
from pathlib import Path


from experiment_statistics import mean, percentile, paired_interval, correlation


def read_batch(file):
    batch = json.loads(Path(file).read_text())
    runs = {}
    for run in batch["runs"]:
        key = (run["seed"], run["slot"])
        if key in runs:
            raise ValueError(f"Duplicate draft pair: {key}")
        log = json.loads(Path(run["decisionsPath"]).read_text())
        if log["schemaVersion"] != 2:
            raise ValueError("Use decision log version 2. Rerun older experiments.")
        if len(log["decisions"]) != log["league"]["rounds"]:
            raise ValueError(f"Incomplete decision log: {key}")
        runs[key] = (run, log)
    if not runs:
        raise ValueError("The batch has no drafts.")
    return batch, runs


def summarize(runs):
    decisions = [d for _, log in runs.values() for d in log["decisions"]]
    reaches = [d["bestLegalStaticValue"] - d["selected"]["staticValue"] for d in decisions]
    components = {key: [d["selected"]["componentScores"][key] for d in decisions]
                  for key in decisions[0]["selected"]["componentScores"]}
    return {
        "drafts": len(runs), "decisions": len(decisions),
        "reach": {str(p): percentile(reaches, p / 100) for p in [50, 75, 90, 95, 100]},
        "finalPickMeanVal": mean([log["decisions"][-1]["selected"]["staticValue"] for _, log in runs.values()]),
        "componentInfluenceSelectedPicks": {
            key: {"medianAbsolute": percentile([abs(v) for v in values], .5),
                  "p95Absolute": percentile([abs(v) for v in values], .95),
                  "correlations": {other: correlation(values, other_values)
                                   for other, other_values in components.items() if key != other}}
            for key, values in components.items()},
    }


def compare(baseline_file, candidate_file):
    baseline, before = read_batch(baseline_file)
    candidate, after = read_batch(candidate_file)
    if before.keys() != after.keys() or baseline["args"] != candidate["args"]:
        raise ValueError("Batches must have identical seeds, slots, settings, and bot policy.")
    changed = []
    core_deltas = []
    final_deltas = []
    for key, (old_run, old_log) in before.items():
        new_run, new_log = after[key]
        # This is a report creation time, not an input data timestamp.
        old_source = {k: v for k, v in old_log["sourceSnapshot"].items() if k != "aggregateGeneratedAt"}
        new_source = {k: v for k, v in new_log["sourceSnapshot"].items() if k != "aggregateGeneratedAt"}
        if old_source != new_source or old_log["league"] != new_log["league"]:
            raise ValueError(f"Mismatched input snapshot or league: {key}")
        core_deltas.append(new_run["coreStarterEcrScore"] - old_run["coreStarterEcrScore"])
        final_deltas.append(new_log["decisions"][-1]["selected"]["staticValue"] - old_log["decisions"][-1]["selected"]["staticValue"])
        same_prior_board = True
        for old, new in zip(old_log["decisions"], new_log["decisions"], strict=True):
            if old["pickNo"] != new["pickNo"]:
                raise ValueError("Decision picks do not align.")
            if old["selected"]["playerId"] != new["selected"]["playerId"]:
                changed.append({"seed": key[0], "slot": key[1], "round": old["round"],
                                "samePriorBoard": same_prior_board,
                                "before": old["selected"], "after": new["selected"],
                                "reachBefore": old["bestLegalStaticValue"] - old["selected"]["staticValue"],
                                "reachAfter": new["bestLegalStaticValue"] - new["selected"]["staticValue"]})
                same_prior_board = False
    return {
        "baseline": str(baseline_file), "candidate": str(candidate_file),
        "method": "Paired fixed-seed mocks; 2000 bootstrap samples over draft pairs. ECR and Val are internal diagnostics, not independent outcome evidence. The caller must also verify frozen source file hashes. Val differences are comparable only when the valuation model is unchanged.",
        "baselineProof": baseline["proof"], "candidateProof": candidate["proof"],
        "baselineDiagnostics": summarize(before), "candidateDiagnostics": summarize(after),
        "coreStarterEcrDelta": paired_interval(core_deltas),
        "finalPickValDelta": paired_interval(final_deltas),
        "changedPicks": len(changed), "sameBoardChangedPicks": sum(d["samePriorBoard"] for d in changed),
        "changes": changed,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline")
    parser.add_argument("candidate")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    report = compare(args.baseline, args.candidate)
    Path(args.output).write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({k: report[k] for k in ["changedPicks", "sameBoardChangedPicks", "coreStarterEcrDelta", "finalPickValDelta", "candidateProof"]}, indent=2))


if __name__ == "__main__":
    main()
