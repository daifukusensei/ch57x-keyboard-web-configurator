# CH57x Keyboard Web Configurator — handoff to Claude Code

*Written 2026-11-15 for the hand-over; updated the same day after the move to this repo (split into `src/` + `build.mjs`, tests in `test/`, CI). Source of truth for the code is now `src/`; `ch57x-keyboard-web-configurator.html` is the built single-file deliverable (see `README.md`).*

---

## 1. What this is

A **single-file, strictly-HTML** web app: a visual editor for the YAML mapping files used by
[kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool), with **direct upload to the keyboard from the browser via WebHID** (no CLI needed). Name shown in the UI: **CH57x Keyboard Web Configurator** (renamed from *CH57x Macropad Config Editor* on 2026-11-15).

Hard requirements that came from the user and must be preserved:

1. **One `.html` file**, no build step, no runtime dependencies, no network calls.
2. **YAML syntax identical to the upstream tool**, so files round-trip with the original CLI (`validate` / `upload`).
3. **Direct upload from the browser** (Chrome/Edge desktop, WebHID), with the original CLI for other browsers (Help explains it; the generated upload script was removed 2026-11-23).
4. The `model:` field is **not in the UI**; it is written into the YAML from the connected keyboard.
5. The user's own hardware: **514c:8850 12-key / 4-knob macropads** (and they have also used a **1189:8890** board). They use Windows-style (CRLF) YAML files.

Browser support: WebHID is Chrome/Edge desktop only. Linux needs a udev rule for the hidraw device.

---

## 2. Reference repositories (`npm run fetch-refs` clones them into `refs/`)

