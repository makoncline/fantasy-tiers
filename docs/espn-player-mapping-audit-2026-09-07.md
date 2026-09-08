# ESPN player mapping audit

Read-only audit of the player identities already loaded by ESPN Reader in the paused league-specific practice draft. No real-league changes were made. ESPN ranks and projections were not used.

## Results

- ESPN draft list: 1,036 players.
- Shared bundle: 3,227 unique player IDs across all position shards.
- Before correction: 1,009 unique matches, 25 unmatched records, two ambiguous names, no duplicate destination IDs.
- After correction: 1,016 unique matches, 18 unmatched records, two ambiguous names, no duplicate destination IDs.
- All 350 shared records with a non-null FP ECR average at or below 300 mapped. This count includes the position shards and is not an overall top-350 list.
- All 32 defenses mapped by mascot and position.

The audit also checked Sleeper's public player directory. Of the original 1,009 matches, 316 had the same ESPN ID, 692 had no ESPN ID, and Tyler Conklin had a different ESPN ID in Sleeper. Both records name Tyler Conklin at TE. Thus the sparse cross-ID field is not sufficient to replace name-and-position validation.

## Corrected names

| ESPN | Shared source |
| --- | --- |
| Bam Knight | Zonovan Knight |
| Mitchell Tinsley | Mitch Tinsley |
| Matthew Hibner | Matt Hibner |
| Nyheim Hines | Nyheim Miller-Hines |
| Stetson Bennett IV | Stetson Bennett |
| David Sills V | David Sills |
| Ulysses Bentley IV | Ulysses Bentley |

The adapter applies the aliases and trailing IV/V suffix normalization only at the ESPN boundary. Shared rankings, projections, and the Sleeper UI are unchanged.

Identity evidence: [Cardinals Knight profile](https://www.azcardinals.com/team/players-roster/bam-knight/), [Bengals Tinsley profile](https://www.bengals.com/team/players-roster/mitchell-tinsley/), [Ravens Hibner profile](https://www.baltimoreravens.com/team/players-roster/matt-hibner/), and the current [Sleeper player directory](https://api.sleeper.app/v1/players/nfl). The directory directly links ESPN IDs for Hines and Sills.

## Records that remain unranked

Ben VanSumeren, Travis Hunter, Kyle Juszczyk, Patrick Ricard, Tyreik McAllister, Adam Prentice, Alec Ingold, Michael Burton, Jakob Johnson, Henry Pearson, C.J. Ham, Hunter Luepke, Jack Westover, Khari Blasingame, Giovanni Ricci, Velus Jones Jr., Scott Matlock, and Riley Nowakowski have absent or different primary positions in the shared offensive bundle. Do not force a position match or invent a projection.

Sleeper lists Hunter as DB with both DB and WR fantasy eligibility. The current shared offensive bundle omits him. This is a shared source/eligibility issue, not an ESPN name alias. A known ESPN selection still counts in roster bookkeeping with null ranks and projections.

Frank Gore Jr. matches two normalized shared RB records. Chase Cota matches two shared WR IDs. These remain ambiguous; do not choose an arbitrary record. Known selections remain draft-only identities.

## Validation

Replayed all captured identity records against the corrected matching rules. The adapter integration test covers all seven corrected names, keeps each position's own shard, and verifies that a selected alias removes the shared player ID. The full mock must still finish before claiming end-to-end readiness.
