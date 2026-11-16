# CH57x Macropad Config Editor — handoff to Claude Code

*Written 2026-11-15. Source of truth for the code is `/home/claude/ch57x-config-editor.html` (1,516 lines, ~87 KB). Everything below was re-checked against that file and the scratchpad on this date.*

---

## 1. What this is

A **single-file, strictly-HTML** web app: a visual editor for the YAML mapping files used by
[kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool), with **direct upload to the keyboard from the browser via WebHID** (no CLI needed). Name shown in the UI: **CH57x Macropad Config Editor**.

Hard requirements that came from the user and must be preserved:

1. **One `.html` file**, no build step, no runtime dependencies, no network calls.
2. **YAML syntax identical to the upstream tool**, so files round-trip with the original CLI (`validate` / `upload`).
3. **Direct upload from the browser** (Chrome/Edge desktop, WebHID), with the CLI-script fallback kept for other browsers.
4. The `model:` field is **not in the UI**; it is written into the YAML from the connected keyboard.
5. The user's own hardware: **514c:8850 12-key / 4-knob macropads** (and they have also used a **1189:8890** board). They use Windows-style (CRLF) YAML files.

Browser support: WebHID is Chrome/Edge desktop only. Linux needs a udev rule for the hidraw device.

---

## 2. Reference repositories (all cloned in the scratchpad, see §8)

