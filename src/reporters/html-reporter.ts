// reporters/html-reporter.ts
import path from 'path';

/**
 * Экранирует HTML специальные символы
 * @param str Входная строка
 * @returns Экранированная строка
 */
export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Генерирует HTML отчет с графом зависимостей
 * @param svgContent SVG содержимое графа
 * @param dotContent DOT содержимое для Graphviz
 * @param jsonContent JSON содержимое структуры графа
 * @param title Заголовок отчета (обычно путь к целевому файлу)
 * @param hasCycles Флаг наличия циклических зависимостей
 * @returns Полный HTML документ
 */
export function generateHTMLReport(
  svgContent: string,
  dotContent: string,
  jsonContent: string,
  title: string,
  hasCycles: boolean
): string {
  const banner = hasCycles
    ? '<div class="banner error">⚠️ Обнаружены циклические зависимости!</div>'
    : '<div class="banner success">✅ Циклических зависимостей нет</div>';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Граф зависимостей - ${path.basename(title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        h1 { color: #1e293b; font-size: 24px; margin-bottom: 10px; }
        .banner { padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; }
        .banner.error { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; }
        .banner.success { background: #f0fdf4; color: #166534; border-left: 4px solid #22c55e; }
        .graph-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
        svg { width: 100%; height: auto; min-height: 500px; }
        .code-section { margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap; }
        .code-card { flex: 1; background: #1e1e24; border-radius: 12px; padding: 15px; overflow: auto; max-height: 300px; }
        .code-card h3 { color: #f43f5e; margin-bottom: 10px; font-size: 14px; }
        .code-card pre { color: #a5d6a7; font-family: monospace; font-size: 11px; margin: 0; white-space: pre-wrap; }
        .hint { font-size: 12px; color: #64748b; text-align: center; margin-top: 15px; }
    </style>
</head>
<body>
    <h1>📊 Анализ зависимостей: ${path.basename(title)}</h1>
    ${banner}
    <div class="graph-container">
        <div id="graph-wrapper">${svgContent}</div>
        <div class="hint">💡 Колесо мыши — масштаб, зажать левую кнопку — перемещение</div>
    </div>
    <div class="code-section">
        <div class="code-card"><h3>📝 DOT (Graphviz)</h3><pre>${escapeHtml(dotContent)}</pre></div>
        <div class="code-card"><h3>📋 JSON (структура)</h3><pre>${escapeHtml(jsonContent)}</pre></div>
    </div>
    <script>
        window.onload = function() {
            const svg = document.querySelector('#graph-wrapper svg');
            if (svg) svgPanZoom(svg, { zoomEnabled: true, controlIconsEnabled: true, fit: true, center: true });
        };
    </script>
</body>
</html>`;
}
