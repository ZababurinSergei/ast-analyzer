// src/formal/core/SignatureComparator.ts
import {
  Node,
  SourceFile,
  FunctionDeclaration,
  ArrowFunction,
  MethodDeclaration,
  ClassDeclaration,
  VariableDeclaration,
} from 'ts-morph';

export interface FunctionSignature {
  name: string;
  params: string[];
  paramTypes: string[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  isMethod?: boolean;
  className?: string;
  isDefault?: boolean;
  typeParameters?: string[];
  isGenerator?: boolean;
  hasRestParam?: boolean;
  decorators?: string[];
}

export interface SignatureChange {
  name: string;
  original: FunctionSignature;
  modified: FunctionSignature;
  impact: 'high' | 'medium' | 'low';
  details: {
    paramChanges: string[];
    returnTypeChanged: boolean;
    asyncChanged: boolean;
    exportedChanged: boolean;
    typeParamChanges: string[];
    generatorChanged: boolean;
    restParamChanged: boolean;
  };
}

export interface SignatureComparisonResult {
  changes: SignatureChange[];
  missing: string[];
  added: string[];
  renamed: { from: string; to: string }[];
  unchanged: string[];
}

export class SignatureComparator {
  /**
   * Извлекает сигнатуру из узла с полной информацией
   */
  extractSignature(node: Node): FunctionSignature | null {
    try {
      // FunctionDeclaration
      if (Node.isFunctionDeclaration(node)) {
        const func = node as FunctionDeclaration;
        const name = func.getName() || 'anonymous';
        const params = func.getParameters();
        const returnType = func.getReturnType();

        return {
          name,
          params: params.map(p => p.getName()),
          paramTypes: params.map(p => {
            try {
              return p.getType().getText();
            } catch {
              return 'any';
            }
          }),
          returnType: returnType.getText(),
          isAsync: func.isAsync(),
          isExported: func.isExported(),
          isDefault: false,
          typeParameters: func.getTypeParameters().map(tp => tp.getText()),
          isGenerator: func.isGenerator(),
          hasRestParam: params.some(p => p.isRestParameter()),
          decorators: this.getDecoratorsSafe(func),
        };
      }

      // ArrowFunction
      if (Node.isArrowFunction(node)) {
        const arrow = node as ArrowFunction;
        let name = 'anonymous';
        let isExported = false;

        const parent = node.getParent();
        if (parent && Node.isVariableDeclaration(parent)) {
          name = parent.getName();
          const varParent = parent.getParent();
          if (varParent) {
            // Проверяем экспорт через VariableStatement
            try {
              if (typeof (varParent as any).isExported === 'function') {
                isExported = (varParent as any).isExported();
              }
            } catch {
              isExported = false;
            }
          }
        }

        const params = arrow.getParameters();
        const returnType = arrow.getReturnType();

        return {
          name,
          params: params.map(p => p.getName()),
          paramTypes: params.map(p => {
            try {
              return p.getType().getText();
            } catch {
              return 'any';
            }
          }),
          returnType: returnType.getText(),
          isAsync: arrow.isAsync(),
          isExported,
          isDefault: false,
          typeParameters: [],
          isGenerator: false,
          hasRestParam: params.some(p => p.isRestParameter()),
          decorators: [],
        };
      }

      // MethodDeclaration
      if (Node.isMethodDeclaration(node)) {
        const method = node as MethodDeclaration;
        const name = method.getName();
        const params = method.getParameters();
        const returnType = method.getReturnType();

        let className = '';
        let current: Node | undefined = node.getParent();
        while (current) {
          if (Node.isClassDeclaration(current)) {
            className = (current as ClassDeclaration).getName() || '';
            break;
          }
          current = current.getParent();
        }

        // Определяем экспорт через проверку родительского класса
        let isExported = false;
        if (className) {
          const classNode = node.getParentWhile((n: Node) => Node.isClassDeclaration(n));
          if (classNode && Node.isClassDeclaration(classNode)) {
            isExported = (classNode as ClassDeclaration).isExported();
          }
        }

        return {
          name: className ? `${className}.${name}` : name,
          params: params.map(p => p.getName()),
          paramTypes: params.map(p => {
            try {
              return p.getType().getText();
            } catch {
              return 'any';
            }
          }),
          returnType: returnType.getText(),
          isAsync: method.isAsync(),
          isExported,
          isMethod: true,
          className: className || undefined,
          isDefault: false,
          typeParameters: method.getTypeParameters().map(tp => tp.getText()),
          isGenerator: method.isGenerator(),
          hasRestParam: params.some(p => p.isRestParameter()),
          decorators: this.getDecoratorsSafe(method),
        };
      }

      // FunctionExpression в переменной
      if (Node.isVariableDeclaration(node)) {
        const varDecl = node as VariableDeclaration;
        const initializer = varDecl.getInitializer();
        if (initializer && Node.isFunctionExpression(initializer)) {
          const func = initializer;
          const name = varDecl.getName();
          const params = func.getParameters();
          const returnType = func.getReturnType();

          let isExported = false;
          const parent = varDecl.getParent();
          if (parent) {
            try {
              if (typeof (parent as any).isExported === 'function') {
                isExported = (parent as any).isExported();
              }
            } catch {
              isExported = false;
            }
          }

          return {
            name,
            params: params.map(p => p.getName()),
            paramTypes: params.map(p => {
              try {
                return p.getType().getText();
              } catch {
                return 'any';
              }
            }),
            returnType: returnType.getText(),
            isAsync: func.isAsync(),
            isExported,
            isDefault: false,
            typeParameters: [],
            isGenerator: func.isGenerator(),
            hasRestParam: params.some(p => p.isRestParameter()),
            decorators: [],
          };
        }
      }

      return null;
    } catch (error) {
      console.debug('Failed to extract signature:', error);
      return null;
    }
  }

