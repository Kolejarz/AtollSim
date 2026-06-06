# AtollSim — Game Design & Simulator Spec

## What is this game?

"The Ocean Rescue" is a side activity for a 14-day summer camp. 12 groups (each: 1 counselor + ~10 kids) compete to earn the most Victory Points (VP) by exploring a shared Ocean map and solving Atoll puzzles. It runs across ~10 active play days with one short GM visit per group per day.

The game has two layers: the Ocean (pick tiles, get resources) and Atolls (spend resources to solve sliding puzzles, earn VP). The layers are interdependent — ocean gives you Winds (the fuel), atolls give you VP (the score).

## Typical GM day

**Before sessions (~5 min):**
- Note the current day number → determines the day bonus for ocean rewards.
- Decide on promotion adjustments (global or per-group) if pacing needs tweaking.
- Have ready: master sheet (tile→base number), reward table, wind stack, map stack, VP tally.

**Each group visit (~3–5 min):**
1. **Ocean phase.** Group points at 3 tiles on the board (e.g. "F12, G15, H3"). GM crosses them off, looks up each on the master sheet → gets the base number (1–6). Adds day bonus (+0/+2/+4) and any promotion → final row. Reads the reward table → deals that many wind cards from the wind stack, a map from the map stack if the row says 1, and records VP.
2. **Puzzle phase.** Group hands in solved atolls from yesterday (max ~2 per visit — the GM only has a few minutes). GM checks each solution against the answer key. If valid: puzzle size determines the reward row (5×5→row 5, 6×6→row 8, 7×7→row 11), promotion can be applied. GM reads the table, deals rewards.
3. Group leaves with new winds and maps. They solve puzzles during free time (arts & crafts, rest hour, evenings) and bring solutions tomorrow.

**Between sessions:**
- Update VP standings on a visible leaderboard.
- Adjust promotion if a group is falling behind or if the game feels too slow/fast.