| Repo | Role | Revision used |
|---|---|---|
| `kriomant/ch57x-keyboard-tool` (upstream, Rust) | Authority for YAML syntax, action grammar and packet formats for 884x / 8890 / 8850 (4×4) | `bdbffca` "Add screen brightness and web page media keys (#190)" |
| `PollRobots/ch57x-programmer` (TypeScript) | Original WebHID reference; used as a second oracle for packet formats | `355e40f` "Writing to 8890 tested and functional" |
| `daifukusensei/ch57x-keyboard-tool-enhanced` (the **user's fork**) | The only source of the working protocol for the user's 514c:8850 **12-key/4-knob** pad | `fa28f19` |

Where sources disagree the editor follows **upstream**, except for the 514c:8850 12-key pad where it follows the **fork** (see §4.3).

---

## 3. Architecture of the HTML file

Four inline `<script>` blocks, in this order (line numbers approximate, current file):

| Block | ~Lines | Purpose |
|---|---|---|
| `<script id="theme-init">` (in `<head>`) | 207 | Applies saved theme before first paint (no flash). |
| `<script id="core">` | 428–1037 | **Pure logic, no DOM.** Action validation, YAML parse/export, state model, protocol encoders, upload planner, upload-script generator, `EXAMPLE` YAML. |
| `<script id="ui">` | 1039–1494 | All DOM code: rendering, palette, events, WebHID connect/preview/upload, upload-script drawer, init. |
| `<script id="theme-ui">` | 1495+ | Theme toggle button. |

**The test suites extract `<script id="core">` with a regex and run it with `new Function(...)`.** So: keep the `id="core"` tag, keep core free of `document`/`window`, and keep the function names the tests import (listed below).

### 3.1 Core (important functions)

- **Validation**: `validateAction(raw)` → `{level:'ok'|'warn'|'error', kind:'empty'|'keys'|'media'|'mouse'|…, msgs[]}`; helpers `splitTop`, `splitDash`, `mouseParse`, `inRange` (mouse values clamp to **-127..127**).
- **YAML subset parser** (hand-written, no library): `stripComment`, `splitFlow`, `parseScalar`, `parseYaml`. Each parsed line is `{indent,text,comment}`; a trailing `# …` comment is kept (see §5).
- **State**: `blankLayer`, `normalizeState` (clamps rows/cols/knobs, sizes every layer), `fromObj` (YAML object → state), `toYaml` (state → YAML). State shape:
  ```js
  { model, orientation, rows, columns, knobs,
    layers: [{ buttons: [[str]],            // R x C action strings
               knobs:   [{ccw,press,cw}],
               bnotes:  [[str]],            // R x C comments
               knotes:  [{ccw,press,cw}] }] }
  ```
- **Protocol**: `parseActionToMacro` (action string → macro), `keyIdFor`, `bind884x`, `bind8890`, `bind8850`, `bind884xFork`, `bindPackets(family,layer,key,macro)`, `familyWarnings`, `makeReport` (pads to 64 bytes), `buttonIndex` (orientation → hardware index), `planUpload(state,family,which)` → `{packets,items,skipped,errors,warnings}`.
- **Devices**: `DEVICES` table, `deviceInfo`, `familyFromProductId`, `resolveFamily(vid,pid,state)`.
- **Upload script**: `makeUploadScript(yaml, os, tool, sudo)` (sh / PowerShell fallback for non-WebHID browsers).

### 3.2 UI

QMK-Configurator-style layout (the user asked for "simplified, looks like QMK's"):

- Top nav (title, Help link, theme toggle) → layout settings card (orientation, rows, columns, knobs, "Load repo example", "New blank", one-line layout hint) → **layer column** (1/2/3…, add/duplicate/remove) beside a dark **"case"** with 3D keycaps (buttons grid + knobs drawn as dashed dials with ↺ ccw / ● press / ↻ cw) → status line + collapsible legend + **Show comments on keys** switch → **selected-key editor** (action text box, "Add as next chord", Clear, message area, **Comment** box) → **keycode palette** (tabs Basic / Media / Mouse / Advanced) → sticky **upload bar** (Connect, Read device info, layers selector, Preview packets, Upload) → collapsed drawers: YAML (copy/download/import), CLI-script fallback, Help.
- Main render functions: `renderAll` → `renderSettings`, `renderTabs`, `renderDevice` (uses `cellEl`), `renderEditor`, `renderMsg`, `renderYaml`, then `hidSync()` (**required**: the protocol for 514c:8850 depends on the layout, so the info/upload buttons must be re-synced after any layout change).
- Palette: `buildControls`, `wirePalette`, `setPane`, `assignKey`, `assignMouse`, `applyAction`. Modifiers are one-shot chips; "Add as next chord" appends instead of replacing (palette caps a sequence at 5 chords; the validators allow more per family).
- Delay: one button toggles **Apply delay option ↔ Remove delay option** (`syncDelayUi`, `DELAY_RE`).
- Confirmations (`confirm()`): Load repo example, New blank, and Clear (only when the action is non-empty).
- Theme: light/dark toggle, saved in `localStorage['ch57x-theme']`, defaults to system.

### 3.3 Element IDs the tests rely on (don't rename casually)

`orientation rows columns knobs btnExample btnBlank tabs device action actionMsg btnClear delay btnDelay yamlOut yamlIn btnImport fileIn btnCopy btnDownload hidConnect hidInfo hidLayers hidPreview hidUpload hidStatus hidPlan upOs upTool upSudo upSudoWrap btnUpScript btnUpCopy summary toast themeToggle editTitle seqMode modChips modRow ptab-* pane-* mx my mn mbtn msMove msDrag msWheel bhid hidCodeSet yamlDrawer cliDrawer help helpLink note showNotes showNotesWrap` plus classes `.cell .dial .tab .note .hasnote`.

### 3.4 Persistence (localStorage, all wrapped in try/catch)

| Key | Contents |
|---|---|
| `ch57x-editor-v1` | `{state, layerIdx}` — the whole mapping incl. comments |
| `ch57x-editor-notes` | `'1'`/`'0'` — "Show comments on keys" preference (a viewer preference, not part of the mapping) |
| `ch57x-theme` | `'light'` / `'dark'` |

---

## 4. Protocol decisions

### 4.1 Device table

| USB id | Family key | YAML `model:` | Notes |
|---|---|---|---|
| 1189:8840, 1189:8842 | `884x` | `ch57x-1` | up to 3 knobs, 15 buttons, delay ≤ 6000 ms, ≤ 18 chords |
| 1189:8890 | `8890` | `ch57x-2` | up to 3 knobs, 12 buttons, **no delay support**, ≤ 6 chords |
| 514c:8850 | `8850` or `884x-514c` | `ch57x-3` | **two different keyboards share this id** (§4.3) |

WebHID details: filter on VID/PID **and** require an output report with `reportId === 3`; each 64-byte packet is sent with `sendReport(3, data)`; the leading `0x03` seen in the Rust sources is the report ID, so it is **not** in the editor's byte arrays. "Read device info" sends `fb fb fb` and reads an input report starting `0xfb` (buttons, encoders) — enabled for `884x` and `884x-514c` only.

### 4.2 Things settled during the work

- **Mouse range is -127..127** editor-wide (UI inputs, validator, upload parser). -128 is rejected on purpose (upstream oracle shows it as an intentional difference).
- **Alt mouse modifier = 0x04** (upstream), not 3 (ch57x-programmer). Verified against upstream output.
- **Delay on 1189:8890 is an error, not a bug.** The 8890 firmware has no delay; upstream, the fork and ch57x-programmer all refuse it. The editor now says so explicitly while editing (amber warning on the key) and at upload ("Cannot upload — Layer 1 R1 C1: …"). Triggered by the user report "1 action(s) cannot be uploaded — fix them first".
- **Mouse works on 8890** in upstream, the fork and the programmer. The fork sends `Move` as **(y,x)** on 8890 whereas upstream/programmer send **(x,y)**; the editor follows upstream. *Open question for the user: does their 8890 move on the wrong axis?*
- **Orientation**: `buttonIndex()` maps the grid position (as seen in the chosen orientation) to hardware index; knob order is reversed for `upsidedown` and `clockwise` (mirrors `reorient_row()` in the original tool).
- Empty actions are **skipped** on upload (whatever is on the keyboard for that key stays).

### 4.3 514c:8850 — the 12-key / 4-knob pad (`884x-514c`)

Ported from the user's fork (`src/keyboard/k884x.rs`, `Keyboard884x::bind_key`). Differences from upstream 884x:

- header byte is **always the chord count** (upstream writes 0 for a single modifier-only chord);
- every mouse action is `[5, modifier, button, x, y, wheel]`;
- a **click ignores its modifier** (editor warns via `familyWarnings`), **wheel is ±1 only**, **drag is unavailable**;
- **delay packet** = a full copy of the main packet with kind byte `5` and the delay in bytes 4–5 (max 6000 ms); a delay counts as one of the **max 18 entries**;
- **knob 4** uses key ids 13–15 (`keyIdFor`); max 4 knobs.

**Which keyboard is it?** The USB ids can't tell the 4×4 pad (upstream `k8850_4x4`, `ch57x-3`) from the 12-key pad, so `resolveFamily` decides by layout: `rows*columns === 16` → 4×4 (`8850`), otherwise `884x-514c`. The connect message says "— chosen from your layout".

> **Verified byte-for-byte against the fork's Rust output, but NOT tested on hardware by us.** The user should confirm on their device.

---

## 5. Per-key comments (the most recent feature, completed this session)

User request: *"Include the ability to add a comment to each key. Text prefaced with # are ignored… This would help knowing what each key does when importing a file."* (attached `daise_514C-8850.yaml`, CRLF line endings.)

**File convention (matches the user's file):**

- **Button rows** carry **one** trailing comment with **one note per key, `;`-separated, in column order**:
  `- ["shift-f4", "ctrl-grave,4,2", "alt-4"]   # IntelliJ split; IntelliJ zen; IntelliJ hide tools`
- **Knob lines** carry their own comment on each of `ccw:` / `press:` / `cw:`.

**Implementation:**

- Parser: `parseYaml` stores `comment` on each line; `parseSeq` copies it onto flow-sequence rows (`arr.comment`) and across `- key: value` lines; `parseMap` stores per-key comments on a **non-enumerable** `__notes` property.
- `splitRowNotes(text, n)` splits a row comment into `n` notes (gaps keep positions; extras beyond `n` are joined onto the last key; trailing `;` adds nothing).
- Export: `toYaml` aligns the `#` column per block; `rowNote()` joins notes with `; `, trims trailing empties, and **turns a `;` typed inside a non-last note into `,`** (otherwise it would shift later notes). Knob notes may contain `;`.
- UI: **Comment** input under the action (`#note`, `getNote/setNote`), dot on commented keys (`.hasnote`), **Show comments on keys** (`#showNotes`) swaps the keycap text to the comment with the action in small type beneath (`.device.notes`, CSS vars `--cw/--ch`). Importing a file with comments auto-enables the view and the toast says e.g. `Loaded daise_….yaml · 30 comments on keys`. *Clear* clears only the action. Duplicate layer copies comments; resizing keeps comments on their keys.
- Backward compatible: a mapping with no comments exports **byte-identically** to the previous version; saved state from older versions gets empty notes (`normalizeState`).

**Known limits (told to the user):** header comments and any comment not attached to a key row/knob line are dropped on export; `;` in a non-last button note becomes `,`.

---

## 6. Test and verification inventory

All live in the scratchpad (§8). **Every one of these passed on the final file.** Run from the scratchpad root unless noted.

| Command | Checks | Final result |
|---|---|---|
| `node test_core.js /home/claude/ch57x-config-editor.html` | core parse/validate/YAML round-trip, range -127..127, upload-parser limits | `ALL PASSED` |
| `cd tools && node oracle_cmp.cjs` | JS packets vs **upstream Rust** output (`orig/oracle.txt`) for drivers 884x/8890/8850, layers 0 & 2, 8 key positions × 70 actions | 1040 ok / 0 bad per family; 0 differing; 0 orientation mismatches; only intentional `-128` rejections |
| `node tools/fork_cmp.cjs [html]` | JS 12-key protocol vs **fork Rust** output (`fork/fork_oracle.txt`) | `ALL OK` |
| `node tools/compare.cjs` | JS vs **ch57x-programmer TS reference** (`tools/ref.cjs`, bundled from `ref_entry.ts` with esbuild) | `1460 checks, 0 failed` |
| `node tools/notes_test.cjs [html]` | comment parse/export/round-trip/edge cases using `notes/user.yaml` | `ALL PASSED` |
| `node tools/ui_notes_test.cjs` | comment UI end-to-end (jsdom) | `ALL PASSED` |
| `node tools/ui_test.cjs`, `ui_test3.cjs`, `ui_test8890.cjs`, `ui_test_palette.cjs`, `confirm_test.cjs`, `theme_test.cjs`, `delay_clear_test.cjs`, `delay8890.cjs` | UI flows with **mocked WebHID devices** (jsdom), palette, confirmations, theme, delay toggle, 8890 behaviour | all `ALL PASSED` |
| `shot_*.js` (Playwright) | screenshots used for visual QA (desktop/mobile, light/dark; no horizontal page scroll at 320/360 px) | visual only |

Regenerating the Rust oracles: both repos have a scratch-only `#[cfg(test)]` module (`oracle::dump`, in `src/keyboard/mod.rs`; the fork also has `oracle::bind` in `k884x.rs`). Run that test with env `ORACLE_ACTIONS=<actions file>` (`orig/actions.txt`, `fork/fork_actions.txt`) and capture stdout lines starting `ORACLE|` / `FORK|` into `orig/oracle.txt` / `fork/fork_oracle.txt`. **These harness edits are uncommitted local changes in the clones; they are not part of the deliverable.**

Dependencies for the JS tests (in `tools/package.json`): `jsdom`, `esbuild`, `zod`. Playwright + Chromium were preinstalled in the cloud container — install them yourself locally.

---

## 7. Remaining tasks / open items

**Awaiting the user**
1. The user's message *"Two things: * mouse movement is only in the range of -127 to 127"* arrived with the **second bullet missing**. Ask what it was.
2. Does `move(x,y)` go the wrong way on their **1189:8890**? If yes, switch that family to the fork's (y,x) order.
3. **Hardware confirmation** that the 514c:8850 12-key upload (ported from their fork) behaves on their device.

**Optional features discussed but not built**
4. Export in the **fork's YAML syntax** (`delay[ms]`, `mousemove[x,y]`) as an alternative to upstream syntax (editor currently only writes upstream syntax; the fork-syntax mapping exists in `tools/fork_cmp.cjs: toEditor()`).
5. Preserve **file-header comments** on re-export (currently dropped).
6. LEDs are deliberately **out of scope** (separate CLI command, not in the YAML); Help mentions them.

**Suggested engineering clean-up (my recommendation, not yet agreed with the user)**
7. Move to a real repo: split into `core.js`, `ui.js`, `style.css`, `index.template.html` plus a small script that **inlines everything into the single deliverable HTML** (keep `<script id="core">` so the tests keep working). `git init`, CI running the test list in §6.
8. Parameterise the tests: most hard-code `/home/claude/ch57x-config-editor.html` and scratchpad-relative paths (`../orig/oracle.txt`); only `test_core.js`, `fork_cmp.cjs`, `notes_test.cjs` accept a path argument.
9. **Delete `qmk/assemble.py`.** It rebuilds the page from `qmk/before-qmk-style.html` (the pre-comments, pre-redesign core). Re-running it would **overwrite the comment feature**. All later edits were made directly to the deliverable.
10. Commit the oracle harness (or a tiny Rust `examples/` binary) so the oracle files are reproducible without hand-patched clones.
11. Consider a smoke test of the real WebHID path with a physical device (everything so far uses mocks).

---

## 8. File map

**Deliverable**
- `/home/claude/ch57x-config-editor.html` — the app (file mode is read-only for non-root; root edits work).
- `/home/claude/HANDOFF.md` — this document.

**Scratchpad** `/tmp/claude-0/-home-claude/038a93d8-c1b4-51f4-8b47-ffcf9aa7b814/scratchpad/` *(ephemeral — copy what you need out of it before it is cleaned up)*

```
ch57x-config-editor.html     older copy; ignore (deliverable is in /home/claude)
test_core.js                 core test (takes html path as argv[2])
gen.js                       upload-script generator check (takes html path)
shot*.js, *.png              Playwright screenshots / visual QA
notes/user.yaml              the user's attached file (CRLF) — fixture for the comment tests
notes/exported.yaml          export of that file produced by the editor
orig/  src/ oracle.txt actions.txt    upstream clone + harness + oracle output
fork/  src/ fork_oracle.txt fork_actions.txt   the user's fork + harness + oracle output
pr/    src/                  ch57x-programmer clone (TS reference)
up/                          generated upload.sh / upload.ps1 / mapping.yaml samples
qmk/   before-qmk-style.html head_body.html render.js builder.js assemble.py   redesign working files (STALE — see §7.9)
tools/ oracle_cmp.cjs fork_cmp.cjs compare.cjs ref.cjs ref_entry.ts
       ui_test*.cjs ui_notes_test.cjs notes_test.cjs confirm_test.cjs theme_test.cjs
       delay_clear_test.cjs delay8890.cjs  package.json node_modules/
```

---

## 9. History of requests (for context, chronological)

1. Build a web frontend for the Rust tool, strictly HTML → add automatic upload.
2. Leverage `ch57x-programmer` to upload from the browser while **keeping the original YAML syntax**.
3. Questions about where "only 3 knobs" came from; removed the **model dropdown** (kept `model:` in YAML, filled from the connected device); **added ch57x-3 (514c:8850)**.
4. Same confirmation dialog for *Load repo example* as for *New blank*; **light/dark theme toggle**; reworded layout hint + 4-line legend (explaining "R1 C1" etc.); **renamed** to *CH57x Macropad Config Editor*; confirm before *Clear*; **Apply ↔ Remove delay** button.
5. **Support for the user's 514c:8850 12-key/4-knob pads** by porting their fork's protocol.
6. Mouse range **-127..127**; the **8890 delay** error explained and made explicit; confirmed mouse is supported on 8890.
7. **QMK-style interface redesign.**
8. **Per-key comments** (§5) — latest, completed and delivered.

---

## 10. Pitfalls already hit (so you don't repeat them)

- New assertions placed **after `process.exit(...)`** silently never run.
- After a layout change the Connect/Info buttons went stale → `renderAll()` must end with `hidSync()`.
- Byte offsets in UI tests changed when the protocol started depending on layout (e.g. `slice(9,15)==='5,0,1,0,0,0'` for the 12-key click).
- Small keycaps broke long names mid-word (`wheeldown`) — knob caps are 64×56 / round 66 px with a 9.5 px font.
- Playwright screenshots: the sticky upload bar overlaps lower content in short-viewport screenshots — a screenshot artefact, not a layout bug (use a taller viewport).
- A test that strips comments with `/\s+#.*$/` fails on CRLF input; use `split(/\r?\n/)`. The editor itself handles CRLF.
- Don't commit or share anything that depends on `localStorage` surviving: every access is wrapped in try/catch and the page must render without it.
