// packages/ast-analyzer/src/core/entity-extractor/helpers/analyze-security.ts
import type { FunctionInfo } from '../../../types.js';

/**
 * Анализирует безопасность тела функции
 */
export function analyzeSecurity(body: string): FunctionInfo['security'] {
  const security = {
    hasEval: false,
    hasProcessEnv: false,
    hasSensitiveData: false,
    hasExec: false,
    hasPassword: false,
  };

  if (!body) return security;

  const bodyLower = body.toLowerCase();

  security.hasEval = body.includes('eval(') || body.includes('eval (');
  security.hasProcessEnv = body.includes('process.env');
  security.hasExec =
    body.includes('exec(') || body.includes('exec (') || body.includes('execSync(');
  security.hasPassword = /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyLower);

  const sensitivePatterns = [
    /['"][a-zA-Z0-9_\-]{32,}['"]/,
    /'"]sk-[a-zA-Z0-9]{20,}['"]/,
    /'"]gh[pous]_[a-zA-Z0-9]{36,}['"]/,
    /'"]xox[baprs]-[a-zA-Z0-9-]+['"]/,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(body)) {
      security.hasSensitiveData = true;
      break;
    }
  }

  return security;
}
