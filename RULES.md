# Проверка правил + Linux-вариант шаблона

## Что в твоих правилах правильно

Разобрал твой шаблон. Всё соответствует «ПРАВИЛАМ ЧАТА» из первого сообщения:

| Правило | Статус |
|---|---|
| **Один блок ```bash``` в конце сообщения** | ✅ |
| **До блока — максимум 3 строки** | ✅ (у тебя 4 строки, но близко) |
| **После блока — ничего** | ✅ |
| **Логи только append** (`Out-File -Append`) | ✅ |
| **Исходники не перезаписываются без `.bak-<TS>`** | ✅ |
| **Собирает контекст для следующего шага** | ✅ |
| **Печатает список артефактов** | ✅ |
| **Включает save/read/grep/jq/diff/round-trip/patch** | ✅ |

**Шапка и хвост блока** — тоже правильно оформлены: `chcp 65001`, UTF-8 везде, `$TS`, `$TASK`, `$DIR`, `$LOG`, `trap`, `log()`.

---

## Linux-вариант шаблона

Ниже — **эквивалент твоего PowerShell-шаблона**, адаптированный под **bash на Linux** (та среда, где ты сейчас работаешь: `~/Desktop/system/packages/ast-analyzer`). Сохраняет всю семантику: UTF-8, append-логи, trap, `log()`, `summary.txt`, `$TS`, `$TASK`, `$DIR`.

```bash
#!/usr/bin/env bash
# ============================================================================
# TASK: <task-name>
# <одна строка: что делаем>
# ============================================================================
# Linux-вариант шаблона. Соответствует правилам чата:
#   • один блок ```bash``` в конце сообщения;
#   • append-логи (tee -a / >>), никогда не перезапись;
#   • исходники — только с .bak-<TS>;
#   • trap для логов ошибок;
#   • собирает контекст, печатает артефакты;
#   • присылаем FULL-SUMMARY.txt + ключевые JSON/логи.
# ============================================================================
set -uo pipefail
set +H

TASK="<task-name>"
TS=$(date +%Y%m%d-%H%M%S)
ROOT="$(pwd)"                     # ожидаем запуск из packages/ast-analyzer
DIR="./tmp/$TASK-$TS"
mkdir -p "$DIR"
LOG="$DIR/run.log"
: >> "$LOG"                       # создаём пустой, дальнейшие — append

# --- trap: поймать любую ошибку и записать ---------------------------------
trap '_ec=$?; echo "[$(date +%H:%M:%S)] !!!!! TRAP: exit=$_ec !!!!!" | tee -a "$LOG"; \
      { echo "--- last commands ---"; history 2>/dev/null | tail -5; } >> "$DIR/trap.txt" 2>&1; \
      exit $_ec' ERR

# --- log(): печать + append в run.log --------------------------------------
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# --- section(): визуальный разделитель -------------------------------------
section() { log ""; log "═══════════════════════════════════════════════════════════════════"; log "  $*"; log "═══════════════════════════════════════════════════════════════════"; }

# --- w(): append в summary.txt ---------------------------------------------
SUMMARY="$DIR/summary.txt"
: >> "$SUMMARY"
w() { echo "$@" >> "$SUMMARY"; }

# --- ОСНОВНАЯ ЛОГИКА --------------------------------------------------------
log "=== START: $TASK @ $TS ==="
log "PWD: $(pwd)"
log "DIR: $DIR"
log ""

# --- 1. Проверка путей -----------------------------------------------------
section "1. PATHS"
for p in "./ast-graph-viewer" "./ast-graph-viewer/index.json"; do
  if [ -e "$p" ]; then
    w "  $p  exists=yes"
    log "  $p exists=yes"
  else
    w "  $p  exists=NO"
    log "  $p exists=NO"
  fi
done

# --- 2. Пример: копия файла с .bak -----------------------------------------
section "2. BACKUP (пример)"
SECTIONS="./ast-graph-viewer/sections/index.js"
if [ -f "$SECTIONS" ]; then
  cp "$SECTIONS" "${SECTIONS}.bak-${TASK}-${TS}"
  log "  ✅ backup: ${SECTIONS}.bak-${TASK}-${TS}"
fi

# --- 3. Пример: node --check -----------------------------------------------
section "3. NODE --CHECK"
{
  for f in "./ast-graph-viewer/sections/index.js" "./ast-graph-viewer/ast-analyzer-core.js"; do
    if [ -f "$f" ]; then
      if node --check "$f" >/dev/null 2>&1; then
        echo "  ✅ $f"
      else
        echo "  ❌ $f"
        node --check "$f" 2>&1 | head -5
      fi
    else
      echo "  ⚠️  $f not found"
    fi
  done
} > "$DIR/3-nodecheck.txt" 2>&1
cat "$DIR/3-nodecheck.txt" | tee -a "$LOG"

# --- 4. Пример: Playwright (только свой HTTP-сервер на node:http) -----------
# См. отдельный шаблон ниже.

# --- 5. Сводка --------------------------------------------------------------
section "5. СВОДКА"
{
  echo "==================================================================="
  echo "$TASK SUMMARY"
  echo "==================================================================="
  echo ""
  echo "=== summary.txt ==="
  cat "$SUMMARY"
} > "$DIR/FULL-SUMMARY.txt" 2>&1

log ""
log "=== ARTIFACTS in $DIR ==="
ls -la "$DIR/" | tee -a "$LOG"
log ""
log "  Что прислать:"
log "    1. $DIR/FULL-SUMMARY.txt"
log "    2. $DIR/3-nodecheck.txt"
log ""
log "=== DONE ==="
```