  /**
   * Сравнивает две сигнатуры и возвращает изменения
   */
  compareSignatures(
    original: FunctionSignature,
    modified: FunctionSignature
  ): SignatureChange | null {
    const paramChanges: string[] = [];
    const typeParamChanges: string[] = [];
    const returnTypeChanged = original.returnType !== modified.returnType;
    const asyncChanged = original.isAsync !== modified.isAsync;
    const exportedChanged = original.isExported !== modified.isExported;
    const generatorChanged = original.isGenerator !== modified.isGenerator;
    const restParamChanged = original.hasRestParam !== modified.hasRestParam;

    // Сравнение параметров
    if (original.params.length !== modified.params.length) {
      paramChanges.push(`Количество: ${original.params.length} → ${modified.params.length}`);
    } else {
      for (let i = 0; i < original.params.length; i++) {
        if (original.params[i] !== modified.params[i]) {
          paramChanges.push(`Параметр ${i + 1}: ${original.params[i]} → ${modified.params[i]}`);
        }
        const origType = original.paramTypes[i] || 'any';
        const modType = modified.paramTypes[i] || 'any';
        if (origType !== modType) {
          paramChanges.push(`Тип ${i + 1}: ${origType} → ${modType}`);
        }
      }
    }

    // Сравнение типовых параметров (generics)
    const origTypeParams = original.typeParameters || [];
    const modTypeParams = modified.typeParameters || [];

    if (origTypeParams.length !== modTypeParams.length) {
      typeParamChanges.push(
        `Типовые параметры: ${origTypeParams.length} → ${modTypeParams.length}`
      );
    } else {
      for (let i = 0; i < origTypeParams.length; i++) {
        if (origTypeParams[i] !== modTypeParams[i]) {
          typeParamChanges.push(
            `Типовой параметр ${i + 1}: ${origTypeParams[i]} → ${modTypeParams[i]}`
          );
        }
      }
    }

    const hasChanges =
      paramChanges.length > 0 ||
      typeParamChanges.length > 0 ||
      returnTypeChanged ||
      asyncChanged ||
      exportedChanged ||
      generatorChanged ||
      restParamChanged;

    if (!hasChanges) return null;

    // Оценка влияния изменений
    let impact: 'high' | 'medium' | 'low' = 'low';
    if (returnTypeChanged || asyncChanged || restParamChanged) {
      impact = 'high';
    } else if (paramChanges.length > 0 || typeParamChanges.length > 0) {
      impact = 'medium';
    } else if (exportedChanged || generatorChanged) {
      impact = 'medium';
    }

    return {
      name: original.name,
      original,
      modified,
      impact,
      details: {
        paramChanges,
        returnTypeChanged,
        asyncChanged,
        exportedChanged,
        typeParamChanges,
        generatorChanged,
        restParamChanged,
      },
    };
  }