**Physical components at the GM table:**
- A0 ocean board (27×27 grid with a big thematic image split across tiles, tile labels A1–A27 etc., groups mark which tiles they've picked).
- Master sheet (printed list: A1→3, A2→5, B1→1, ... — pre-randomized base numbers 1–6 for each tile).
- Reward table (laminated card, 13 rows).
- Wind stack (shuffled pile of ↑↓←→ cards, dealt FIFO from top).
- Map stack (shuffled pile of pre-printed atoll puzzle sheets in 3 sizes, dealt FIFO from top).
- Answer keys for all puzzles in the map stack.
- VP tally sheet (12 groups, running totals).

## Game mechanics

### The Ocean (Layer 1)

A shared 27×27 grid = 729 tiles. Each tile has a label (A1, B14, etc.) and is part of a single large image. Groups pick tiles — once picked, a tile is gone for everyone. There is no strategic information in the image; tile contents are pre-randomized. The fun is in the social ritual: gathering around the board, debating choices, revealing what you got.

Each tile has a base reward number (1–6) assigned randomly on the master sheet before camp. The GM looks up the base number and applies modifiers:

`final_row = base + day_bonus + promotion`

**Day bonus** (the sliding window):
| Days | Bonus |
|------|-------|
| 1–4  | +0    |
| 5–8  | +2    |
| 9–10 | +4    |

**Promotion** (GM's pacing lever):
The GM sets this before the day's sessions. It can be global (all groups get +1 today because the game is slow) or per-group (struggling group gets +2 to catch up). Typical range: 0 to +2. This is the only fudge factor in the entire system — one number, pure addition.

Each group picks 3 tiles per turn (10 turns total = 30 tiles per group over the game).

### Atolls (Layer 2)

Atoll maps are sliding/tilt puzzles (Pokémon ice puzzle mechanic). The ship starts at a marked position, the target is marked with ✕. You play a Wind card (↑↓←→) and the ship slides in that direction until it hits an island (obstacle) or the grid edge. To win, the ship must come to rest exactly on ✕.

Three sizes: 5×5, 6×6, 7×7. Bigger = more moves needed = harder. Maps come from the map stack (FIFO, shuffled mix of all three sizes).

Groups solve puzzles offline with paper, pencils, and the actual wind cards they have. They lay out a sequence of cards as their solution. Since they have hours and can try combinations, they will almost always find the optimal (shortest) solution if they have the right wind directions available. The real decision is which maps to allocate scarce winds to — not how cleverly to solve any single puzzle.

**Solution submission:** Group brings solved atolls to the next GM visit. GM checks the card sequence against the answer key. Valid → reward based on puzzle size. Invalid → no reward, group keeps the map and can retry tomorrow.

Groups can hold multiple unsolved maps and a bank of wind cards simultaneously. Winds are freely reallocable between atolls until submitted ("no sunk cost" — a group can change their mind about which map to tackle).

### The Reward Table

One universal table, 13 rows. Every reward in the game — ocean tiles and puzzle completions alike — is a lookup into this table.

| Row | Winds | Maps | VP |
|-----|-------|------|----|
| 1   | 1     | 0    | 0  |
| 2   | 1     | 0    | 0  |
| 3   | 2     | 0    | 0  |
| 4   | 2     | 1    | 0  |
| 5   | 2     | 0    | 1  |
| 6   | 3     | 1    | 1  |
| 7   | 3     | 0    | 2  |
| 8   | 4     | 1    | 3  |
| 9   | 4     | 0    | 3  |
| 10  | 5     | 1    | 4  |
| 11  | 5     | 0    | 5  |
| 12  | 6     | 1    | 6  |
| 13  | 6     | 1    | 7  |

Design logic:
- Winds ramp ~+1 per 2 rows (the fuel supply grows).
- Maps appear every other row starting at row 4 (they're landmarks in the table).
- VP accelerates — rows 1–4 give no VP (pure resource gathering), the real points start at row 5+.
- Row 1 minimum is 1 wind — no empty/miss tiles, every pick gives something.
- "Maps" column means: deal 1 map from the map stack (FIFO). The size is whatever's on top.

**How each context uses the table:**

| Context | Base row | Notes |
|---------|----------|-------|
| Ocean tile | master_sheet[tile] (1–6) + day_bonus + promotion | Day bonus slides the window up as camp progresses |
| 5×5 atoll solved | 5 + promotion | Fixed. Small puzzle, modest reward. |
| 6×6 atoll solved | 8 + promotion | Fixed. Medium puzzle, good reward. |
| 7×7 atoll solved | 11 + promotion | Fixed. Large puzzle, best reward. |

Maximum reachable row: ocean base 6 + day bonus 4 + promotion 2 = row 12. Puzzle 7×7 + promotion 2 = row 13. The table covers the full range.

### Economy at default settings (per group, no promotion)

Validated by simulation:

| Source | Winds | Maps | VP |
|--------|-------|------|----|
| Ocean (30 tiles) | ~75 | ~13 | ~32 |
| Puzzles (13 solved) | ~43 | ~4 | ~33 |
| Cascade (4 bonus maps solved) | ~13 | ~1 | ~10 |
| **Total** | **~131** | **~18 solved** | **~75** |

- Wind surplus: ~41 (buffer for bad direction distribution in the stack).
- VP split: 43% ocean / 57% puzzle — atolls are the main VP engine but ocean isn't irrelevant.
- Throughput: ~2 solves per visit — comfortably fits the ~3–5 min window.
- Cascade converges fast (4 bonus maps → 1 → done). No runaway loops.

### Wind cards & direction distribution

The wind stack is a shuffled pile of ↑↓←→ cards dealt FIFO. Equal distribution of all 4 directions. A group might get unlucky (5× ↑ and 0× →), making some puzzles temporarily unsolvable — this is intentional scarcity that drives the "which map do I tackle" decision.

### Map stack composition

Pre-shuffled mix of puzzle sheets. Default split: ~50% small (5×5), ~30% medium (6×6), ~20% large (7×7). Dealt FIFO. The size you get is luck of the draw, not a choice.

## Simulator requirements

The simulator's job is to let the game designer (me) tune the reward table and see how changes affect the economy before camp starts.

### Editable reward table
- Rows displayed as a simple editable grid: row number, winds, maps (0/1), VP.
- User can add rows (appends at bottom), remove rows, edit any cell.
- "Reset to defaults" button restores the table above.
- Validation: winds ≥ 1 for row 1+, maps is 0 or 1, VP ≥ 0, row numbers sequential.

### Configurable parameters
- Tiles per turn (default: 3).
- Turns per game (default: 10).
- Number of teams (default: 12).
- Grid size (default: 27×27).
- Ocean base value range (default: 1–6, uniform random).
- Day bonus schedule (default: +0/+2/+4 at day thresholds).
- Puzzle base rows by size (default: 5→5, 6→8, 7→11).
- Map stack composition (default: 50/30/20 split).
- Submissions per visit cap (default: 2).

### Simulation output
When user clicks "Run simulation" (or "Regenerate" after editing):
- Monte Carlo over N teams, full game.
- Per-group resource curves over turns (winds in hand, maps in hand, VP).
- VP distribution histogram across teams (spread = competitiveness).
- Wind scarcity: what % of turns a group can't attempt any atoll.
- Map backlog: unsolved maps over time (are groups drowning in maps or starved?).
- Cascade depth: how many bonus maps spawn on average.
- Economy summary table (like the one above).

### Play mode (interactive single-game walkthrough)
- Simulates one group's game turn by turn.
- Ocean phase: "pick tiles" draws from the master sheet with current day bonus.
- Shows wind bank, map inventory, lets user allocate winds to maps and submit solutions.
- Decision log tracking all rewards and solves.

### Bilingual PL/EN toggle
All labels, descriptions, and generated text in both languages.

## Open questions

### Wind direction balance
If the wind stack is pure random ↑↓←→, a group can get stuck with the wrong directions for all their current maps. Options:
- **Joker winds** (✦): wild cards aimable in any direction. How many in the stack? (Previous design used ~5% of winds as jokers.)
- **Guaranteed direction sets**: every N cards dealt contains at least 1 of each direction.
- **Accept it as-is**: the scarcity IS the game. Groups adapt by picking different maps.
The simulator should model direction distribution to show how often groups get stuck.

### Map hoarding
No formal anti-hoarding mechanic currently — hoarding self-punishes through lost throughput (fewer visits to submit = fewer rewards). The submission cap (~2/visit) is the natural throttle. But worth simulating: does a "hoard and dump" strategy ever beat steady solving? If it does, consider:
- Map expiry: each day after pickup, the reward row drops by 1. No GM tracking needed if the pickup day is printed on the map.
- Capacity limit: max 3–4 unsolved maps (trust/enforcement issues flagged).
- Or just live with it if the sim shows it's suboptimal.

### Puzzle solve quality
Current model: binary (solved = full reward, unsolved = nothing). The assumption is that with hours of offline time, groups will always find the optimal route if they have correct directions. Worth questioning:
- Are there puzzles where multiple valid solutions exist with different move counts?
- Should the GM even check optimality, or just verify the endpoint is reached?
- If sub-optimal solutions matter, how does the GM quickly assess the penalty? (Count cards in the submitted sequence vs. answer key's optimal count → drop 1 row per extra move?)

### Promotion transparency
Should groups know the promotion system exists? Options:
- Fully secret (GM just adjusts, groups don't know why some days feel luckier).
- Semi-transparent ("the seas are generous today" — groups know something is up but not the formula).
- Fully transparent (groups know the mechanic, can ask "what's our promotion?").

### Ocean board re-use across days
729 tiles, 360 picked over the game = ~370 left unpicked. The board gets sparser. Does this create a feel-bad "nothing left near me" effect in late game? The day bonus compensates value-wise, but the visual of a half-empty board might deflate excitement. Consider: smaller grid? More picks per turn in late game? Board "refills" mid-camp?

### Submission cap flexibility
Default 2 maps per visit. Should this be fixed or should the GM flex it? A group that solved 4 maps overnight might feel cheated submitting only 2. But allowing unlimited submissions creates a throughput advantage for groups that happen to visit early in the session.