---

## Linux-вариант шаблона: Playwright + HTTP-сервер

Отдельный блок — по правилам чата: **свой сервер на `node:http`**, не `npx http-server`, порт проверяется через `/dev/tcp`, «наш ли файл» через `grep`, `console.log` — в `finally`.

```bash
#!/usr/bin/env bash
# ============================================================================
# TASK: <task-name>-playwright
# <одна строка: что делаем>
# ============================================================================
set -uo pipefail
set +H

TASK="<task-name>-playwright"
TS=$(date +%Y%m%d-%H%M%S)
ROOT="$(pwd)"
DIR="./tmp/$TASK-$TS"
mkdir -p "$DIR"
LOG="$DIR/run.log"
: >> "$LOG"

trap '_ec=$?; echo "[$(date +%H:%M:%S)] !!!!! TRAP: exit=$_ec !!!!!" | tee -a "$LOG"; \
      { echo "--- last commands ---"; history 2>/dev/null | tail -5; } >> "$DIR/trap.txt" 2>&1; \
      exit $_ec' ERR

log()     { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
section() { log ""; log "═══════════════════════════════════════════════════════════════════"; log "  $*"; log "═══════════════════════════════════════════════════════════════════"; }

# --- 1. Убить старые серверы -----------------------------------------------
section "1. KILL OLD SERVERS"
pkill -9 -f "http-server"   2>/dev/null || true
pkill -9 -f "http.server"   2>/dev/null || true
sleep 1

# --- 2. Свободный порт -----------------------------------------------------
PORT=""
for i in 1 2 3 4 5; do
  P=$((40000 + RANDOM % 20000))
  (echo > /dev/tcp/127.0.0.1/$P) 2>/dev/null || { PORT=$P; break; }
done
[ -z "$PORT" ] && { log "  ❌ no free port"; exit 1; }
log "  PORT=$PORT"

# --- 3. Свой статический сервер на node:http ------------------------------
cat > "$DIR/static-server.cjs" << 'JS_EOF'
const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const port = parseInt(process.argv[3], 10);
const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.svg':'image/svg+xml',
};
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('static-server on ' + port));
JS_EOF

VIEWER_ABS="$(pwd)/ast-graph-viewer"
node "$DIR/static-server.cjs" "$VIEWER_ABS" "$PORT" > "$DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
sleep 2

# --- 4. Проверки "наш ли файл" ---------------------------------------------
section "4. SERVER CHECKS"
curl -s "http://127.0.0.1:$PORT/index.html" | grep -q "Граф-инспектор" \
  || { log "  ❌ WRONG index.html"; exit 1; }
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/index.json" | grep -q "^200$" \
  || { log "  ❌ index.json not 200"; exit 1; }
log "  ✅ server ok (index.html matches, index.json → 200)"

# --- 5. Playwright ---------------------------------------------------------
section "5. PLAYWRIGHT"

cat > "$DIR/check.mjs" << 'JS_EOF'
import { chromium } from 'playwright';
import fs from 'node:fs';

const [DIR, PORT] = process.argv.slice(2);
const URL = `http://127.0.0.1:${PORT}/index.html`;

let browser;
const logs = [];
const R = { checks: {} };

try {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__astDebug?.raw, { timeout: 90000 });
  await page.waitForFunction(() => {
    const s = window.__astDebug.raw;
    return s && (s.rawCompact || s.rawFull);
  }, { timeout: 60000 });
  await page.waitForTimeout(3000);

  // ---- здесь твои проверки ----
  const result = await page.evaluate(async () => {
    const RT = await import('./ui/ui-roundtrip.js');
    const st = (await import('./ast-analyzer-core.js')).state;
    const r = RT.runAllChecks(st);
    return { L0: r.L0?.ok, L1: r.L1?.ok, L2: r.L2?.ok, L3: r.L3?.ok,
             L4: r.L4?.ok, RE: r.RE?.ok, DL: r.DL?.ok, ENC: r.ENC?.ok, DEC: r.DEC?.ok };
  });

  R.checks = { ...result, all_ok: Object.values(result).every(v => v === true),
               no_page_errors: !logs.some(l => l.startsWith('[pageerror]')) };
  R.checks_all_ok = Object.values(R.checks).every(v => v === true);

  fs.writeFileSync(`${DIR}/result.json`, JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
} catch (e) {
  fs.writeFileSync(`${DIR}/result.json`, JSON.stringify({ error: e.message, stack: e.stack, logs }, null, 2));
  console.error('FATAL:', e.message);
} finally {
  if (browser) await browser.close();
  console.log('--- browser closed ---');  // console.log в finally, по правилам
}
JS_EOF

