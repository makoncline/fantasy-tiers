"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Save,
  SkipForward,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import DraftAssistantContent from "@/app/draft-assistant/_components/DraftAssistantContent";
import {
  DraftDataStaticProvider,
  type DraftDataContextType,
} from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { Position as DraftAssistantPosition } from "@/app/draft-assistant/_lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAggregateBundle } from "@/hooks/useAggregateBundle";
import { buildRosterRequirementsFromDraftSettings } from "@/lib/draftHelpers";
import { createMockDraftResultArtifact } from "@/lib/draftResults";
import {
  useSleeperLeaguesForYear,
  useSleeperNflState,
  useSleeperUserById,
  useSleeperUserByUsername,
} from "@/hooks/useSleeper";
import { buildDraftViewModel } from "@/lib/draftState";
import { attachDraftValueMetrics } from "@/lib/draftValue";
import { draftCandidateMapFromBundle } from "@/lib/draftCandidate";
import { normalizePick } from "@/lib/normalizePick";
import {
  buildPositionTierMapFromBundle,
  toPlayerRowsFromBundle,
} from "@/lib/playerRows";
import type { PlayerWithPick } from "@/lib/types.draft";
import { scoringTypeFromReceptionPoints } from "@/lib/scoring";
import {
  type DraftedPlayer,
  type Position,
  type RosterSlot,
  type ScoringType,
} from "@/lib/schemas";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import type { SleeperLeague } from "@/lib/sleeper";
import {
  advanceUntilUserTurn,
  bundleToSimPlayers,
  createDefaultSimDraftConfig,
  createSimDraft,
  getRoundPick,
  getSimDraftSnapshot,
  makeUserPick,
  toSleeperDraftDetails,
  toSleeperDraftPicks,
  undoLastPick,
  type SimDraftConfig,
  type SimDraftPlayer,
  type SimDraftSnapshot,
  type SimDraftState,
  type SimRosterSlots,
} from "@/lib/simDraft";

const setupSchema = z.object({
  sleeperIdentifier: z.string().trim().optional(),
  teams: z.number().int().min(2).max(20),
  rounds: z.number().int().min(1).max(30),
  userSlot: z.number().int().min(1).max(20),
  scoring: z.enum(["std", "half", "ppr"]),
  draftType: z.enum(["snake", "linear"]),
  botStrategy: z.enum(["sleeper-adp-needs", "sleeper-market-v1"]),
  seed: z.string().trim().min(1),
  QB: z.number().int().min(0).max(4),
  RB: z.number().int().min(0).max(8),
  WR: z.number().int().min(0).max(8),
  TE: z.number().int().min(0).max(4),
  K: z.number().int().min(0).max(4),
  DEF: z.number().int().min(0).max(4),
  FLEX: z.number().int().min(0).max(6),
});

type SetupValues = z.infer<typeof setupSchema>;

const SaveDraftResultResponseSchema = z.object({
  ok: z.boolean(),
  resultDir: z.string().optional(),
  error: z.string().optional(),
});

type SaveResultState = {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
  resultDir?: string;
};

const defaultRosterSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DEF: 1,
  FLEX: 1,
} satisfies SimRosterSlots;

const defaultSetup = {
  sleeperIdentifier: "",
  teams: 10,
  rounds: 15,
  userSlot: 5,
  scoring: "std",
  draftType: "snake",
  botStrategy: "sleeper-market-v1",
  seed: "slot-5-2026",
  ...defaultRosterSlots,
} satisfies SetupValues;

const rosterSlotOrder = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const;

type DraftViewModel = ReturnType<typeof buildDraftViewModel>;

