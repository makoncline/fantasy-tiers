# Tier generation

`pnpm run fetch:tiers` uses Boris Chen's Gaussian mixture method on our current
FantasyPros draft ECR. It writes the same CSV columns and metadata files as before.
The shared ESPN and Sleeper draft UI reads the same aggregate fields. No browser
or application-server R runtime is required.

The generator uses R 4.6.1 and `mclust` 6.1.3. The data-refresh and unit-test
workflows install these versions and cache the R packages. For local data work,
install R, then install the pinned package:

```sh
Rscript -e 'install.packages("pak", repos="https://cloud.r-project.org"); pak::pkg_install("mclust@6.1.3")'
DRAFT=true FP_FETCH_PROJECTIONS=false pnpm run fetch:all
pnpm run agg:all
pnpm run validate:aggregates:ci
```

Tier generation uses `Mclust(Avg.Rank, G=k)`, with the same table limits and
requested tier counts as before. Overall tables use three coarse groups and then
10/8/8 subgroups. Empty class labels are compressed as in the upstream method.
Rows outside the table limit retain our existing final-tier-plus-one rule.
Missing average ranks or failed fits stop the refresh before publication.

The method can assign fewer occupied tiers than requested. Tier numbers can also
move backward in displayed ECR order because clustering uses average expert rank,
which does not always follow that order. Player order, ECR, ADP, projections, VAL,
and the recommendation rules are unchanged. ADJ and picks can respond to the new
tier boundaries through the existing scarcity and timing rules.

Method source: [Boris Chen ff-functions.R](https://github.com/borisachen/fftiers/blob/3b5f00b59bccd3ffbc82a893126efe378d0be132/src/ff-functions.R#L141)
and [overall grouping](https://github.com/borisachen/fftiers/blob/3b5f00b59bccd3ffbc82a893126efe378d0be132/src/main.R#L74).
Our source data and update time can differ from his website, so identical live
website tiers are not promised.

The September 8 experiment completed 288 local simulated drafts with all shared
quality gates passing. Only 7 of 2,232 baseline-path recommendations changed.
See [the experiment report](boris-tier-experiment-20260908.md). The owner selected
this method for its player grouping, not a demonstrated improvement in results.
The integration fixture preserves independent R results from that experiment.

For a hosted validation, dispatch **Fetch Fantasy Football Data** with
`validate_only=true`. The job runs the same fetch, tier generation, aggregate,
and quality checks. It uploads the resulting public aggregates but skips history
writes, commits, deployment verification, and production notifications. Runs on
branches other than `main` are always validation-only.
