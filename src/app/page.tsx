import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Database,
  Trophy,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tools = [
  {
    href: "/draft-assistant",
    title: "Draft Assistant",
    description:
      "Track your Sleeper draft, roster slots, available players, and position tables while picks are coming in.",
    action: "Open draft room",
    Icon: ClipboardList,
    testId: "home-link-draft-assistant",
    details: ["Live draft state", "Roster view", "Ranked player tables"],
  },
  {
    href: "/league-manager",
    title: "League Manager",
    description:
      "Pull your Sleeper league, evaluate roster gaps, compare position groups, and plan waiver or trade upgrades.",
    action: "Open league manager",
    Icon: UsersRound,
    testId: "home-link-league-manager",
    details: ["League lookup", "Roster optimizer", "Position tiers"],
  },
  {
    href: "/rating-history",
    title: "Rating History",
    description:
      "Review source freshness, current coverage gaps, and players who are missing now but were ranked before.",
    action: "Open data history",
    Icon: Database,
    testId: "home-link-rating-history",
    details: ["Source runs", "Coverage gaps", "Prior ratings"],
  },
];

export default function Page() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
              <Trophy className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Fantasy Tiers
              </p>
              <p className="text-base font-semibold">Season command center</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild={true}>
            <Link href="/api/rankings?scoring=PPR">API</Link>
          </Button>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
          <section className="max-w-xl">
            <Badge variant="outline" className="mb-5 rounded-md">
              2026 season prep
            </Badge>
            <h1 className="text-4xl font-semibold leading-tight text-balance sm:text-5xl">
              Draft day and roster planning start here.
            </h1>
            <p className="mt-5 max-w-prose text-base leading-7 text-muted-foreground">
              Use the draft assistant when picks are moving. Use the league
              manager when you need to understand a roster, compare positions,
              or plan the next move from Sleeper data.
            </p>
            <div className="mt-8 grid gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="font-semibold">Draft</div>
                <div className="mt-1 text-muted-foreground">Pick tracking</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="font-semibold">League</div>
                <div className="mt-1 text-muted-foreground">Roster review</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="font-semibold">Ranks</div>
                <div className="mt-1 text-muted-foreground">Tier context</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="font-semibold">Data</div>
                <div className="mt-1 text-muted-foreground">History view</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4" aria-label="Fantasy tools">
            {tools.map(({ Icon, ...tool }) => (
              <Card
                key={tool.href}
                className="rounded-lg shadow-sm transition-colors hover:bg-muted/30"
              >
                <CardHeader className="grid grid-cols-[auto_1fr] gap-4 space-y-0">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{tool.title}</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6">
                      {tool.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    {tool.details.map((detail) => (
                      <li key={detail} className="rounded-md bg-muted px-3 py-2">
                        {detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild={true} className="w-full sm:w-auto">
                    <Link href={tool.href} data-testid={tool.testId}>
                      {tool.action}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
