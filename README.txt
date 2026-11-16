CH57x Macropad Config Editor - handoff bundle
  ch57x-config-editor.html   the deliverable (single file)
  HANDOFF.md                 architecture, decisions, tests, remaining tasks (start here)
  scratchpad/                test suites (tools/), oracle outputs, fixtures, screenshots, repo clones (without .git/target)
  patches/                   the scratch-only Rust oracle harness edits, as git patches
                             (apply to kriomant/ch57x-keyboard-tool @ bdbffca and
                              daifukusensei/ch57x-keyboard-tool-enhanced @ fa28f19)
To run the JS tests: cd scratchpad/tools && npm install
Most test scripts hard-code /home/claude/ch57x-config-editor.html and tools/ref_entry.ts hard-codes the old scratchpad path;
point them at your copy (see HANDOFF.md section 7). Do NOT run scratchpad/qmk/assemble.py (stale).