export default function MockDraftRoom() {
  const [lookupIdentifier, setLookupIdentifier] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState("manual");
  const [draftState, setDraftState] = useState<SimDraftState | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResultState>({
    status: "idle",
  });

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: defaultSetup,
  });

  const watched = useWatch({ control: form.control });
  const watchedTeams = watched.teams ?? defaultSetup.teams;
  const watchedRounds = watched.rounds ?? defaultSetup.rounds;
  const watchedScoring = watched.scoring ?? defaultSetup.scoring;
  const watchedRosterSlots = setupToRosterSlots(watched);
  const isUserIdLookup = /^\d+$/.test(lookupIdentifier);

  const nflState = useSleeperNflState();
  const userByUsername = useSleeperUserByUsername(
    lookupIdentifier,
    Boolean(lookupIdentifier) && !isUserIdLookup
  );
  const userById = useSleeperUserById(
    lookupIdentifier,
    Boolean(lookupIdentifier) && isUserIdLookup
  );
  const sleeperUser = isUserIdLookup ? userById.data : userByUsername.data;
  const activeSeason =
    nflState.data?.league_season ?? nflState.data?.season ?? "2026";
  const leagues = useSleeperLeaguesForYear(
    sleeperUser?.user_id,
    activeSeason,
    Boolean(sleeperUser?.user_id)
  );

  const bundle = useAggregateBundle({
    scoring: watchedScoring,
    teams: watchedTeams,
    rounds: watchedRounds,
    rosterSlots: watchedRosterSlots,
  });

  const players = useMemo(
    () => (bundle.data ? bundleToSimPlayers(bundle.data) : []),
    [bundle.data]
  );

  const snapshot = useMemo(
    () => (draftState ? getSimDraftSnapshot(draftState, players) : null),
    [draftState, players]
  );
  const draftDetails = useMemo(
    () => (draftState ? toSleeperDraftDetails(draftState) : null),
    [draftState]
  );
  const draftPicks = useMemo(
    () => (draftState ? toSleeperDraftPicks(draftState) : []),
    [draftState]
  );
  const viewModel = useMemo(() => {
    if (!draftState || !draftDetails || !bundle.data || players.length === 0) {
      return null;
    }
    return buildDraftViewModel({
      playersMap: draftCandidateMapFromBundle(bundle.data),
      draft: draftDetails,
      picks: draftPicks,
      userId: draftState.config.userId,
      topLimit: 4,
      sourceWarnings: bundle.data.sourceHealth?.warnings ?? [],
    });
  }, [bundle.data, draftDetails, draftPicks, draftState, players.length]);

  function startDraft(values: SetupValues) {
    if (players.length === 0) return;
    const config = valuesToConfig(values, {
      season: activeSeason,
      userId: sleeperUser?.user_id ?? "sim-user",
      leagueName: selectedLeagueName(selectedLeagueId, leagues.data),
    });
    const started = advanceUntilUserTurn(createSimDraft(config), players);
    setDraftState(started);
    setSaveResult({ status: "idle" });
  }

  function advanceDraft() {
    if (!draftState) {
      form.handleSubmit(startDraft)();
      return;
    }
    setDraftState(advanceUntilUserTurn(draftState, players));
    setSaveResult({ status: "idle" });
  }

  function pickPlayer(playerId: string) {
    if (!draftState || !snapshot?.isUserTurn) return;
    const picked = makeUserPick(draftState, playerId, players);
    setDraftState(picked);
    setSaveResult({ status: "idle" });
  }

  function undoPick() {
    if (!draftState) return;
    setDraftState(undoLastPick(draftState));
    setSaveResult({ status: "idle" });
  }

  function resetDraft() {
    setDraftState(null);
    setSaveResult({ status: "idle" });
  }

  async function saveDraftResult() {
    if (!draftState || !snapshot || !draftDetails) return;
    setSaveResult({ status: "saving", message: "Saving draft result..." });
    try {
      const artifact = createMockDraftResultArtifact({
        state: draftState,
        snapshot,
        players,
        draftDetails,
        draftPicks,
        viewModel,
        sourceHealth: bundle.data?.sourceHealth,
      });
      const response = await fetch("/api/draft-results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifact }),
      });
      const payload = SaveDraftResultResponseSchema.parse(await response.json());
      if (!response.ok || !payload.ok || !payload.resultDir) {
        throw new Error(payload.error ?? "Draft result save failed.");
      }
      setSaveResult({
        status: "saved",
        resultDir: payload.resultDir,
        message: `Saved to ${payload.resultDir}`,
      });
    } catch (error) {
      setSaveResult({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Draft result save failed.",
      });
    }
  }

  function applyLeague(leagueId: string) {
    setSelectedLeagueId(leagueId);
    const league = leagues.data?.find((item) => item.league_id === leagueId);
    if (!league) return;
    const imported = settingsFromLeague(league);
    form.setValue("teams", imported.teams);
    form.setValue("rounds", imported.rounds);
    form.setValue("scoring", imported.scoring);
    for (const slot of rosterSlotOrder) {
      form.setValue(slot, imported.rosterSlots[slot]);
    }
    form.setValue(
      "userSlot",
      Math.min(form.getValues("userSlot"), imported.teams)
    );
  }

  const currentPickLabel = !snapshot
    ? "Not started"
    : snapshot.currentPickNo == null
      ? "Complete"
      : `${snapshot.currentRound}.${String(snapshot.currentPickInRound).padStart(
          2,
          "0"
        )}`;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="size-4" aria-hidden="true" />
              Local draft lab
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Mock Draft Room
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Run a seeded local draft, pause on your picks, and use the same
              draft-assistant view model without opening Sleeper.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm sm:min-w-[420px]">
            <StatusTile label="Pick" value={currentPickLabel} />
            <StatusTile
              label="On Clock"
              value={
                snapshot?.onClockSlot
                  ? snapshot.onClockSlot === draftState?.config.userSlot
                    ? "You"
                    : `Team ${snapshot.onClockSlot}`
                  : "—"
              }
            />
            <StatusTile
              label="Made"
              value={`${draftPicks.length}/${watchedTeams * (watched.rounds ?? 0)}`}
            />
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <SetupPanel
            form={form}
            lookupIdentifier={lookupIdentifier}
            selectedLeagueId={selectedLeagueId}
            activeSeason={activeSeason}
            sleeperName={
              sleeperUser?.display_name ?? sleeperUser?.username ?? null
            }
            leagues={leagues.data ?? []}
            isLoadingLeagues={leagues.isLoading}
            lookupError={
              userByUsername.error?.message ??
              userById.error?.message ??
              leagues.error?.message ??
              null
            }
            bundleStatus={
              bundle.isLoading
                ? "loading"
                : bundle.error
                ? "error"
                : `${players.length} players`
            }
            canStart={players.length > 0}
            onLookup={() =>
              setLookupIdentifier(form.getValues("sleeperIdentifier") ?? "")
            }
            onApplyLeague={applyLeague}
            onStart={form.handleSubmit(startDraft)}
          />

          <div className="flex min-w-0 flex-col gap-5">
            <DraftControls
              state={draftState}
              snapshot={snapshot}
              canStart={players.length > 0}
              onStart={form.handleSubmit(startDraft)}
              onAdvance={advanceDraft}
              onUndo={undoPick}
              onReset={resetDraft}
              onSave={saveDraftResult}
              saveResult={saveResult}
            />
            <DraftBoard
              snapshot={snapshot}
              players={players}
              picks={draftPicks}
            />
          </div>
        </section>

        <MockAssistantPanel
          viewModel={viewModel}
          snapshot={snapshot}
          bundle={bundle.data}
          draftState={draftState}
          draftDetails={draftDetails}
          draftPicks={draftPicks}
          onPick={pickPlayer}
        />
      </div>
    </main>
  );
}