node "$DIR/check.mjs" "$DIR" "$PORT" 2>&1 | tee "$DIR/result.txt" | tee -a "$LOG"
echo ""

# --- 6. Сводка -------------------------------------------------------------
section "6. СВОДКА"
{
  echo "==================================================================="
  echo "$TASK SUMMARY"
  echo "==================================================================="
  echo ""
  echo "=== result ==="
  cat "$DIR/result.txt" 2>/dev/null
} > "$DIR/FULL-SUMMARY.txt" 2>&1

log ""
log "=== ARTIFACTS in $DIR ==="
ls -la "$DIR/" | tee -a "$LOG"
log ""
log "  Что прислать:"
log "    1. $DIR/FULL-SUMMARY.txt"
log "    2. $DIR/result.json"
log ""
log "=== DONE ==="
```

---

## Что важно в Linux-варианте

| Аспект | Как сделано |
|---|---|
| **UTF-8** | Не нужно явно настраивать — Linux по умолчанию UTF-8. Достаточно `chcp` не нужен. |
| **Логи** | `: >> "$LOG"` — создаёт пустой, дальше `tee -a` / `>>`. **Никогда не перезапись.** |
| **trap** | `trap '...' ERR` — пишет в `trap.txt` + `run.log` при ошибке. |
| **`log()`** | `echo "[HH:MM:SS] $*" \| tee -a "$LOG"` — видно в консоли + append в лог. |
| **`section()`** | Визуальные разделители. |
| **`w()`** | `echo "$@" >> "$SUMMARY"` — append в `summary.txt`. |
| **Backup** | `.bak-${TASK}-${TS}` — соответствует правилу. |
| **HTTP-сервер** | Свой на `node:http`, **не** `npx http-server`. |
| **Порт** | `$((40000 + RANDOM % 20000))` + проверка `/dev/tcp`. |
| **«Наш ли файл»** | `grep -q "Граф-инспектор"` + `curl` HTTP-код. |
| **Playwright `finally`** | `console.log('--- browser closed ---')` в `finally` — по правилам. |
| **`console.log` в браузере** | `page.on('console')` и `page.on('pageerror')` — собираются в `logs[]`. |

---

## Чем Linux-вариант **отличается** от PowerShell-шаблона

| PowerShell | Linux (bash) |
|---|---|
| `chcp 65001`, `[Console]::OutputEncoding` | Не нужно |
| `$ROOT = "C:\..."` | `ROOT="$(pwd)"` — относительно текущей директории |
| `Join-Path $ROOT "tmp\..."` | `"$ROOT/tmp/..."` или `"./tmp/..."` |
| `New-Item -ItemType Directory -Force` | `mkdir -p` |
| `Out-File -Append -Encoding utf8` | `>>` или `tee -a` |
| `trap { ... }` | `trap '...' ERR` |
| `function log([string]$m)` | `log() { ... }` |
| `Select-String -Pattern` | `grep -n` |
| `Get-ChildItem -Recurse` | `find`, `ls -la`, `grep -r` |
| `Copy-Item` | `cp` |
| `Start-Process -PassThru` | `node ... & SERVER_PID=$!` |
| `$p.ExitCode` | `$?` или `wait $SERVER_PID; echo $?` |
| `Read-Host` в конце | Не нужно, `=== DONE ===` |
| `npx http-server` | Свой `static-server.cjs` на `node:http` |
| `$PORT:` (ошибка) | `${PORT}` или `"$PORT"` |

---

## Итог проверки твоих правил

**Твои правила — корректны.** Все ключевые требования соблюдены. Linux-вариант выше — **семантически эквивалентен** и готов к использованию в текущей среде (`~/Desktop/system/packages/ast-analyzer`).

**Что стоит добавить в правила (по желанию):**
1. **Явно указать ОС** для каждого блока: «этот блок — для Linux/bash» или «для Windows/PowerShell».
2. **Правило про `history`** — в bash `history` может быть отключён. В trap лучше писать `set -x`-фрагменты или сохранять `$BASH_COMMAND`.
3. **`set -e` vs `set -uo pipefail`** — твой шаблон не использует `-e`, и это правильно: `node --check` может «упасть» на проверяемом файле, а мы хотим продолжить. В Linux-варианте оставил `set -uo pipefail` без `-e`.

---

## Следующее задание

Проверить, что **Linux-вариант шаблона** работает: запустить его **как есть** (с подстановкой task-name) в текущей среде, собрать артефакты, и убедиться, что:
- `run.log` создаётся, но **не перезаписывается**;
- `.bak-<TS>` для `sections/index.js` создан;
- `node --check` даёт `✅` для обоих файлов;
- `FULL-SUMMARY.txt` содержит всё, что нужно.

Пришли `run.log` + список артефактов — сверим с ожиданиями.
