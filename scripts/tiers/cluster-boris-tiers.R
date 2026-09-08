# Boris Chen's Mclust(Avg.Rank, G=k) method, including the 3 -> 10/8/8
# overall split. Source: borisachen/fftiers, commit 3b5f00b59bccd3ffbc82a893126efe378d0be132.
suppressPackageStartupMessages(library(mclust))
stopifnot(as.character(packageVersion("mclust")) == "6.1.3")
args <- commandArgs(trailingOnly = TRUE)
stopifnot(length(args) == 2)
values <- scan(file("stdin"), quiet = TRUE)
stopifnot(length(values) > 0, all(is.finite(values)))

cluster <- function(values, count) {
  stopifnot(length(values) >= count)
  fit <- Mclust(values, G = count)
  if (is.null(fit$classification)) stop("Mclust did not produce tier assignments")
  tiers <- fit$classification
  # Use the upstream empty-class compression, not a separate clustering policy.
  for (i in seq_len(count)) {
    if (sum(tiers == i) == 0) tiers[tiers > i] <- tiers[tiers > i] - 1
  }
  tiers
}

if (args[2] == "overall") {
  counts <- as.integer(table(cluster(values, 3)))
  stopifnot(length(counts) == 3)
  tiers <- integer(length(values))
  start <- 1
  offset <- 0
  for (section in 1:3) {
    indices <- start:(start + counts[section] - 1)
    part <- cluster(values[indices], c(10, 8, 8)[section])
    tiers[indices] <- part + offset
    offset <- offset + length(unique(part))
    start <- start + counts[section]
  }
} else {
  stopifnot(args[2] == "position")
  tiers <- cluster(values, as.integer(args[1]))
}
cat(paste(tiers, collapse = "\n"), "\n", sep = "")
