"""Descriptive statistics for paired draft experiments."""
import math
import random
import statistics

def mean(values):
    return statistics.mean(values) if values else None


def percentile(values, fraction):
    ordered = sorted(values)
    if not ordered:
        return None
    index = (len(ordered) - 1) * fraction
    lower = math.floor(index)
    return ordered[lower] + (ordered[math.ceil(index)] - ordered[lower]) * (index - lower)


def paired_interval(deltas):
    """Resample whole draft pairs, never individual picks or players."""
    rng = random.Random(20260905)
    boot = [mean(rng.choices(deltas, k=len(deltas))) for _ in range(2000)]
    return {"mean": mean(deltas), "bootstrap95": [percentile(boot, .025), percentile(boot, .975)]}


def correlation(left, right):
    if len(left) < 2 or statistics.pstdev(left) == 0 or statistics.pstdev(right) == 0:
        return None
    return statistics.correlation(left, right)


