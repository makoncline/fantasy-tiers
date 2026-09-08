import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { RulesSchema, SheetDataSchema, SavedSchema, STORAGE_KEY, WIFE_RULES, calculateSheet, scoringFields, referenceFields, type Rules, type Marks } from "./model";
import { calculateDraftRounds } from "@/lib/draftLeagueConfig";

const data = SheetDataSchema.parse(JSON.parse(document.getElementById("sheet-data")!.textContent!));
const playerIds = new Set(data.players.map(p => p.id));
function readSaved(value: string) {
  const saved = SavedSchema.parse(JSON.parse(value));
  if (Object.keys(saved.marks).some(id => !playerIds.has(id))) throw new Error("Unknown player in saved picks.");
  return saved;
}
function initialState() {
  try {
    const text = localStorage.getItem(STORAGE_KEY) ?? document.getElementById("sheet-saved")?.textContent;
    return { saved: text ? readSaved(text) : { version: 1, rules: WIFE_RULES, marks: {} }, message: "" };
  } catch { return { saved: { version: 1, rules: WIFE_RULES, marks: {} }, message: "Saved progress could not load. Use Export picks to keep a copy." }; }
}
const initial = initialState();
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadSheet(rules: Rules, marks: Marks) {
  // Rebuild a clean document. Do not copy React's rendered DOM or browser extensions.
  const head = document.createElement("head");
  for (const element of document.head.querySelectorAll("meta, title, style")) head.append(element.cloneNode(true));
  const dataScript = document.getElementById("sheet-data")!.outerHTML;
  const appScript = document.getElementById("sheet-app")!.outerHTML;
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.replaceChild(head, doc.head);
  const saved = JSON.stringify({ version: 1, rules, marks }).replaceAll("<", "\\u003c");
  doc.body.innerHTML = `<div id="root">Opening draft backup…</div>${dataScript}<script id="sheet-saved" type="application/json">${saved}</script>${appScript}`;
  download("draft-backup.html", `<!doctype html>${doc.documentElement.outerHTML}`, "text/html");
}
function RuleEditor({ rules, apply }: { rules: Rules; apply: (rules: Rules) => void }) {
  const form = useForm<Rules>({ resolver: zodResolver(RulesSchema), defaultValues: rules });
  const number = (name: FieldPath<Rules>, label: string) => <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type="number" step="any" name={field.name} ref={field.ref} onBlur={field.onBlur} value={typeof field.value === "number" && Number.isFinite(field.value) ? field.value : ""} onChange={e => field.onChange(e.target.value === "" ? NaN : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>} />;
  return <Form {...form}><form onSubmit={form.handleSubmit(apply)}>
    <h3>Draft</h3><div className="fields">{number("teams", "Teams")}{number("slot", "Your pick")}{number("timer", "Seconds per pick (reference)")}
      <FormField control={form.control} name="draftType" render={({ field }) => <FormItem><FormLabel>Draft order</FormLabel><div><Button type="button" aria-pressed={field.value === "snake"} onClick={() => field.onChange("snake")}>Snake</Button><Button type="button" aria-pressed={field.value === "linear"} onClick={() => field.onChange("linear")}>Linear</Button></div></FormItem>} />
    </div><h3>Roster spots</h3><p>IR is not drafted. Rounds follow roster size.</p><div className="fields">{(["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BENCH", "IR"] as const).map(key => number(`roster.${key}`, key))}</div>
    <h3>Position maximums</h3><p>0 means no limit. The sheet warns when a maximum is reached.</p><div className="fields">{(["QB", "RB", "WR", "TE", "K", "DEF"] as const).map(key => number(`limits.${key}`, key))}</div>
    <h3>Scoring</h3><p>Apply rules to update points and value. PPR also selects the closest FP ranking set.</p><div className="fields">{scoringFields.map(([key, label]) => number(`scoring.${key}`, label))}</div>
    <h3>Other scoring — reference only</h3><p>These rules are saved for reference. FP does not project conversions or return scores. K and D/ST use Sleeper standard points; these controls do not change their rankings or points. Return rules apply to players and D/ST where eligible.</p><div className="fields">{referenceFields.map(([key, label]) => number(`reference.${key}`, label))}</div>
    <div className="actions"><Button type="submit">Apply rules</Button><Button type="button" onClick={() => { form.reset(WIFE_RULES); apply(WIFE_RULES); }}>Restore wife’s rules</Button></div>
  </form></Form>;
}
function App() {
  const [rules, setRules] = useState<Rules>(initial.saved.rules);
  const [marks, setMarks] = useState<Marks>(initial.saved.marks);
  const [history, setHistory] = useState<Marks[]>([]);
  const [message, setMessage] = useState(initial.message);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("Positions");
  const [showTaken, setShowTaken] = useState(false);
  const [sort, setSort] = useState<"val" | "pts" | "tier" | "adp" | "ecr">("val");
  const [editorVersion, setEditorVersion] = useState(0);
  const rows = useMemo(() => calculateSheet(data, rules), [rules]);
  function save(nextMarks: Marks, nextRules = rules) {
    setMarks(nextMarks); setRules(nextRules);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, rules: nextRules, marks: nextMarks })); setMessage("Saved on this device."); }
    catch { setMessage("Browser storage is unavailable. Use Export picks before closing."); }
  }
  function update(next: Marks) { setHistory(h => [...h.slice(-99), marks]); save(next); }
  function mark(id: string, status: "taken" | "mine") {
    const next = { ...marks };
    if (next[id] === status) delete next[id]; else next[id] = status;
    update(next);
  }
  const mine = rows.filter(p => marks[p.id] === "mine");
  const counts = Object.fromEntries(["QB", "RB", "WR", "TE", "K", "DEF"].map(pos => [pos, mine.filter(p => p.pos === pos).length]));
  const flex = ["RB", "WR", "TE"].reduce((sum, pos) => sum + Math.max(0, (counts[pos] ?? 0) - (pos === "RB" ? rules.roster.RB : pos === "WR" ? rules.roster.WR : rules.roster.TE)), 0);
  const round = mine.length + 1;
  const rounds = calculateDraftRounds(rules.roster);
  const pickInRound = rules.draftType === "snake" && round % 2 === 0 ? rules.teams - rules.slot + 1 : rules.slot;
  const filtered = rows.filter(p => (showTaken || !marks[p.id] || view === "My roster") && (view !== "My roster" || marks[p.id] === "mine") && `${p.name} ${p.team ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const groups = view === "Positions" ? ["QB", "RB", "WR", "TE", "K", "DEF"] : [view];
  const display = (n: number | null, digits = 1) => n == null ? "—" : n.toFixed(digits);
  const table = (group: string) => {
    const pool = filtered.filter(p => group === "FLEX" ? ["RB", "WR", "TE"].includes(p.pos) : ["QB", "RB", "WR", "TE", "K", "DEF"].includes(group) ? p.pos === group : true);
    const tier = (p: typeof rows[number]) => group === "Overall" || group === "My roster" ? p.overall : group === "FLEX" ? p.flex : p.tier;
    pool.sort((a, b) => {
      const av = sort === "tier" ? tier(a) : a[sort], bv = sort === "tier" ? tier(b) : b[sort];
      if (av == null) return bv == null ? a.name.localeCompare(b.name) : 1;
      if (bv == null) return -1;
      return ((sort === "val" || sort === "pts") ? bv - av : av - bv) || (a.ecr ?? Infinity) - (b.ecr ?? Infinity) || a.name.localeCompare(b.name);
    });
    return <section key={group} id={`position-${group}`}><h2>{group} <small>{pool.length}</small></h2>{["K", "DEF"].includes(group) && <p>Sleeper standard points — reference only.</p>}<Table><TableHeader><TableRow><TableHead>Tier</TableHead><TableHead>Player</TableHead><TableHead>Team / bye</TableHead>{(["pts", "val", "ecr", "adp"] as const).map(key => <TableHead key={key}><Button onClick={() => setSort(key)} aria-pressed={sort === key}>{key.toUpperCase()}</Button></TableHead>)}<TableHead>Mark picks</TableHead></TableRow></TableHeader><TableBody>{pool.map(p => <TableRow key={p.id} data-player={p.id} className={marks[p.id] ?? ""}><TableCell>{display(tier(p), 0)}</TableCell><TableCell><strong>{p.name}</strong> <small>{p.pos}{p.status ? ` · ${p.status}` : ""}</small></TableCell><TableCell>{p.team ?? "—"} / {p.bye ?? "—"}</TableCell><TableCell>{display(p.pts)}{["K", "DEF"].includes(p.pos) ? "*" : ""}</TableCell><TableCell>{display(p.val)}</TableCell><TableCell>{display(p.ecr)}</TableCell><TableCell>{display(p.adp)}</TableCell><TableCell><div className="row-actions"><Button aria-label={`Taken: ${p.name}`} aria-pressed={marks[p.id] === "taken"} onClick={() => mark(p.id, "taken")}>Taken</Button><Button aria-label={`Mine: ${p.name}`} aria-pressed={marks[p.id] === "mine"} onClick={() => mark(p.id, "mine")}>Mine</Button></div></TableCell></TableRow>)}</TableBody></Table>{pool.length === 0 && <p>No players match.</p>}</section>;
  };
  return <main><header><h1>Draft backup</h1><p>{rules.scoring.reception} PPR · {rules.teams} teams · Pick {rules.slot} · {rounds} rounds</p><p>Draft in ESPN. Mark other picks <b>Taken</b> and your picks <b>Mine</b>. Click again to clear.</p><div className="actions"><Button onClick={() => downloadSheet(rules, marks)}>Download offline copy</Button><Button onClick={() => window.print()}>Print</Button></div></header>
    <div className="toolbar"><Input aria-label="Search players" placeholder="Search player or team" value={search} onChange={e => setSearch(e.target.value)} /><div className="actions">{["Positions", "Overall", "FLEX", "My roster"].map(v => <Button key={v} onClick={() => setView(v)} aria-pressed={view === v}>{v}</Button>)}<Button aria-pressed={showTaken} onClick={() => setShowTaken(!showTaken)}>Show drafted</Button><Button disabled={!history.length} onClick={() => { const prior = history[history.length - 1]!; setHistory(h => h.slice(0, -1)); save(prior); }}>Undo</Button></div><div className="actions">Sort: {(["val", "pts", "tier", "ecr", "adp"] as const).map(s => <Button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}>{s.toUpperCase()}</Button>)}</div></div>
    <p role="status">{message}</p><p className="roster"><b>My roster {mine.length}/{rounds}</b> · {Object.entries(rules.roster).filter(([pos]) => !["IR", "BENCH"].includes(pos)).map(([pos, target]) => `${pos} ${pos === "FLEX" ? Math.min(flex, target) : Math.min(counts[pos] ?? 0, target)}/${target}`).join(" · ")}{round <= rounds ? ` · Next pick ${round}.${String(pickInRound).padStart(2, "0")}` : " · Roster complete"}</p>
    {mine.length > rounds && <p role="alert">Too many players marked Mine. Check your picks.</p>}{Object.entries(rules.limits).filter(([pos, max]) => max > 0 && (counts[pos] ?? 0) >= max).map(([pos, max]) => <p role="alert" key={pos}>{pos} maximum reached: {counts[pos]}/{max}.</p>)}
    <Collapsible><CollapsibleTrigger asChild><Button>League rules ▾</Button></CollapsibleTrigger><CollapsibleContent><RuleEditor key={editorVersion} rules={rules} apply={next => save(marks, next)} /></CollapsibleContent></Collapsible>
    <Collapsible><CollapsibleTrigger asChild><Button>Save & reference ▾</Button></CollapsibleTrigger><CollapsibleContent><div className="actions"><Button onClick={() => download("draft-picks.json", JSON.stringify({ version: 1, rules, marks }, null, 2), "application/json")}>Export picks</Button><label>Import picks <Input type="file" accept=".json" aria-label="Import picks" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 1_000_000) throw new Error(); const saved = readSaved(await file.text()); setHistory(h => [...h.slice(-99), marks]); save(saved.marks, saved.rules); setEditorVersion(v => v + 1); } catch { setMessage("Could not import. Choose a valid draft-picks.json export."); } }} /></label><Button onClick={() => { if (window.confirm("Clear all Taken and Mine marks? Rules will stay the same.")) update({}); }}>Clear picks</Button></div><p>FP points and tiers; Sleeper ADP. VAL is the shared starter-aware value, fixed during picks. No ADJ or live advice. K/D/ST points (*) use Sleeper standard scoring. Rankings use the nearest standard, half-PPR, or PPR set.</p><p>Season {data.season} · FP projections {data.fpDate.slice(0, 10)} · FP rankings {data.rankingsDate.slice(0, 10)} · Sleeper {data.sleeperDate.slice(0, 10)}.</p><p>Download before the draft. Open the downloaded HTML file in a browser without internet. The download includes your current picks and rules. Use Export/import picks to move later progress between copies. Keep one active copy to avoid conflicting saves.</p></CollapsibleContent></Collapsible>
    {Date.now() - Date.parse(data.fpDate) > 3 * 86400000 && <p role="alert">This saved data is more than three days old. Get a new copy from the site when you have internet.</p>}
    {view === "Positions" && <nav className="actions">{groups.map(g => <a key={g} href={`#position-${g}`}>{g}</a>)}</nav>}{groups.map(table)}
  </main>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