| Repo | Role | Revision used |
|---|---|---|
| `kriomant/ch57x-keyboard-tool` (upstream, Rust) | Authority for YAML syntax, action grammar and packet formats for 884x / 8890 / 8850 (4×4) | `bdbffca` "Add screen brightness and web page media keys (#190)" |
| `PollRobots/ch57x-programmer` (TypeScript) | Original WebHID reference; used as a second oracle for packet formats | `355e40f` "Writing to 8890 tested and functional" |
| `daifukusensei/ch57x-keyboard-tool-enhanced` (the **user's fork**) | The only source of the working protocol for the user's 514c:8850 **12-key/4-knob** pad | `fa28f19` |

All three are MIT-licensed (upstream and the fork are MIT OR Apache-2.0, used under MIT). This project is MIT (`LICENSE`); the required notices and the files that copy or port from each repo are in `THIRD-PARTY-NOTICES.md`, the built HTML carries a notice comment from `src/index.template.html`, and `ref.cjs` gets a banner from `build:ref`. When copying more from a reference repo, update `THIRD-PARTY-NOTICES.md`.

Where sources disagree the editor follows **upstream**, except for the 514c:8850 12-key pad where it follows the **fork** (see §4.3).

---

## 3. Architecture of the HTML file

`build.mjs` inlines the `src/` files into `src/index.template.html`, giving one `<style>` and four inline `<script>` blocks, in this order:

| Block | Source | Purpose |
|---|---|---|
| `<style>` | `src/style.css` | All styles. |
| `<script id="theme-init">` (in `<head>`) | `src/theme-init.js` | Migrates renamed localStorage keys (§3.4), then applies the saved theme before first paint (no flash). |
| `<script id="core">` | `src/core.js` | **Pure logic, no DOM.** Action validation, YAML parse/export, state model, protocol encoders, upload planner, upload-script generator, `EXAMPLE` YAML. |
| `<script id="ui">` | `src/ui.js` | All DOM code: rendering, palette, events, WebHID connect/preview/upload, upload-script drawer, init. |
| `<script id="theme-ui">` | `src/theme-ui.js` | Theme toggle button. |

The scripts are classic (non-module) scripts sharing one global scope: `ui.js` calls `core.js` functions directly. `build.mjs` refuses a part that contains `</script` / `</style` or CR line endings.

**The test suites extract `<script id="core">` from the built HTML with a regex and run it with `new Function(...)`.** So: keep the `id="core"` tag, keep core free of `document`/`window` (`test/core_purity.cjs` enforces this), and keep the function names the tests import (listed below).

### 3.1 Core (important functions)

- **Validation**: `validateAction(raw)` → `{level:'ok'|'warn'|'error', kind:'empty'|'keys'|'media'|'mouse'|…, msgs[]}`; helpers `splitTop`, `splitDash`, `mouseParse`, `inRange` (mouse values clamp to **-127..127**).
- **YAML subset parser** (hand-written, no library): `stripComment`, `splitFlow`, `parseScalar`, `parseYaml`. Each parsed line is `{indent,text,comment}`; a trailing `# …` comment is kept (see §5).
- **State**: `blankLayer`, `normalizeState` (clamps rows/cols/knobs, forces exactly `LAYER_COUNT` = 3 layers by padding with blank ones or dropping extras, sizes every layer), `fromObj` (YAML object → state), `toYaml` (state → YAML). State shape:
  ```js
  { model, orientation, rows, columns, knobs,
    layers: [{ buttons: [[str]],            // R x C action strings
               knobs:   [{ccw,press,cw}],
               bnotes:  [[str]],            // R x C comments
               knotes:  [{ccw,press,cw}] }] }
  ```
- **Protocol**: `parseActionToMacro` (action string → macro), `keyIdFor`, `bind884x`, `bind8890`, `bind8850`, `bind884xFork`, `bindPackets(family,layer,key,macro)`, `familyWarnings`, `makeReport` (pads to 64 bytes), `buttonIndex` (orientation → hardware index), `reorient(state,to)` (orientation change keeping keys/knobs/comments on their physical key; returns a `{button,knob}` map the UI uses to move the selection), `planUpload(state,family,which)` → `{packets,items,skipped,errors,warnings}`.
- **Devices**: `DEVICES` table, `deviceInfo`, `familyFromProductId`, `resolveFamily(vid,pid,state)`.
- **Layout rule**: `checkAction(st, raw, isButton)` = `validateAction` + upstream's `config.rs` rule that a pad with 1 row or 1 column **and** exactly 1 knob takes modifiers only on the first chord of a *button* sequence (`isOneRowOneKnob`, `oneRowViolation`, `ONE_ROW_MSG`). The UI uses `checkAction` everywhere it showed `validateAction` (key colour, message, summary); `planUpload` adds the same error. Verified case by case against upstream's `validate` binary.

### 3.2 UI

QMK-Configurator-style layout (the user asked for "simplified, looks like QMK's"):

- Top nav (title, Help link, theme toggle: amber ☀ in dark mode / indigo ☾ in light mode, classes `.sun`/`.moon`) → layout settings card (orientation, rows, columns, knobs, then the `.cfgbtns` group **Load config** / **Save config** / **New blank**, one-line layout hint) → **layer column** (fixed tabs 1/2/3: no add/duplicate/remove, every CH57x board has 3 layers) beside a dark **"case"** with 3D keycaps (buttons grid + knobs drawn as dashed dials with ↺ ccw / ● press / ↻ cw) → status line (`#summary`: error/warning counts and empty actions only; nothing when all is well) + link *What do the labels and outlines mean?* (`.legendlink` → Help `#help-keypad`) + **Show comments on keys** switch → **selected-key editor** (action text box, "Add as next step", Clear, message area, **Comment** box) → **keycode palette** (tabs Basic / Media / Mouse / Advanced; Basic is a drawn **full-size keyboard**, see below) → sticky **upload bar** (Connect, Read device info, **Write** selector `#hidLayers` = All layers / Layer 1 / Layer 2 / Layer 3 — values `all`/`0`/`1`/`2`, read by `hidWhich()`, independent of the layer on screen — Preview packets, Upload) → collapsed drawers: YAML (view/copy/paste), Help.
- **Config files**: *Load config* confirms (same replace-everything message as *New blank*), then clicks the hidden `#fileIn` (the OK click is still a user gesture, so the picker opens). *Save config* confirms, then downloads `#yamlOut` under `cfgName` (the name of the file last loaded, default `mapping.yaml`) with that file's line endings (`cfgCrlf`; the user's files are CRLF). *New blank* resets both. `loadText()` returns whether the import worked. The repo example is still the first-visit mapping, but no longer has a button.
- **Wording**: *chord*, as in the upstream tool (one key, optionally with modifiers; a sequence is up to 5 comma-separated chords); Help's Actions section defines both words. A step-based wording was tried on this branch and reverted (user's choice: match the source repo).
- **Message area** (`renderMsg`) shows only problems: errors, warnings, device-specific delay notes, or the *Empty* hint. A valid action shows nothing (the "✓ Valid … action" line was removed 2026-11-23).
- **Clear** (`#btnClear`) empties the action *and* its comment. It asks first when either is set: title *Clear this key?*, message `Layer 1 · Button row 4, column 1: "ctrl-k,o"` (or `…: comment "…"` when only a comment is set).
- **Help layout**: intro (`.lead` tagline "Visual editor for ch57x-keyboard-tool mapping files. By daifuku.", where *daifuku* links to this repo, as in the header tagline; then "Build a layout…" on its own line), then each topic in its own tile `section.hsec` (`#help-actions`, `#help-comments`, `#help-webhid`, `#help-cli`). Links with class `.helpjump` open the drawer through one delegated click handler, so links rendered later work too: the unknown-key warning ends "…or see Help" with a link to `#help-actions`. Order: intro → Reading the keypad (`#help-keypad`, the former collapsible legend) → Actions → Comments on keys → Direct upload (WebHID) → Without WebHID: the command-line tool (Save config, then `validate` / `upload`; sudo, Windows/USBDK and stdin notes). The WebHID-unavailable status messages point there.
- Main render functions: `renderAll` → `renderSettings`, `renderTabs`, `renderDevice` (uses `cellEl`), `renderEditor`, `renderMsg`, `renderYaml`, then `hidSync()` (**required**: the protocol for 514c:8850 depends on the layout, so the info/upload buttons must be re-synced after any layout change).
- Palette: `buildControls`, `wirePalette`, `setPane`, `assignKey`, `assignMouse`, `applyAction`. Modifiers are one-shot chips; "Add as next chord" appends instead of replacing (palette caps a sequence at 5 chords; the validators allow more per family).
- **Basic-tab keyboard** (2026-11-16; only the key *picker*, the macropad drawing is unchanged): `kbGeometry(iso)` gives each key `[name,x,y,w,h]` in key units for a full-size board (main block, navigation cluster, numpad from `KB_NUMPAD_X` = 18.5u). `buildBoard()` draws them as `.kcap`s inside `#kbBoard`, each wrapper carrying `--x --y --w --h`; CSS turns those into percentages of `--kbw` (22.5u, or 18.25u under 700 px where the numpad `.np` keys are hidden and the same keycodes appear as a list in `#kbNumpad`). The board shrinks with `aspect-ratio` + container-query units, and below 760 px board width swaps long legends for `KB_SHORT`. Key names are positional HID usages, so a layout only changes the shape and legends: `KB_LAYOUTS` = `us` (ANSI) and `uk` (ISO: tall Enter, `nonushash` beside Enter, `nonusbackslash` beside a 1.25u Left Shift, UK legends `" £ @ ~ ¬ AltGr`). `detectKbLayout()` picks the first `KB_LAYOUTS[id].match` hitting `navigator.languages[0]` (`en-GB`/`en-UK`/`en-IE` → UK), else US; the `#kbLayout` select (Auto / US / UK) overrides it. Add a locale by adding a `KB_LAYOUTS` entry with `match` and `legend` overrides. Keycodes with no key on the current layout (`backslash` on ISO; `nonushash`/`nonusbackslash` on ANSI; `numpadequal` always) are listed in `#kbExtra`; F13–F24 stay a flat group in `#kbGroups`. The board's modifier keys carry `data-mod` and toggle the same one-shot chips as `#modChips` (`toggleMod`/`syncMods`), so `#modRow` is shown only on the Mouse tab. Page width (`main`, `.nav-in`) is 1240 px max (was 1100) so the full-size board keeps ~50 px keys.
- **Keypad canvas** (2026-11-17): keycap text uses the same font token as the Basic keyboard (`--ui-font`, system UI sans, 600 weight, 12.5 px; it was 11 px monospace before). Default sizes: buttons 86×76 (`--cw/--ch`; 132×96 with comments shown), knob caps 84×66 + round 80 px. **Zoom** 60–200 % in 10 % steps: the `#zoomOut #zoomReset #zoomIn` pill at the top right of `.case`, or Ctrl/⌘ + wheel over the case (page zoom is prevented only there). `applyZoom()`/`setZoom()` set `--zoom` on `#device`, and CSS applies `zoom:var(--zoom)` to `.device`'s children, so layout grows and `.device` scrolls horizontally. Upside-down / counter-clockwise put the knobs first with `order:-1` rather than `row-reverse`/`column-reverse`, because overflow on the start side of a reversed flexbox can't be scrolled to.
- Delay: one button toggles **Apply delay option ↔ Remove delay option** (`syncDelayUi`, `DELAY_RE`).
- Confirmations use the in-page dialog `askConfirm(message,{title,ok,danger})` → `Promise<boolean>` (markup `#confirmDlg` / `.modal-box` with `#confirmTitle #confirmMsg #confirmCancel #confirmOk`), never `window.confirm`/`alert`. Faded backdrop (`--scrim`, per theme); Esc, Cancel or a click on the backdrop = cancel (a drag that starts inside the box doesn't count); Enter = OK unless Cancel has focus; Tab is kept inside; focus returns to the opener. Used by Load repo example, New blank, Clear (only when the action is non-empty), Upload to keyboard, and generating the CLI script with invalid actions. Callers are `async` and `await` it; the upload handler re-checks `hidDev`/`hidBusy` after the dialog. While open, `body.modal-open` locks page scroll; `html{scrollbar-gutter:stable}` keeps the scrollbar's space reserved so the page doesn't shift sideways when the scrollbar disappears (checked with real scrollbars: Playwright hides them by default, launch with `ignoreDefaultArgs:['--hide-scrollbars']`).
- Theme: light/dark toggle, saved in `localStorage['ch57x-configurator-theme']`, defaults to system.

### 3.3 Element IDs the tests rely on (don't rename casually)

`orientation rows columns knobs btnLoad btnSave btnBlank tabs device action actionMsg btnClear delay btnDelay yamlOut yamlIn btnImport fileIn btnCopy hidConnect hidInfo hidLayers hidPreview hidUpload hidStatus hidPlan summary toast themeToggle editTitle seqMode modChips modRow ptab-* pane-* mx my mn mbtn msMove msDrag msWheel bhid hidCodeSet yamlDrawer cliDrawer help helpLink note showNotes showNotesWrap zoomIn zoomOut zoomReset confirmDlg confirmTitle confirmMsg confirmOk confirmCancel kbLayout kbBoard kbNumpad kbExtra kbGroups` plus classes `.cell .dial .tab .note .hasnote .kcap .isoenter` and `.kb.ansi`/`.kb.iso` on `#kbBoard`.

### 3.4 Persistence (localStorage, all wrapped in try/catch)

| Key | Contents |
|---|---|
| `ch57x-configurator-v1` | `{state, layerIdx}` — the whole mapping incl. comments |
| `ch57x-configurator-notes` | `'1'`/`'0'` — "Show comments on keys" preference (a viewer preference, not part of the mapping) |
| `ch57x-configurator-theme` | `'light'` / `'dark'` |
| `ch57x-configurator-zoom` | `'60'`…`'200'` — keypad canvas zoom in %, a viewer preference; anything else falls back to 100 |
| `ch57x-configurator-kblayout` | `'auto'` (default, from the browser language) / `'us'` / `'uk'` — Basic-tab keyboard layout; an unknown value falls back to auto |

Until 2026-11-15 these were `ch57x-editor-v1`, `ch57x-editor-notes` and `ch57x-theme`. `src/theme-init.js` (the first script to run) copies an old value to its new key once, if the new key is empty. Old keys are kept so an older copy of the page still works. Renaming a key again needs the same kind of migration.

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
- **Orientation**: `buttonIndex()` maps the grid position (as seen in the chosen orientation) to hardware index; knob order is reversed for `upsidedown` and `clockwise` (mirrors `reorient_row()` in the original tool). Changing the orientation in the editor moves each action and comment to the cell with the same hardware index, and flips the knob list when the reversal rule changes, so the upload is unchanged (`reorient()`, called from `rebuildFromSettings`); before 2026-11-23 the grid was simply truncated/padded, losing or misplacing keys.
- Empty actions are **skipped** on upload (whatever is on the keyboard for that key stays).

### 4.3 514c:8850 — the 12-key / 4-knob pad (`884x-514c`)

Ported from the user's fork (`src/keyboard/k884x.rs`, `Keyboard884x::bind_key`). Differences from upstream 884x:

- header byte is **always the chord count** (upstream writes 0 for a single modifier-only chord);
- every mouse action is `[5, modifier, button, x, y, wheel]`;
- a **click ignores its modifier** (editor warns via `familyWarnings`), **wheel is ±1 only**, **drag is unavailable**;
- **delay packet** = a full copy of the main packet with kind byte `5` and the delay in bytes 4–5 (max 6000 ms); a delay counts as one of the **max 18 entries**;
- **knob 4** uses key ids 13–15 (`keyIdFor`); max 4 knobs.

**Which keyboard is it?** The USB ids can't tell the 4×4 pad (upstream `k8850_4x4`, `ch57x-3`) from the 12-key pad, so `resolveFamily` decides by layout: `rows*columns === 16` → 4×4 (`8850`), otherwise `884x-514c`. The connect message names only the keyboard type (e.g. `… · ch57x-3 · protocol 884x-514c (12-key/4-knob)`); until 2026-11-19 it also said "— chosen from your layout", removed at the user's request. The Help text still explains that the layout decides.

> **Verified byte-for-byte against the fork's Rust output, but NOT tested on hardware by us.** The user should confirm on their device.

---

## 5. Per-key comments

User request: *"Include the ability to add a comment to each key. Text prefaced with # are ignored… This would help knowing what each key does when importing a file."* (attached `daise_514C-8850.yaml`, CRLF line endings.)

**File convention (since 2026-11-17, user's decision):** one `#@` line per key, in a block at the top of the file right after the `# Generated by` line. The tool sees ordinary YAML comments.

```
#@ L1 R2 C1: IntelliJ split
#@ L1 K1 ccw: decrease zoom
```

- `L` layer, `R`/`C` button row/column, `K` knob + `ccw|press|cw`; all 1-based, in the **file's** order (`buttons[r][c]`, so vertical orientations index the file rows, the same numbers the editor shows).
- Text runs to the end of the line verbatim (trimmed); no escaping. Line breaks/tabs typed in a note become spaces on export.
- **Same-line comments (`- [..]  # a; b; c`, `ccw: ".."  # x`) are no longer read**: the user asked to remove that support. Their files in the old format were converted with the previous build (`test/fixtures/user-notes.yaml` is `user.yaml` converted). History: the old format split a row comment on `;` (first saving `;` as `,`, then briefly escaping it as `\;`), which is why it was replaced.

**Implementation:**

- Parser: `parseYaml` takes every line starting with `#@` (before `stripComment`) through `parseNoteLine` (`NOTE_LINE` regex, case-insensitive, flexible spacing; malformed → `null`) and attaches the list to the root as the **non-enumerable** `__keyNotes`. `#@` inside a quoted action is not a comment line.
- `fromObj` applies them after `normalizeState`; a later line for the same key wins. Lines naming no key on the pad (or malformed) are counted in the non-enumerable `st.unmatchedNotes` (not saved), and `loadText` adds `· N comment line(s) matched no key (skipped)` to the toast.
- Export: `toYaml` writes a two-line explanation plus `noteLines(st)` (buttons row by row, then knobs ccw/press/cw, per layer) only when there are notes; key lines carry no comments.
- UI: **Comment** input under the action (`#note`, `getNote/setNote`), dot on commented keys (`.hasnote`), **Show comments on keys** (`#showNotes`) swaps the keycap text to the comment with the action in small type beneath (`.device.notes`, CSS vars `--cw/--ch`). Importing a file with comments auto-enables the view and the toast says e.g. `Loaded daise_….yaml · 30 comments on keys`. *Clear* clears the action and its comment (until 2026-11-23 it kept the comment). Resizing keeps comments on their keys.
- Backward compatible: a mapping with no comments exports **byte-identically** to the previous versions (apart from the `# Generated by …` header line, which changed with the 2026-11-15 rename); saved state from older versions gets empty notes (`normalizeState`).

**Known limits:** other comments (file header, same-line) are dropped on export (§7 item 5).

**Symbols typed as key actions:** the tool only accepts key *names* (`semicolon`, not `;`). `validateAction` reports a typed symbol (`CHAR_KEYS` in `core.js`) as an **error** naming the key to use, e.g. `";" is not a key name; use "semicolon"`, and for shifted symbols the US-layout chord (`:` → `shift-semicolon`). `,` and `-` are not listed because they separate chords and modifiers.

---

## 6. Test and verification inventory

`npm test` runs every `test/*.cjs` against the built `ch57x-keyboard-web-configurator.html` (pass another path with `npm test -- other.html`); each suite also runs alone with `node test/<suite>.cjs [html]`. CI (`.github/workflows/test.yml`) runs `npm ci`, `npm run check` (built HTML up to date with `src/`) and `npm test`; a second job `oracles` installs Rust, runs `fetch-refs.sh` + `regen-oracles.sh` and fails if `test/fixtures` changes.

| Suite | Checks | Result |
|---|---|---|
| `test_core.cjs` | core parse/validate/YAML round-trip, range -127..127, upload-parser limits, typed symbols (`;`, `:`) rejected with the key name | `ALL PASSED` |
| `oracle_cmp.cjs` | JS packets vs **upstream Rust** output (`fixtures/upstream-oracle.txt`) for drivers 884x/8890/8850, layers 0 & 2, 8 key positions × 70 actions | 1040 ok / 0 bad per family; 0 differing; 0 orientation mismatches; only intentional `-128` rejections |
| `fork_cmp.cjs` | JS 12-key protocol vs **fork Rust** output (`fixtures/fork-oracle.txt`) | `ALL OK` |
| `compare.cjs` | JS vs **ch57x-programmer TS reference** (`reference/ref.cjs`, bundled from `reference/ref_entry.ts` by `npm run build:ref`). Media table compared where shared: the editor adds upstream's web-page keys, and ch57x-programmer's own extras (e.g. `KbBrightnessUp`) are not in upstream's grammar | `1460 checks, 0 failed` |
| `notes_test.cjs` | `#@` comment parse/export/round-trip (CRLF), odd characters, unmatched lines, vertical layouts, same-line comments ignored; uses `fixtures/user-notes.yaml` (the user's file in `#@` form) and `fixtures/user.yaml` (old same-line form); upstream's `example-mapping.yaml` (`fixtures/upstream-example.yaml`, MIT) keeps its mapping and yields no key comments, LF and CRLF; backward compatibility against `fixtures/before-comments.html`; writes `fixtures/exported.yaml` | `ALL PASSED` |
| `reorient_test.cjs` | orientation change: for 5 layouts × all 12 orientation pairs the upload bytes (by hardware index) are unchanged, comments follow their key, knobs flip as needed, and changing back restores the file; UI (jsdom): grids, knob order, `#@` lines and the selection follow the key | `ALL PASSED` |
| `ui_notes_test.cjs` | comment UI end-to-end (jsdom): `#@` lines written per key, cleared notes drop their line, Clear empties action and comment (asks for a comment alone too), unmatched-line toast, same-line comments not read | `ALL PASSED` |
| `ui_test_kblayout.cjs` | Basic-tab keyboard: ANSI for `en-US`, ISO + UK legends for `en-GB`/`en-IE`, 104/105 keys incl. numpad, phone numpad list matches, saved override, board modifiers, every former palette keycode still offered once (ignoring the phone list) | `ALL PASSED` |
| `config_file_test.cjs` | Load config / Save config: both ask first (Cancel does nothing), order Load → Save → New blank, no repo-example/download/file-chooser controls left, tagline text; Load opens the picker and imports; Save downloads under the loaded name with CRLF kept and `#@` lines, and after New blank as `mapping.yaml` with LF | `ALL PASSED` |
| `confirm_test.cjs` | confirmation dialog (driven from Load config, New blank, Save config): opens instead of `window.confirm`, Enter = OK (Cancel when focused), Esc / backdrop / Cancel = cancel, inside-drag doesn't cancel, Tab trapped, focus restored | `ALL PASSED` |
| `ui_test.cjs`, `ui_test3.cjs`, `ui_test8890.cjs`, `ui_test_palette.cjs`, `theme_test.cjs`, `delay_clear_test.cjs` | UI flows with **mocked WebHID devices** (jsdom), palette, theme, Clear confirmation, delay toggle, 8890 behaviour. Suites answer the dialog with `test/lib/autoconfirm.cjs` (OK/Cancel via `st.answer`; messages in `st.asked`/`st.last`; `await st.tick()` after the click) | `ALL PASSED` |
| `delay8890.cjs` | delay limits per family at upload (≤ 6000 ms; error on 8890; 4×4 8850 drops the delay like upstream, with a warning) | `ALL PASSED` |
| `upstream_rules_test.cjs` | upstream's 1-row/1-knob modifier rule (same pass/fail as upstream `validate`, in core and on the key in the page) and the web-page media keys binding on every family | `0 failed` |
| `storage_migration_test.cjs` | values under the old localStorage keys are carried over to the renamed ones; existing new keys win; old keys kept | `ALL PASSED` |
| `core_purity.cjs` | `src/core.js` uses no DOM/browser globals | `ALL PASSED` |
| `ui_test_zoom.cjs` | keypad zoom buttons + Ctrl+wheel, clamping at 60/200 %, persistence, bad/blocked localStorage; keypad text uses the same font token and size as `.kcap` | `all passed` |
| `scripts/shots/*.cjs` (Playwright, not in CI) | screenshots for visual QA (desktop/mobile, light/dark; no horizontal page scroll at 320/360 px), written to `scripts/shots/out/` | visual only; all 5 run and reviewed 2026-11-15, no horizontal scroll at 320–1100 px. `shot_kb.cjs` (US/UK × light/dark × 1300/1100/360 px) and `shot_confirm.cjs` (dialog, light/dark × desktop/phone) added and reviewed 2026-11-16. `shot_zoom.cjs` (60/100/150 %, comments and dots, phone) added and reviewed 2026-11-17. `shot_header.cjs` (header tagline, light/dark/phone) added and reviewed 2026-11-17 |

Regenerating the Rust oracles: `npm run fetch-refs` clones upstream, the fork and ch57x-programmer into `refs/` at the pinned revisions and applies `patches/*-oracle-harness.patch` (a `#[cfg(test)] mod oracle` with `oracle::dump` in `src/keyboard/mod.rs`; the fork also gets `oracle::bind` in `k884x.rs`). Then `sh scripts/regen-oracles.sh` (needs cargo) runs those tests with `ORACLE_ACTIONS=test/fixtures/{upstream,fork}-actions.txt` and writes the `ORACLE|` / `FORK|` lines to `test/fixtures/{upstream,fork}-oracle.txt`. *Verified 2026-11-15: the patched clones are byte-identical to the copies used originally, and the user's local run of `regen-oracles.sh` reproduced both oracle files exactly. The CI job `oracles` repeats this on every push.*

Dependencies (root `package.json`, dev only): `jsdom`, `esbuild`, `zod` (zod only for `build:ref`). Playwright is not a dependency; see `README.md`.

---

## 7. Remaining tasks / open items

**Awaiting the user** (asked again 2026-11-17: items 1–3a all still open; the user will answer item 1 later, has not yet tested 2 and 3 on hardware, and will capture 3a later)
1. The user's message *"Two things: * mouse movement is only in the range of -127 to 127"* arrived with the **second bullet missing**. Ask what it was.
2. Does `move(x,y)` go the wrong way on their **1189:8890**? If yes, switch that family to the fork's (y,x) order.
3. **Hardware confirmation** that the 514c:8850 12-key upload (ported from their fork) behaves on their device.
3a. **Delay on the 4×4 514c:8850.** The user says the 4×4 pad supports delays, but upstream (even latest `master`), the fork and ch57x-programmer have no 4×4 delay encoding. Since 2026-11-15 the editor warns (amber, while editing with a 4×4 connected + upload preview/confirm) that the delay is dropped. To implement it, ask for a **USB capture** (Wireshark + USBPcap) of the vendor software programming `a` with 100 ms and 1000 ms delays plus plain `a`; a best-guess 884x-style packet tested on hardware is the fallback.

**Optional features discussed but not built**
4. Export in the **fork's YAML syntax** (`delay[ms]`, `mousemove[x,y]`) as an alternative to upstream syntax (editor currently only writes upstream syntax; the fork-syntax mapping exists in `test/fork_cmp.cjs: toEditor()`).
5. Preserve **file-header comments** on re-export (currently dropped; `#@` key comments are kept, §5).
6. LEDs are deliberately **out of scope** (separate CLI command, not in the YAML); Help mentions them.

12. Gaps vs the reference repos still open (survey 2026-11-19): **reading the mapping back from the keyboard** + uploading only changed keys (ch57x-programmer; built and pushed on branch `feature/read-keyboard`, held off `main` by the user's choice, not tested on hardware; 1189:8890 has no known read format and would need a USB capture of the vendor software); LED control over WebHID (item 6); recording a macro by typing it, and named profiles (ch57x-programmer); upstream's initial 64-zero-byte packet before binding (ch57x-programmer doesn't send it either); `--vendor-id/--product-id` overrides for unlisted clones; a **4th knob on 1189:884x** (upstream `to_key_id` maps it to ids 13–15 when buttons ≤ 12, but `keyIdFor('884x', [3, …])` throws).
13. **Guard against the 4×4 protocol on a 12-key 514c:8850 pad** (for the user to review at their discretion; not built, don't start it unasked). With a 514c:8850 connected and a 16-button layout, `resolveFamily` picks the 4×4 protocol (`8850`), so an upload would send `fd …` binding packets the 12-key pad doesn't understand. Expected harm: wrong or missing bindings, fixed by re-uploading with the right layout. The packets only write key bindings and can't touch firmware (that needs the WCH bootloader mode), but the 12-key firmware's handling of them is untested. Proposed: (a) 514c:8850 + 16-button layout → Upload asks for confirmation, warning that a 12-key pad needs a non-16-button layout; (b) if Read device info reported 12 buttons / 4 knobs, Upload is blocked while the layout has 16 buttons.

**Engineering clean-up** — 7–10 done 2026-11-15 on branch `repo-split`
7. ~~Split into `src/` + inlining build, CI.~~ Done: `build.mjs`, `.github/workflows/test.yml`.
8. ~~Parameterise the tests.~~ Done: all resolve paths from their own location and accept an HTML path as `argv[2]`.
9. ~~Delete `qmk/assemble.py`.~~ Done, together with the rest of the stale `qmk/` redesign files.
10. ~~Make the oracles reproducible.~~ Done via `patches/` + `scripts/fetch-refs.sh` + `scripts/regen-oracles.sh` (cargo step untested here).
11. Consider a smoke test of the real WebHID path with a physical device (everything so far uses mocks).

---

## 8. File map

See the layout in `README.md`. The old scratchpad bundle was reorganised as follows: `tools/*.cjs` and `test_core.js` → `test/`; `notes/`, `orig/*.txt`, `fork/*.txt`, `qmk/before-qmk-style.html`, `up/it's-tool` → `test/fixtures/`; `tools/ref.cjs`, `ref_entry.ts` → `test/reference/`; `shot*.js` → `scripts/shots/`; `gen.js` + `up/` → `test/upload_script_test.cjs`. The vendored clones (`orig/src`, `fork/src`, `pr/src`) were replaced by `scripts/fetch-refs.sh`; the old screenshots, `qmk/` working files and `shot_qmk*.js` were dropped (all still in git history before `repo-split`).

---

## 9. History of requests (for context, chronological)

1. Build a web frontend for the Rust tool, strictly HTML → add automatic upload.
2. Leverage `ch57x-programmer` to upload from the browser while **keeping the original YAML syntax**.
3. Questions about where "only 3 knobs" came from; removed the **model dropdown** (kept `model:` in YAML, filled from the connected device); **added ch57x-3 (514c:8850)**.
4. Same confirmation dialog for *Load repo example* as for *New blank*; **light/dark theme toggle**; reworded layout hint + 4-line legend (explaining "R1 C1" etc.); **renamed** to *CH57x Macropad Config Editor*; confirm before *Clear*; **Apply ↔ Remove delay** button.
5. **Support for the user's 514c:8850 12-key/4-knob pads** by porting their fork's protocol.
6. Mouse range **-127..127**; the **8890 delay** error explained and made explicit; confirmed mouse is supported on 8890.
7. **QMK-style interface redesign.**
8. **Per-key comments** (§5), completed and delivered.
9. Moved to this git repo (2026-11-15): tests made path-independent; split into `src/` + `build.mjs`; tests moved to `test/`; reference repos fetched instead of vendored; CI added (tests + oracle reproducibility); 4×4 514c:8850 delay warning; `CLAUDE.md` added.
10. **Renamed** to *CH57x Keyboard Web Configurator* (page title, heading, `# Generated by` header in exported YAML and upload scripts). 
11. **Renamed the rest** (2026-11-15): the deliverable is now `ch57x-keyboard-web-configurator.html`, the npm package is `ch57x-keyboard-web-configurator`, and localStorage keys are `ch57x-configurator-*`, with a one-time migration from the old keys (§3.4).
12. (2026-11-16) Theme toggle tinted (amber sun / indigo moon). **Layers fixed at 3** (the CH57x maximum): add/duplicate/remove removed; imports and saved state are padded to 3, and a file with more than 3 layers keeps the first 3 (the import toast says so). Blank layers upload nothing, since empty keys are skipped.
13. (2026-11-16, branch `feature/physical-keyboard-layout`) Basic-tab key picker drawn as a **physical keyboard** whose shape and legends follow the browser language (UK ISO vs US ANSI), with a manual override. User's choices: replace the groups the board covers; shrink on small screens; hover unchanged; macropad drawing unchanged; more locales may come later. First built tenkeyless, then (same day, on request) full-size with the numpad on the board, page widened to 1240 px; on phones the numpad drops to a list. Light mode's macropad case lightened from near-black to slate grey (`--case` #c6cdd7, new `--case-inset` for the inner shadow) because the dark case clashed with the light page; dark mode unchanged.

14. (2026-11-16, branch `feature/confirm-dialog`) Browser `confirm()` pop-ups replaced by an **in-page confirmation dialog** styled like the page (light/dark), with faded background, Esc = cancel, Enter = OK, click outside = cancel.
15. (2026-11-16, branch `feature/write-layer-select`) **Write** dropdown lists All layers / Layer 1 / Layer 2 / Layer 3 instead of All layers / Current layer only.
16. (2026-11-17) Keypad canvas text made the **same typeface and size as the Basic keyboard**, keys and knobs enlarged, and a **zoom** control (−/100 %/+, Ctrl+wheel) added.
17. (2026-11-17) Header **tagline** under the title: "Tool to manage macropad mappings from [ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool). By daifuku." (link shows the repo name only, opens in a new tab). Comment handling reviewed: a `;` in a button note is now escaped as `\;` instead of becoming `,` (§5), and a symbol typed as a key action (`;`, `:`, `#`…) is an error that names the key to use.
18. (2026-11-17) Per-key comments moved to a **`#@ L1 R1 C1: text` block at the top of the file** (one line per key, no escaping); same-line comments are no longer read (user's choice, after comparing with one-key-per-line). The user's file converted with the previous build. Verified the same day: all 26 historical versions of upstream's and the fork's `example-mapping.yaml` import identically to the build before 2026-11-17 (mapping, action checks, export; LF and CRLF), with 0 key comments and 0 unmatched lines; upstream's own `validate` (v1.7.0, built from `refs/`) gives the same pass/fail for each original and the editor's export of it (26/26; the 2023 versions fail in both because the knob format changed), and passes the `#@` files.
19. (2026-11-19) **Licensing** for publication: added MIT `LICENSE` (copyright daifukusensei 2026 + Mikhail Trishchenkov 2023, as in ch57x-programmer) and `THIRD-PARTY-NOTICES.md`; licence notice comment at the top of the built HTML (from `src/index.template.html`); attribution banner in `test/reference/ref.cjs` (via `build:ref`); `package.json` licence ISC → MIT. The §7 "Awaiting the user" questions are no longer asked at session start (user's choice); they stay listed until answered.
20. (2026-11-19) Survey of the reference repos for missing functionality (§7 item 12 lists what is still open). Fixed: upstream's **web-page media keys** (`webpagehome/back/forward`, 0x223–0x225) now upload directly (they were refused; added to the upstream oracle actions; **confirmed working on the user's keyboard** the same day, following the test steps for the 514c:8850 12-key pad); upstream's **1-row/1-knob modifier rule** is now an error in the editor and at upload. Reading the mapping back was built on branch `feature/read-keyboard` but kept off `main` for now (user's choice).
21. (2026-11-23) **Changing the orientation keeps the mapping**: actions, comments and the selected key move with their physical key and knob instead of being lost or reassigned (§4.2).
22. (2026-11-23, branch `feature/load-save-config`) Tagline now "Visual editor for ch57x-keyboard-tool mapping files. By daifuku." **Load config** / **Save config** buttons before *New blank*, each with a confirmation; *Load repo example* removed, and the YAML drawer lost its download button and file chooser. Unknown-key warning reworded ("…is not a key name this editor recognises. Check the spelling, or pick the key from the keycode palette"). Chord messages made clearer (e.g. "At most 5 chords per key (6 given; chords are separated by commas)"), and Help's Actions section now defines *chord* and *sequence*. (*Step* was tried in place of *chord* and reverted the same day to match upstream.) Dialog text trimmed: no "comments included", no browser-download explanation on Save. *Clear* now also clears the comment, with a one-line confirmation (`Layer 1 · Button row 4, column 1: "ctrl-k,o"`). The "✓ Valid … action" line is gone; the editor only speaks up about problems. Help reordered: Actions, Comments on keys, Direct upload (WebHID).
23. (2026-11-23, same branch) Comment box placeholder: "Describe what the key does". The **"No WebHID?" drawer and its generated upload script are removed** (`makeUploadScript`, `#upOs #upTool #upSudo #btnUpScript #btnUpCopy`, `upload_script_test.cjs`, stub `fixtures/it's-tool`); Help gained a *Without WebHID: the command-line tool* section instead (as the user suggested).
24. (2026-11-23, same branch) Help split into tiles, one per topic; intro starts with the tagline. The unknown-key warning now ends "…Check the spelling, pick the key from the keycode palette, or see Help", where Help links to the Actions section.
25. (2026-11-23, same branch) "No problems found" removed from the status line. The labels-and-outlines legend became a link to a new first Help section, *Reading the keypad*. Both "daifuku" mentions link to https://github.com/daifukusensei/ch57x-keyboard-web-configurator. Less space above the Help intro.
---

## 10. Pitfalls already hit (so you don't repeat them)

- New assertions placed **after `process.exit(...)`** silently never run.
- `.gitattributes` has `* text=auto`, so fixtures are stored with **LF** even if written with CRLF; a test that needs the user's CRLF must convert the text itself (`notes_test.cjs`, `ui_notes_test.cjs` do).
- After a layout change the Connect/Info buttons went stale → `renderAll()` must end with `hidSync()`.
- Byte offsets in UI tests changed when the protocol started depending on layout (e.g. `slice(9,15)==='5,0,1,0,0,0'` for the 12-key click).
- Small keycaps broke long names mid-word (`wheeldown`) — knob caps are now 84×66 / round 80 px with an 11.5 px font (`volumedown` still fits on one line).
- A reversed flexbox (`row-reverse`) that overflows puts the overflow on the start side, which can't be scrolled to; use `order` instead.
- The grid column width in `renderDevice()` has a fallback `var(--cw,86px)` that must match the CSS default `.cell` width, or keys overlap.
- Playwright screenshots: the sticky upload bar overlaps lower content in short-viewport screenshots — a screenshot artefact, not a layout bug (use a taller viewport).
- A test that strips comments with `/\s+#.*$/` fails on CRLF input; use `split(/\r?\n/)`. The editor itself handles CRLF.
- Numpad keycodes exist twice in `#pane-basic` (board + the phone list `#kbNumpad`); uniqueness checks must exclude `#kbNumpad *`.
- Confirmations are async now: a jsdom test that clicks Clear / New blank / Load config / Save config / Upload must answer the dialog (`test/lib/autoconfirm.cjs`) and `await` a tick before asserting; stubbing `window.confirm` no longer does anything.
- `[data-mod="ctrl"]` matches two buttons (the hidden `#modChips` chip and the Basic-tab keyboard key); scope selectors with `#kbBoard` or `#modChips`, or Playwright waits forever on the hidden one.
- Don't commit or share anything that depends on `localStorage` surviving: every access is wrapped in try/catch and the page must render without it.
