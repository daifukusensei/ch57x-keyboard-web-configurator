# Third-party notices

This project ports protocol logic from, and includes files copied from or
derived from, the projects below. Each is used under the MIT License; the
required copyright and permission notices follow.

| Project | Used in this repo |
|---|---|
| [kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool) (MIT OR Apache-2.0; used under MIT) | YAML syntax and packet formats implemented in `src/core.js` (and so in `ch57x-keyboard-web-configurator.html`); `test/fixtures/upstream-example.yaml` (its `example-mapping.yaml`); `patches/upstream-oracle-harness.patch` |
| [daifukusensei/ch57x-keyboard-tool-enhanced](https://github.com/daifukusensei/ch57x-keyboard-tool-enhanced) (fork of the above, same licence and copyright) | 514c:8850 12-key protocol ported into `src/core.js`; `patches/fork-oracle-harness.patch` |
| [PollRobots/ch57x-programmer](https://github.com/PollRobots/ch57x-programmer) (MIT) | Packet formats ported into `src/core.js`; its source bundled into `test/reference/ref.cjs` |

The repositories cloned into `refs/` by `scripts/fetch-refs.sh` are not
redistributed (`refs/` is git-ignored) and keep their own licences.

---

## ch57x-keyboard-tool and ch57x-keyboard-tool-enhanced

```
MIT License

Copyright 2023 Mikhail Trishchenkov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ch57x-programmer

```
MIT License

Copyright (c) 2026 Paul Roberts
Copyright (c) 2023 Mikhail Trishchenkov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