  /**
   * Извлекает все сигнатуры из файла
   */
  extractAllSignatures(sourceFile: SourceFile): Map<string, FunctionSignature> {
    const signatures = new Map<string, FunctionSignature>();

    // Функции
    for (const func of sourceFile.getFunctions()) {
      const sig = this.extractSignature(func);
      if (sig) {
        // Если есть дубликат, добавляем суффикс
        const baseName = sig.name;
        let name = baseName;
        let counter = 1;
        while (signatures.has(name)) {
          name = `${baseName}_${counter}`;
          counter++;
        }
        sig.name = name;
        signatures.set(name, sig);
      }
    }

    // Методы классов
    for (const cls of sourceFile.getClasses()) {
      for (const method of cls.getMethods()) {
        const sig = this.extractSignature(method);
        if (sig) {
          const name = sig.name;
          if (!signatures.has(name)) {
            signatures.set(name, sig);
          }
        }
      }
    }

    // Стрелочные функции в переменных
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const sig = this.extractSignature(varDecl);
        if (sig) {
          signatures.set(sig.name, sig);
        }
      }
    }

    // Function expressions в переменных
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isFunctionExpression(initializer)) {
        const sig = this.extractSignature(varDecl);
        if (sig) {
          signatures.set(sig.name, sig);
        }
      }
    }

    return signatures;
  }

  /**
   * Сравнивает все сигнатуры из двух наборов
   */
  compareAllSignatures(
    signatures1: Map<string, FunctionSignature>,
    signatures2: Map<string, FunctionSignature>
  ): SignatureComparisonResult {
    const changes: SignatureChange[] = [];
    const missing: string[] = [];
    const added: string[] = [];
    const renamed: { from: string; to: string }[] = [];
    const unchanged: string[] = [];

    const names1 = new Set(signatures1.keys());
    const names2 = new Set(signatures2.keys());

    // Проверяем на переименования (эвристика: одинаковые типы параметров и возврата)
    const nameMap = new Map<string, string>();
    for (const name1 of names1) {
      const sig1 = signatures1.get(name1);
      if (!sig1) continue;

      for (const name2 of names2) {
        const sig2 = signatures2.get(name2);
        if (!sig2) continue;

        // Проверяем на возможное переименование
        if (
          sig1.params.length === sig2.params.length &&
          sig1.returnType === sig2.returnType &&
          sig1.paramTypes.every((t, i) => t === sig2.paramTypes[i])
        ) {
          // Если имена отличаются, это переименование
          if (name1 !== name2 && !names1.has(name2) && !names2.has(name1)) {
            renamed.push({ from: name1, to: name2 });
            nameMap.set(name1, name2);
            nameMap.set(name2, name1);
          }
        }
      }
    }

    // Анализируем изменения
    for (const name of names1) {
      if (nameMap.has(name)) {
        const to = nameMap.get(name);
        if (to && names2.has(to)) {
          const sig1 = signatures1.get(name);
          const sig2 = signatures2.get(to);
          if (sig1 && sig2) {
            const change = this.compareSignatures(sig1, sig2);
            if (change) {
              changes.push(change);
            } else {
              unchanged.push(name);
            }
          }
        }
        continue;
      }

      if (!names2.has(name)) {
        missing.push(name);
        continue;
      }

      const sig1 = signatures1.get(name);
      const sig2 = signatures2.get(name);
      if (sig1 && sig2) {
        const change = this.compareSignatures(sig1, sig2);
        if (change) {
          changes.push(change);
        } else {
          unchanged.push(name);
        }
      }
    }

    for (const name of names2) {
      if (!names1.has(name) && !nameMap.has(name)) {
        added.push(name);
      }
    }

    return { changes, missing, added, renamed, unchanged };
  }

  /**
   * Находит функцию по сигнатуре
   */
  findFunctionBySignature(
    signatures: Map<string, FunctionSignature>,
    searchSig: Partial<FunctionSignature>
  ): string | null {
    for (const [name, sig] of signatures) {
      let matches = true;
      if (searchSig.params && sig.params.length !== searchSig.params.length) {
        matches = false;
      }
      if (searchSig.returnType && sig.returnType !== searchSig.returnType) {
        matches = false;
      }
      if (searchSig.isAsync !== undefined && sig.isAsync !== searchSig.isAsync) {
        matches = false;
      }
      if (matches) {
        return name;
      }
    }
    return null;
  }

  /**
   * Проверяет, совместимы ли две сигнатуры (для проверки обратной совместимости)
   */
  isCompatible(original: FunctionSignature, modified: FunctionSignature): boolean {
    // Проверяем количество параметров
    if (original.params.length !== modified.params.length) {
      return false;
    }

    // Проверяем типы параметров (должны быть совместимы)
    for (let i = 0; i < original.paramTypes.length; i++) {
      const origType = original.paramTypes[i] || 'any';
      const modType = modified.paramTypes[i] || 'any';
      if (origType !== modType && !this.areTypesCompatible(origType, modType)) {
        return false;
      }
    }

    // Проверяем возвращаемый тип
    if (original.returnType !== modified.returnType) {
      return false;
    }

    // Проверяем async
    if (original.isAsync !== modified.isAsync) {
      return false;
    }

    return true;
  }

  /**
   * Проверяет совместимость типов (упрощенная версия)
   */
  private areTypesCompatible(type1: string, type2: string): boolean {
    if (type1 === type2) return true;
    if (type1 === 'any' || type2 === 'any') return true;
    if (type1 === 'unknown' || type2 === 'unknown') return true;
    if (type1 === 'string' && type2 === 'any') return true;
    if (type1 === 'number' && type2 === 'any') return true;
    if (type1 === 'boolean' && type2 === 'any') return true;
    return false;
  }

  /**
   * Генерирует отчет о изменениях сигнатур в Markdown формате
   */
  generateReport(comparison: SignatureComparisonResult): string {
    let report = '# 📝 Signature Changes Report\n\n';

    // Общая статистика
    report += '## 📊 Statistics\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Changes | ${comparison.changes.length} |\n`;
    report += `| Missing | ${comparison.missing.length} |\n`;
    report += `| Added | ${comparison.added.length} |\n`;
    report += `| Renamed | ${comparison.renamed.length} |\n`;
    report += `| Unchanged | ${comparison.unchanged.length} |\n\n`;

    // Высокий приоритет
    const highImpact = comparison.changes.filter(c => c.impact === 'high');
    const mediumImpact = comparison.changes.filter(c => c.impact === 'medium');
    const lowImpact = comparison.changes.filter(c => c.impact === 'low');

    if (highImpact.length > 0) {
      report += '## 🔴 High Impact Changes\n\n';
      for (const change of highImpact) {
        report += this.formatChange(change);
      }
      report += '\n';
    }

    if (mediumImpact.length > 0) {
      report += '## 🟡 Medium Impact Changes\n\n';
      for (const change of mediumImpact) {
        report += this.formatChange(change);
      }
      report += '\n';
    }

    if (lowImpact.length > 0) {
      report += '## 🟢 Low Impact Changes\n\n';
      for (const change of lowImpact) {
        report += this.formatChange(change);
      }
      report += '\n';
    }

    if (comparison.missing.length > 0) {
      report += '## ❌ Missing Functions\n\n';
      for (const name of comparison.missing) {
        report += `- \`${name}\`\n`;
      }
      report += '\n';
    }

    if (comparison.added.length > 0) {
      report += '## ➕ Added Functions\n\n';
      for (const name of comparison.added) {
        report += `- \`${name}\`\n`;
      }
      report += '\n';
    }

    if (comparison.renamed.length > 0) {
      report += '## 🔄 Renamed Functions\n\n';
      for (const rename of comparison.renamed) {
        report += `- \`${rename.from}\` → \`${rename.to}\`\n`;
      }
      report += '\n';
    }

    if (comparison.unchanged.length > 0 && comparison.unchanged.length <= 20) {
      report += '## ✅ Unchanged Functions\n\n';
      for (const name of comparison.unchanged) {
        report += `- \`${name}\`\n`;
      }
      report += '\n';
    } else if (comparison.unchanged.length > 20) {
      report += `## ✅ ${comparison.unchanged.length} Unchanged Functions (not shown)\n\n`;
    }

    return report;
  }

  /**
   * Форматирует одно изменение для отчета
   */
  private formatChange(change: SignatureChange): string {
    let result = `### \`${change.name}\`\n\n`;
    result += `**Impact:** ${change.impact.toUpperCase()}\n\n`;

    if (change.details.paramChanges.length > 0) {
      result += '**Parameter changes:**\n';
      for (const param of change.details.paramChanges) {
        result += `- ${param}\n`;
      }
      result += '\n';
    }

    if (change.details.typeParamChanges.length > 0) {
      result += '**Type parameter changes:**\n';
      for (const tp of change.details.typeParamChanges) {
        result += `- ${tp}\n`;
      }
      result += '\n';
    }

    if (change.details.returnTypeChanged) {
      result += `**Return type:** ${change.original.returnType} → ${change.modified.returnType}\n\n`;
    }

    if (change.details.asyncChanged) {
      result += `**Async:** ${change.original.isAsync} → ${change.modified.isAsync}\n\n`;
    }

    if (change.details.exportedChanged) {
      result += `**Exported:** ${change.original.isExported} → ${change.modified.isExported}\n\n`;
    }

    if (change.details.generatorChanged) {
      result += `**Generator:** ${change.original.isGenerator} → ${change.modified.isGenerator}\n\n`;
    }

    if (change.details.restParamChanged) {
      result += `**Rest param:** ${change.original.hasRestParam} → ${change.modified.hasRestParam}\n\n`;
    }

    // Краткая сводка
    result += '**Before:**\n';
    result += `\`${this.signatureToString(change.original)}\`\n\n`;
    result += '**After:**\n';
    result += `\`${this.signatureToString(change.modified)}\`\n\n`;

    return result;
  }

  /**
   * Преобразует сигнатуру в строку
   */
  signatureToString(sig: FunctionSignature): string {
    const params = sig.params
      .map((p, i) => {
        const type = sig.paramTypes[i] || 'any';
        return `${p}: ${type}`;
      })
      .join(', ');

    const typeParams = sig.typeParameters?.length ? `<${sig.typeParameters.join(', ')}>` : '';

    const asyncStr = sig.isAsync ? 'async ' : '';
    const genStr = sig.isGenerator ? '*' : '';
    const exportedStr = sig.isExported ? 'export ' : '';
    const methodStr = sig.isMethod ? `${sig.className || ''}.` : '';

    return `${exportedStr}${asyncStr}function${genStr} ${methodStr}${sig.name}${typeParams}(${params}): ${sig.returnType}`;
  }

  /**
   * Экспортирует сигнатуры в JSON
   */
  exportToJSON(signatures: Map<string, FunctionSignature>): string {
    const data: Record<string, FunctionSignature> = {};
    for (const [name, sig] of signatures) {
      data[name] = sig;
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Импортирует сигнатуры из JSON
   */
  importFromJSON(json: string): Map<string, FunctionSignature> {
    const data = JSON.parse(json) as Record<string, FunctionSignature>;
    const signatures = new Map<string, FunctionSignature>();
    for (const [name, sig] of Object.entries(data)) {
      signatures.set(name, sig);
    }
    return signatures;
  }

  /**
   * Получает декораторы безопасно (использует any для совместимости)
   */
  private getDecoratorsSafe(node: any): string[] {
    try {
      if (node && typeof node.getDecorators === 'function') {
        const decorators = node.getDecorators();
        if (Array.isArray(decorators)) {
          return decorators.map((d: any) => {
            try {
              return typeof d.getText === 'function' ? d.getText() : '@unknown';
            } catch {
              return '@unknown';
            }
          });
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Проверяет наличие декоратора
   */
  hasDecorator(node: Node, decoratorName: string): boolean {
    try {
      if (typeof (node as any).getDecorators === 'function') {
        const decorators = (node as any).getDecorators();
        if (Array.isArray(decorators)) {
          return decorators.some((d: any) => {
            try {
              const text = typeof d.getText === 'function' ? d.getText() : '';
              return text.includes(decoratorName);
            } catch {
              return false;
            }
          });
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Проверяет, экспортируется ли метод (через класс)
   */
  isMethodExported(method: MethodDeclaration): boolean {
    try {
      const classNode = method.getParentWhile((n: Node) => Node.isClassDeclaration(n));
      if (classNode && Node.isClassDeclaration(classNode)) {
        return (classNode as ClassDeclaration).isExported();
      }
      return false;
    } catch {
      return false;
    }
  }
}

// ============================================
// ЭКСПОРТ УТИЛИТ
// ============================================

export function isSignatureCompatible(sig1: FunctionSignature, sig2: FunctionSignature): boolean {
  const comparator = new SignatureComparator();
  return comparator.isCompatible(sig1, sig2);
}

export function compareSignatures(
  sig1: FunctionSignature,
  sig2: FunctionSignature
): SignatureChange | null {
  const comparator = new SignatureComparator();
  return comparator.compareSignatures(sig1, sig2);
}

export function findFunctionByName(
  signatures: Map<string, FunctionSignature>,
  name: string
): FunctionSignature | null {
  return signatures.get(name) || null;
}

export function findFunctionBySignature(
  signatures: Map<string, FunctionSignature>,
  searchSig: Partial<FunctionSignature>
): string | null {
  const comparator = new SignatureComparator();
  return comparator.findFunctionBySignature(signatures, searchSig);
}
