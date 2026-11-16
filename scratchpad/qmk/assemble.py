import re, sys
D = '/tmp/claude-0/-home-claude/038a93d8-c1b4-51f4-8b47-ffcf9aa7b814/scratchpad/qmk/'
old = open(D + 'before-qmk-style.html').read()

def block(id_):
    m = re.search(r'<script id="%s">.*?</script>' % id_, old, re.S)
    assert m, id_
    return m.group(0)

core, ui, theme_ui = block('core'), block('ui'), block('theme-ui')

def replace_between(s, start, end, new):
    i = s.index(start); j = s.index(end, i)
    assert s.count(start) == 1, start
    return s[:i] + new + s[j:]

def replace_once(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)

# 1. layer column, keycaps, device drawing
ui = replace_between(ui, 'function renderTabs(){', 'function renderEditor(focus){', open(D + 'render.js').read())
# 2. selecting a key no longer moves focus into the text box: the palette is the main way to assign
ui = replace_once(ui, 'function select(t){ sel=t; renderDevice(); renderEditor(true); }',
                      'function select(t){ sel=t; renderDevice(); renderEditor(false); }')
# 3. palette instead of the two builder boxes
ui = replace_between(ui, '// ----- builder -----', '// ----- events -----', open(D + 'builder.js').read())
ui = replace_once(ui, """$('kbSet').addEventListener('click',()=>applyAction(composeKey(),false));
$('kbAdd').addEventListener('click',()=>applyAction(composeKey(),true));
$('msSet').addEventListener('click',()=>applyAction(composeMouse(),false));
$('msAdd').addEventListener('click',()=>applyAction(composeMouse(),true));
""", "wirePalette();\n")

page = open(D + 'head_body.html').read() + core + '\n' + ui + '\n' + theme_ui + '\n</body>\n</html>\n'
out = sys.argv[1]
open(out, 'w').write(page)

# the core logic (validation, protocols, planner) must be untouched
assert core in page and old.count(core) == 1
print('assembled', out, len(page) // 1024, 'KB; core script identical to the previous version')