function SetupPanel(props: {
  form: ReturnType<typeof useForm<SetupValues>>;
  lookupIdentifier: string;
  selectedLeagueId: string;
  activeSeason: string;
  sleeperName: string | null;
  leagues: SleeperLeague[];
  isLoadingLeagues: boolean;
  lookupError: string | null;
  bundleStatus: string;
  canStart: boolean;
  onLookup: () => void;
  onApplyLeague: (leagueId: string) => void;
  onStart: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup</CardTitle>
        <CardDescription>
          Import Sleeper league shape, then run a local draft.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...props.form}>
          <form className="space-y-5" onSubmit={props.onStart}>
            <FormField
              control={props.form.control}
              name="sleeperIdentifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sleeper username or user id</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="sleeper-name" {...field} />
                    </FormControl>
                    <Button type="button" variant="secondary" onClick={props.onLookup}>
                      Load
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Season {props.activeSeason}</span>
                <span>{props.bundleStatus}</span>
              </div>
              {props.sleeperName ? (
                <div className="mt-2 text-foreground">
                  Loaded {props.sleeperName}
                </div>
              ) : props.lookupIdentifier ? (
                <div className="mt-2">Looking up Sleeper user...</div>
              ) : null}
              {props.lookupError ? (
                <div className="mt-2 text-destructive">{props.lookupError}</div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">League settings</div>
              <Select
                value={props.selectedLeagueId}
                onValueChange={props.onApplyLeague}
                disabled={!props.leagues.length || props.isLoadingLeagues}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      props.isLoadingLeagues ? "Loading leagues" : "Manual defaults"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual defaults</SelectItem>
                  {props.leagues.map((league) => (
                    <SelectItem key={league.league_id} value={league.league_id}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField form={props.form} name="teams" label="Teams" />
              <NumberField form={props.form} name="rounds" label="Rounds" />
              <NumberField form={props.form} name="userSlot" label="Draft slot" />
              <FormField
                control={props.form.control}
                name="scoring"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scoring</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="std">Standard</SelectItem>
                        <SelectItem value="half">Half PPR</SelectItem>
                        <SelectItem value="ppr">PPR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={props.form.control}
              name="draftType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Draft type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="snake">Snake</SelectItem>
                      <SelectItem value="linear">Linear</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={props.form.control}
              name="botStrategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot strategy</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sleeper-market-v1">
                        Sleeper market
                      </SelectItem>
                      <SelectItem value="sleeper-adp-needs">
                        ADP + starter needs
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-4 gap-2">
              {rosterSlotOrder.map((slot) => (
                <NumberField key={slot} form={props.form} name={slot} label={slot} />
              ))}
            </div>

            <FormField
              control={props.form.control}
              name="seed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seed</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              data-testid="mock-start"
              disabled={!props.canStart}
            >
              Start local mock
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function NumberField(props: {
  form: ReturnType<typeof useForm<SetupValues>>;
  name: keyof Pick<
    SetupValues,
    "teams" | "rounds" | "userSlot" | "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX"
  >;
  label: string;
}) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              {...field}
              onChange={(event) => field.onChange(Number(event.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function DraftControls(props: {
  state: SimDraftState | null;
  snapshot: SimDraftSnapshot | null;
  canStart: boolean;
  onStart: () => void;
  onAdvance: () => void;
  onUndo: () => void;
  onReset: () => void;
  onSave: () => void;
  saveResult: SaveResultState;
}) {
  const isComplete = props.state?.status === "complete";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={props.snapshot?.isUserTurn ? "default" : "secondary"}>
              {isComplete
                ? "Complete"
                : props.snapshot?.isUserTurn
                ? "Your turn"
                : "Bot room"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {props.state
                ? `${props.state.config.teams} teams / ${props.state.config.rounds} rounds / seed ${props.state.config.seed}`
                : "Configure the room and start a seeded draft."}
            </span>
          </div>
          {props.snapshot?.isUserTurn ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a player from the assistant panel below.
            </p>
          ) : null}
          {props.saveResult.message ? (
            <p
              className={`mt-2 max-w-3xl break-all text-xs ${
                props.saveResult.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
              data-testid="mock-save-result-status"
            >
              {props.saveResult.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={props.onStart}
            disabled={!props.canStart}
            variant={props.state ? "outline" : "default"}
          >
            Start
          </Button>
          <Button
            type="button"
            onClick={props.onAdvance}
            disabled={!props.canStart || isComplete || props.snapshot?.isUserTurn}
            variant="secondary"
            data-testid="mock-advance"
          >
            <SkipForward className="size-4" aria-hidden="true" />
            Advance to my pick
          </Button>
          <Button
            type="button"
            onClick={props.onAdvance}
            disabled={!props.state || isComplete || props.snapshot?.isUserTurn}
            variant="outline"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            Continue
          </Button>
          <Button
            type="button"
            onClick={props.onUndo}
            disabled={!props.state?.picks.length}
            variant="outline"
            data-testid="mock-undo"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Undo
          </Button>
          <Button
            type="button"
            onClick={props.onReset}
            disabled={!props.state}
            variant="ghost"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
          <Button
            type="button"
            onClick={props.onSave}
            disabled={!props.state || props.saveResult.status === "saving"}
            variant="outline"
            data-testid="mock-save-result"
          >
            <Save className="size-4" aria-hidden="true" />
            {props.saveResult.status === "saving" ? "Saving" : "Save result"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DraftBoard(props: {
  snapshot: SimDraftSnapshot | null;
  players: readonly SimDraftPlayer[];
  picks: readonly { pick_no: number; player_id: string; draft_slot: number }[];
}) {
  const config = props.snapshot?.config ?? createDefaultSimDraftConfig();
  const playersById = useMemo(
    () => new Map(props.players.map((player) => [player.player_id, player])),
    [props.players]
  );
  const picksByNo = useMemo(
    () => new Map(props.picks.map((pick) => [pick.pick_no, pick])),
    [props.picks]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Draft Board</CardTitle>
        <CardDescription>
          Teams are columns, rounds are rows, and the user slot is highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[980px] gap-1"
            style={{
              gridTemplateColumns: `72px repeat(${config.teams}, minmax(118px, 1fr))`,
            }}
            data-testid="mock-draft-board"
          >
            <div className="rounded-md border bg-muted/50 p-2 text-xs font-medium text-muted-foreground">
              Round
            </div>
            {Array.from({ length: config.teams }, (_, index) => {
              const slot = index + 1;
              return (
                <div
                  key={slot}
                  className={`rounded-md border p-2 text-xs font-semibold ${
                    slot === config.userSlot
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-muted/50"
                  }`}
                >
                  {slot === config.userSlot ? "You" : `Team ${slot}`}
                </div>
              );
            })}
            {Array.from({ length: config.rounds }, (_, roundIndex) => {
              const round = roundIndex + 1;
              return (
                <BoardRound
                  key={round}
                  round={round}
                  config={config}
                  picksByNo={picksByNo}
                  playersById={playersById}
                  currentPickNo={props.snapshot?.currentPickNo ?? null}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardRound(props: {
  round: number;
  config: SimDraftConfig;
  picksByNo: Map<number, { pick_no: number; player_id: string; draft_slot: number }>;
  playersById: Map<string, SimDraftPlayer>;
  currentPickNo: number | null;
}) {
  return (
    <>
      <div className="rounded-md border bg-muted/30 p-2 text-sm font-semibold">
        {props.round}
      </div>
      {Array.from({ length: props.config.teams }, (_, index) => {
        const slot = index + 1;
        const pickNo = pickNoForRoundSlot(
          props.round,
          slot,
          props.config.teams,
          props.config.draftType
        );
        const pick = props.picksByNo.get(pickNo);
        const player = pick ? props.playersById.get(pick.player_id) : null;
        const isCurrent = props.currentPickNo === pickNo;
        const isUser = slot === props.config.userSlot;
        return (
          <div
            key={`${props.round}-${slot}`}
            className={`min-h-16 rounded-md border p-2 text-xs ${
              isCurrent
                ? "border-primary bg-primary/15"
                : isUser
                ? "border-primary/50 bg-primary/5"
                : "bg-card"
            }`}
            data-testid={isCurrent ? "mock-current-pick-cell" : undefined}
          >
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              {getRoundPick(pickNo, props.config.teams).round}.
              {String(
                getRoundPick(pickNo, props.config.teams).pickInRound
              ).padStart(2, "0")}
            </div>
            {player ? (
              <>
                <div className="truncate font-medium">{player.name}</div>
                <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                  <span>{player.position}</span>
                  <span>{player.team ?? "FA"}</span>
                  {player.bye_week ? <span>bye {player.bye_week}</span> : null}
                </div>
              </>
            ) : (
              <div className="pt-3 text-muted-foreground">—</div>
            )}
          </div>
        );
      })}
    </>
  );
}

function MockAssistantPanel(props: {
  viewModel: DraftViewModel | null;
  snapshot: SimDraftSnapshot | null;
  bundle: AggregatesBundleResponseT | undefined;
  draftState: SimDraftState | null;
  draftDetails: ReturnType<typeof toSleeperDraftDetails> | null;
  draftPicks: ReturnType<typeof toSleeperDraftPicks>;
  onPick: (playerId: string) => void;
}) {
  const contextValue = useMockDraftContextValue(props);

  if (!contextValue || !props.snapshot) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Start a local mock draft to populate the assistant panel.
        </CardContent>
      </Card>
    );
  }

  return (
    <section data-testid="mock-assistant-panel">
      <DraftDataStaticProvider value={contextValue}>
        <DraftAssistantContent
          pickAction={{
            disabled: !props.snapshot.isUserTurn,
            onPick: (player) => props.onPick(player.player_id),
          }}
        />
      </DraftDataStaticProvider>
    </section>
  );
}

function useMockDraftContextValue(props: {
  viewModel: DraftViewModel | null;
  snapshot: SimDraftSnapshot | null;
  bundle: AggregatesBundleResponseT | undefined;
  draftState: SimDraftState | null;
  draftDetails: ReturnType<typeof toSleeperDraftDetails> | null;
  draftPicks: ReturnType<typeof toSleeperDraftPicks>;
}): Partial<DraftDataContextType> | null {
  const { viewModel, snapshot, bundle, draftState, draftDetails, draftPicks } =
    props;
  const teams = draftDetails?.settings?.teams ?? draftState?.config.teams ?? 0;

  const league = useMemo(() => {
    if (!draftDetails || !draftState) return null;
    const requirements = buildRosterRequirementsFromDraftSettings(
      draftDetails.settings
    );
    return {
      teams,
      scoring: draftState.config.scoring,
      roster: {
        QB: requirements.QB,
        RB: requirements.RB,
        WR: requirements.WR,
        TE: requirements.TE,
        K: requirements.K,
        DEF: requirements.DEF,
        FLEX: requirements.FLEX,
        BENCH: requirements.BN,
      },
    };
  }, [draftDetails, draftState, teams]);

  const positionRows = useMemo(() => {
    if (!bundle || !teams) return null;
    const positionTierByPlayerId = buildPositionTierMapFromBundle(bundle);
    const positionTierOptions = { tiersArePositionTiers: true };
    return {
      QB: toPlayerRowsFromBundle(bundle.shards.QB, teams, positionTierOptions),
      RB: toPlayerRowsFromBundle(bundle.shards.RB, teams, positionTierOptions),
      WR: toPlayerRowsFromBundle(bundle.shards.WR, teams, positionTierOptions),
      TE: toPlayerRowsFromBundle(bundle.shards.TE, teams, positionTierOptions),
      K: toPlayerRowsFromBundle(bundle.shards.K, teams, positionTierOptions),
      DEF: toPlayerRowsFromBundle(
        bundle.shards.DEF,
        teams,
        positionTierOptions
      ),
      FLEX: toPlayerRowsFromBundle(
        bundle.shards.FLEX,
        teams,
        positionTierOptions
      ),
      ALL: toPlayerRowsFromBundle(bundle.shards.ALL, teams, {
        positionTierByPlayerId,
      }),
    };
  }, [bundle, teams]);

  const pickOverlay = useMemo(() => {
    const overlay = new Map<string, NonNullable<PlayerWithPick["picked"]>>();
    for (const pick of draftPicks) {
      const normalized = normalizePick(pick, teams ? { teams } : undefined);
      if (normalized) overlay.set(normalized.playerId, normalized.meta);
    }
    return overlay;
  }, [draftPicks, teams]);

  const user = useMemo(
    () =>
      draftState
        ? {
            username: "mock-user",
            user_id: draftState.config.userId,
            display_name: "You",
          }
        : null,
    [draftState]
  );

  const playersAllWithPicks = useMemo(() => {
    const rows = positionRows?.ALL ?? [];
    if (!rows.length) return [];
    return rows.map((row) => {
      const meta = pickOverlay.get(row.player_id);
      return meta
        ? {
            ...row,
            picked: meta,
            draftedByMe: meta.slot === draftState?.config.userSlot,
          }
        : { ...row };
    });
  }, [draftState?.config.userSlot, pickOverlay, positionRows]);

  const draftValueBoard = viewModel?.recommendationBoard ?? null;

  const attachDraftValue = useMemo(
    () => (row: PlayerWithPick): PlayerWithPick =>
      attachDraftValueMetrics(
        row,
        draftValueBoard?.metricsByPlayerId[row.player_id]
      ),
    [draftValueBoard]
  );

  const playersAll = useMemo(
    () =>
      playersAllWithPicks
        .map(attachDraftValue)
        .sort(
          (a, b) =>
            (a.draft_recommendation_rank ?? 999_999) -
              (b.draft_recommendation_rank ?? 999_999) ||
            (a.tier_rank ?? a.rank ?? 999_999) -
              (b.tier_rank ?? b.rank ?? 999_999)
        ),
    [attachDraftValue, playersAllWithPicks]
  );

  const playersByPosition = useMemo(() => {
    if (!positionRows) return null;
    const enrich = (rows: PlayerWithPick[]) =>
      rows
        .map((row) => {
          const meta = pickOverlay.get(row.player_id);
          return meta
            ? {
                ...row,
                picked: meta,
                draftedByMe: meta.slot === draftState?.config.userSlot,
              }
            : { ...row };
        })
        .map(attachDraftValue);

    return {
      QB: enrich(positionRows.QB),
      RB: enrich(positionRows.RB),
      WR: enrich(positionRows.WR),
      TE: enrich(positionRows.TE),
      K: enrich(positionRows.K),
      DEF: enrich(positionRows.DEF),
      FLEX: enrich(positionRows.FLEX),
      ALL: enrich(positionRows.ALL),
    };
  }, [attachDraftValue, draftState?.config.userSlot, pickOverlay, positionRows]);

  const draftedIds = useMemo(
    () => new Set(Array.from(pickOverlay.keys())),
    [pickOverlay]
  );

  return useMemo(() => {
    if (!viewModel || !snapshot || !draftState || !draftDetails) return null;
    return {
      username: "mock-user",
      selectedDraftId: draftState.config.draftId,
      user,
      drafts: [],
      draftDetails,
      playersBundle: bundle ?? null,
      picks: draftPicks,
      availablePlayers: viewModel.available,
      availableByPosition: viewModel.availableByPosition,
      topAvailablePlayersByPosition: viewModel.topAvailablePlayersByPosition,
      userPositionNeeds:
        viewModel.userRoster?.remainingPositionRequirements ?? {},
      userPositionCounts: viewModel.userRoster?.rosterPositionCounts ?? {},
      userPositionRequirements: viewModel.rosterRequirements,
      getRosterStatus: (pos: DraftAssistantPosition) => {
        const count = viewModel.userRoster?.rosterPositionCounts?.[pos] ?? 0;
        const requirement = viewModel.rosterRequirements?.[pos] ?? 0;
        return { count, requirement, met: requirement > 0 && count >= requirement };
      },
      draftWideNeeds: viewModel.draftWideNeeds,
      userRoster: viewModel.userRoster?.players ?? [],
      userRosterSlots: buildUserRosterSlots(viewModel),
      decisionRows:
        playersAllWithPicks
          .map(attachDraftValue)
          .filter(
            (row) => !row.picked && row.draft_recommendation_rank != null
          )
          .sort(
            (a, b) =>
              (a.draft_recommendation_rank ?? 999_999) -
              (b.draft_recommendation_rank ?? 999_999)
          )
          .slice(0, 12) ?? [],
      topRecommendation:
        playersAllWithPicks
          .map(attachDraftValue)
          .filter(
            (row) => !row.picked && row.draft_recommendation_rank != null
          )
          .sort(
            (a, b) =>
              (a.draft_recommendation_rank ?? 999_999) -
              (b.draft_recommendation_rank ?? 999_999)
          )[0] ?? null,
      rosterConstruction: draftValueBoard?.rosterConstruction ?? null,
      draftContext: viewModel.draftContext,
      sourceHealth: bundle?.sourceHealth ?? null,
      positionRows,
      loading: {
        user: false,
        drafts: false,
        draftDetails: false,
        players: false,
        picks: false,
      },
      error: {
        user: null,
        drafts: null,
        draftDetails: null,
        players: null,
        picks: null,
      },
      league,
      refetchData: () => {},
      lastUpdatedAt: null,
      playersAll,
      playersByPosition,
      draftedIds,
    };
  }, [
    attachDraftValue,
    bundle,
    draftDetails,
    draftPicks,
    draftState,
    draftValueBoard,
    draftedIds,
    league,
    playersAll,
    playersAllWithPicks,
    playersByPosition,
    positionRows,
    snapshot,
    user,
    viewModel,
  ]);
}

function StatusTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 truncate font-semibold">{props.value}</div>
    </div>
  );
}

function setupToRosterSlots(values: Partial<SetupValues>): SimRosterSlots {
  return {
    QB: values.QB ?? defaultRosterSlots.QB,
    RB: values.RB ?? defaultRosterSlots.RB,
    WR: values.WR ?? defaultRosterSlots.WR,
    TE: values.TE ?? defaultRosterSlots.TE,
    K: values.K ?? defaultRosterSlots.K,
    DEF: values.DEF ?? defaultRosterSlots.DEF,
    FLEX: values.FLEX ?? defaultRosterSlots.FLEX,
  };
}

function valuesToConfig(
  values: SetupValues,
  extra: { season: string; userId: string; leagueName: string }
): SimDraftConfig {
  return createDefaultSimDraftConfig({
    draftId: `sim-${values.seed}`,
    userId: extra.userId,
    season: extra.season,
    leagueName: extra.leagueName,
    teams: values.teams,
    rounds: values.rounds,
    userSlot: Math.min(values.userSlot, values.teams),
    scoring: values.scoring,
    draftType: values.draftType,
    seed: values.seed,
    botStrategy: values.botStrategy,
    rosterSlots: setupToRosterSlots(values),
  });
}

function selectedLeagueName(
  leagueId: string,
  leagues: SleeperLeague[] | undefined
) {
  return (
    leagues?.find((league) => league.league_id === leagueId)?.name ??
    "Local Mock Draft"
  );
}

function settingsFromLeague(league: SleeperLeague): {
  teams: number;
  rounds: number;
  scoring: ScoringType;
  rosterSlots: SimRosterSlots;
} {
  const rosterSlots = countRosterSlotsFromSleeper(league.roster_positions);
  const rounds =
    league.roster_positions?.length ??
    readNumber(league.settings, "draft_rounds") ??
    defaultSetup.rounds;
  const rec = readNumber(league.scoring_settings, "rec") ?? 0;
  return {
    teams:
      league.total_rosters ??
      readNumber(league.settings, "num_teams") ??
      defaultSetup.teams,
    rounds,
    scoring: scoringTypeFromReceptionPoints(rec),
    rosterSlots,
  };
}

function countRosterSlotsFromSleeper(
  rosterPositions: readonly string[] | undefined
) {
  if (!rosterPositions?.length) return defaultRosterSlots;
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0 };
  for (const raw of rosterPositions) {
    if (raw === "BN" || raw === "BE" || raw === "IR") continue;
    if (raw === "SUPER_FLEX" || raw === "REC_FLEX") {
      counts.FLEX += 1;
      continue;
    }
    if (raw in counts) {
      counts[raw as keyof SimRosterSlots] += 1;
    }
  }
  return counts;
}

function readNumber(
  record: Record<string, unknown> | undefined,
  key: string
) {
  const value = record?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function pickNoForRoundSlot(
  round: number,
  slot: number,
  teams: number,
  draftType: string
) {
  if (draftType === "linear" || round % 2 === 1) {
    return (round - 1) * teams + slot;
  }
  return (round - 1) * teams + (teams - slot + 1);
}

function buildUserRosterSlots(viewModel: DraftViewModel) {
  const requirements = viewModel.rosterRequirements;
  const players = [...(viewModel.userRoster?.players ?? [])] as DraftedPlayer[];
  const slots: { slot: RosterSlot; player: DraftedPlayer | null }[] = [];

  for (const slot of rosterSlotOrder) {
    for (let index = 0; index < (requirements[slot] ?? 0); index += 1) {
      const playerIndex = players.findIndex((player) =>
        fitsRosterSlot(player.position, slot)
      );
      slots.push({
        slot,
        player: playerIndex >= 0 ? players.splice(playerIndex, 1)[0] ?? null : null,
      });
    }
  }

  const benchSlots = requirements.BN ?? 0;
  for (let index = 0; index < Math.max(benchSlots, players.length); index += 1) {
    slots.push({ slot: "BN", player: players.shift() ?? null });
  }
  return slots;
}

function fitsRosterSlot(position: Position, slot: RosterSlot) {
  if (position === slot) return true;
  return slot === "FLEX" && ["RB", "WR", "TE"].includes(position);
}
