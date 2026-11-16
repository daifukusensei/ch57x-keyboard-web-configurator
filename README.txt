CH57x Macropad Config Editor - handoff bundle
  ch57x-config-editor.html   the deliverable (single file)
  HANDOFF.md                 architecture, decisions, tests, remaining tasks (start here)
  scratchpad/                test suites (tools/), oracle outputs, fixtures, screenshots, repo clones (without .git/target)
  patches/                   the scratch-only Rust oracle harness edits, as git patches
                             (apply to kriomant/ch57x-keyboard-tool @ bdbffca and
                              daifukusensei/ch57x-keyboard-tool-enhanced @ fa28f19)
To run the JS tests: cd scratchpad/tools && npm install
All test scripts default to the repo-root ch57x-config-editor.html, from any cwd (pass another html path as argv[2]).
