// src/semantic/JSXAnalyzer.ts
import type { SourceFile, Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { TypeInfo, TypeError } from './TypeAnalyzer.js';
import { TypeAnalyzer } from './TypeAnalyzer.js';

export interface JSXElementInfo {
  name: string;
  props: Map<string, TypeInfo>;
  children: JSXElementInfo[];
  line: number;
  column: number;
}

export interface JSXAnalysisResult {
  elements: JSXElementInfo[];
  componentProps: Map<string, Map<string, TypeInfo>>;
  propTypeErrors: TypeError[];
  missingImports: string[];
  jsxLintingIssues: JSXLintingIssue[];
}

export interface JSXLintingIssue {
  ruleId: string;
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  fix?: () => string;
}

export class JSXAnalyzer {
  private typeAnalyzer: TypeAnalyzer;

  constructor(_filePath: string) {
    this.typeAnalyzer = new TypeAnalyzer(_filePath);
  }

  analyze(sourceFile: SourceFile): JSXAnalysisResult {
    const elements: JSXElementInfo[] = [];
    const componentProps = new Map<string, Map<string, TypeInfo>>();
    const propTypeErrors: TypeError[] = [];
    const missingImports: string[] = [];
    const jsxLintingIssues: JSXLintingIssue[] = [];

    const visit = (node: Node) => {
      // JSX элементы
      if (node.getKind() === SyntaxKind.JsxElement) {
        const jsxElement = node.asKind(SyntaxKind.JsxElement);
        if (jsxElement) {
          const elementInfo = this.parseJSXElement(jsxElement);
          if (elementInfo) {
            elements.push(elementInfo);

            // Проверяем типы props
            const propsErrors = this.validateJSXProps(elementInfo, sourceFile);
            propTypeErrors.push(...propsErrors);

            // Линтинг JSX
            const lintingIssues = this.lintJSXElement(jsxElement);
            jsxLintingIssues.push(...lintingIssues);
          }
        }
      }

      // JSX самозакрывающиеся элементы
      if (node.getKind() === SyntaxKind.JsxSelfClosingElement) {
        const jsxSelfClosing = node.asKind(SyntaxKind.JsxSelfClosingElement);
        if (jsxSelfClosing) {
          const elementInfo = this.parseJSXSelfClosingElement(jsxSelfClosing);
          if (elementInfo) {
            elements.push(elementInfo);

            const propsErrors = this.validateJSXProps(elementInfo, sourceFile);
            propTypeErrors.push(...propsErrors);

            const lintingIssues = this.lintJSXSelfClosingElement(jsxSelfClosing);
            jsxLintingIssues.push(...lintingIssues);
          }
        }
      }

      // JSX фрагменты
      if (node.getKind() === SyntaxKind.JsxFragment) {
        const jsxFragment = node.asKind(SyntaxKind.JsxFragment);
        if (jsxFragment) {
          const fragmentInfo = this.parseJSXFragment(jsxFragment);
          if (fragmentInfo) {
            elements.push(...fragmentInfo);
          }
        }
      }

      node.forEachChild(visit);
    };

    sourceFile.forEachChild(visit);

    // Собираем информацию о компонентах и их пропсах
    for (const element of elements) {
      if (!componentProps.has(element.name)) {
        componentProps.set(element.name, new Map());
      }
      const props = componentProps.get(element.name)!;
      for (const [propName, propType] of element.props) {
        props.set(propName, propType);
      }
    }

    // Проверяем импорты React (для JSX)
    if (elements.length > 0) {
      const hasReactImport = this.checkReactImport(sourceFile);
      if (!hasReactImport) {
        missingImports.push('React');
        jsxLintingIssues.push({
          ruleId: 'react/react-in-jsx-scope',
          message: "'React' must be in scope when using JSX",
          line: 1,
          column: 1,
          severity: 'error',
          fix: () => "import React from 'react';\n",
        });
      }
    }

    return {
      elements,
      componentProps,
      propTypeErrors,
      missingImports,
      jsxLintingIssues,
    };
  }

  private parseJSXElement(element: any): JSXElementInfo | null {
    const openingElement = element.getOpeningElement();
    if (!openingElement) return null;

    const tagName = openingElement.getTagNameNode();
    const name = tagName?.getText() || 'unknown';

    const props = this.parseJSXAttributes(openingElement);
    const children = this.parseJSXChildren(element);

    return {
      name,
      props,
      children,
      line: element.getStartLineNumber(),
      column: element.getStartLinePos(),
    };
  }

  private parseJSXSelfClosingElement(element: any): JSXElementInfo | null {
    const name = element.getTagNameNode()?.getText() || 'unknown';
    const props = this.parseJSXAttributes(element);

    return {
      name,
      props,
      children: [],
      line: element.getStartLineNumber(),
      column: element.getStartLinePos(),
    };
  }

  private parseJSXFragment(fragment: any): JSXElementInfo[] {
    const elements: JSXElementInfo[] = [];
    const children = fragment.getChildren();

    for (const child of children) {
      if (child.getKind() === SyntaxKind.JsxElement) {
        const elementInfo = this.parseJSXElement(child);
        if (elementInfo) elements.push(elementInfo);
      } else if (child.getKind() === SyntaxKind.JsxSelfClosingElement) {
        const elementInfo = this.parseJSXSelfClosingElement(child);
        if (elementInfo) elements.push(elementInfo);
      }
    }

    return elements;
  }

  private parseJSXAttributes(element: any): Map<string, TypeInfo> {
    const props = new Map<string, TypeInfo>();
    const attributes = element.getAttributes();

    if (attributes) {
      for (const attr of attributes) {
        if (attr.getKind() === SyntaxKind.JsxAttribute) {
          const name = attr.getNameNode()?.getText();
          const initializer = attr.getInitializer();

          if (name && initializer) {
            const typeInfo = this.getTypeInfo(initializer);
            if (typeInfo) {
              props.set(name, typeInfo);
            }
          }
        } else if (attr.getKind() === SyntaxKind.JsxSpreadAttribute) {
          // Spread attribute - сложнее, пропускаем для простоты
          props.set('...spread', { typeString: 'any' } as TypeInfo);
        }
      }
    }

    return props;
  }

  private parseJSXChildren(element: any): JSXElementInfo[] {
    const children: JSXElementInfo[] = [];
    const jsxChildren = element.getChildren();

    for (const child of jsxChildren) {
      if (child.getKind() === SyntaxKind.JsxElement) {
        const childInfo = this.parseJSXElement(child);
        if (childInfo) children.push(childInfo);
      } else if (child.getKind() === SyntaxKind.JsxSelfClosingElement) {
        const childInfo = this.parseJSXSelfClosingElement(child);
        if (childInfo) children.push(childInfo);
      } else if (child.getKind() === SyntaxKind.JsxExpression) {
        // Выражения внутри JSX (например, {variable})
        const expression = child.getExpression();
        if (expression) {
          // Можно анализировать выражения, но для простоты пропускаем
        }
      }
    }

    return children;
  }

  private validateJSXProps(element: JSXElementInfo, sourceFile: SourceFile): TypeError[] {
    const errors: TypeError[] = [];

    // Пропускаем валидацию для intrinsic элементов (div, span, etc.)
    if (this.isIntrinsicElement(element.name)) {
      return errors;
    }

    // Получаем тип компонента
    const componentType = this.getComponentType(element.name, sourceFile);
    if (!componentType) {
      // Компонент не найден - возможно, не импортирован
      errors.push({
        node: null as any,
        message: `Component '${element.name}' is not defined or not imported`,
        expected: 'defined component',
        actual: 'undefined',
        location: { line: element.line, column: element.column },
      });
      return errors;
    }

    // Проверяем каждый проп
    for (const [propName, propType] of element.props) {
      const isDefined = this.isPropDefined(componentType, propName);

      if (!isDefined) {
        errors.push({
          node: null as any,
          message: `Prop '${propName}' is not defined in component ${element.name}`,
          expected: `prop '${propName}' should be defined`,
          actual: 'undefined',
          location: { line: element.line, column: element.column },
        });
      }

      // Проверяем тип пропа (упрощённо)
      if (isDefined && !this.isPropTypeCompatible(componentType, propName, propType)) {
        errors.push({
          node: null as any,
          message: `Prop '${propName}' type mismatch in component ${element.name}`,
          expected: this.getExpectedPropType(propName),
          actual: propType.typeString,
          location: { line: element.line, column: element.column },
        });
      }
    }

    // Проверяем обязательные пропсы
    const requiredProps = this.getRequiredProps(componentType);
    for (const requiredProp of requiredProps) {
      if (!element.props.has(requiredProp)) {
        errors.push({
          node: null as any,
          message: `Required prop '${requiredProp}' is missing in component ${element.name}`,
          expected: requiredProp,
          actual: 'missing',
          location: { line: element.line, column: element.column },
        });
      }
    }

    return errors;
  }

  private lintJSXElement(element: any): JSXLintingIssue[] {
    const issues: JSXLintingIssue[] = [];
    const openingElement = element.getOpeningElement();

    if (!openingElement) return issues;

    const tagName = openingElement.getTagNameNode()?.getText();
    const children = element.getChildren();
    const hasChildren = children.some(
      (c: any) =>
        c.getKind() !== SyntaxKind.JsxText ||
        (c.getKind() === SyntaxKind.JsxText && c.getText()?.trim())
    );

    // Правило: самозакрывающийся тег для компонентов без детей
    if (!hasChildren && tagName && tagName[0] === tagName[0].toUpperCase()) {
      issues.push({
        ruleId: 'react/self-closing-comp',
        message: `Component '${tagName}' has no children and should be self-closing`,
        line: element.getStartLineNumber(),
        column: element.getStartLinePos(),
        severity: 'warning',
        fix: () => {
          const text = element.getText();
          return text.replace(/<(\w+)([^>]*)>[\s]*<\/\1>/, '<$1$2 />');
        },
      });
    }

    return issues;
  }

  private lintJSXSelfClosingElement(element: any): JSXLintingIssue[] {
    const issues: JSXLintingIssue[] = [];
    const attributes = element.getAttributes();

    if (attributes) {
      for (const attr of attributes) {
        if (attr.getKind() === SyntaxKind.JsxAttribute) {
          const name = attr.getNameNode()?.getText();
          const initializer = attr.getInitializer();

          // Правило: boolean prop не должен иметь значение {true}
          if (initializer && initializer.getText() === '{true}') {
            issues.push({
              ruleId: 'react/jsx-boolean-value',
              message: `Boolean prop '${name}' should not be explicitly set to true`,
              line: element.getStartLineNumber(),
              column: element.getStartLinePos(),
              severity: 'warning',
              fix: () => {
                const text = element.getText();
                return text.replace(new RegExp(`${name}=\\{true\\}`, 'g'), name);
              },
            });
          }

          // Правило: строковые пропы не должны быть в фигурных скобках
          if (initializer && initializer.getText().match(/^\{['"]([^'"]+)['"]\}$/)) {
            const stringValue = initializer.getText().match(/['"]([^'"]+)['"]/)?.[1];
            if (stringValue) {
              issues.push({
                ruleId: 'react/jsx-curly-brace-presence',
                message: `String prop '${name}' should not be wrapped in curly braces`,
                line: element.getStartLineNumber(),
                column: element.getStartLinePos(),
                severity: 'warning',
                fix: () => {
                  const text = element.getText();
                  return text.replace(
                    new RegExp(`${name}=\\{['"]${stringValue}['"]\\}`, 'g'),
                    `${name}="${stringValue}"`
                  );
                },
              });
            }
          }
        }
      }
    }

    return issues;
  }

  private getComponentType(name: string, sourceFile: SourceFile): any | null {
    // Ищем импорт компонента
    const imports = sourceFile.getImportDeclarations();

    for (const imp of imports) {
      const namedImports = imp.getNamedImports();
      for (const named of namedImports) {
        if (named.getName() === name) {
          // Нашли импорт компонента
          return { type: 'component', name, imported: true };
        }
      }

      const defaultImport = imp.getDefaultImport();
      if (defaultImport && defaultImport.getText() === name) {
        return { type: 'component', name, imported: true, isDefault: true };
      }
    }

    // Проверяем, не является ли это intrinsic элементом
    if (this.isIntrinsicElement(name)) {
      return { type: 'intrinsic', name };
    }

    // Возможно, компонент определён локально
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      if (func.getName() === name) {
        return { type: 'component', name, isLocal: true };
      }
    }

    const variables = sourceFile.getVariableDeclarations();
    for (const varDecl of variables) {
      if (varDecl.getName() === name) {
        return { type: 'component', name, isLocal: true };
      }
    }

    return null;
  }

  private isIntrinsicElement(name: string): boolean {
    const intrinsicElements = new Set([
      'div',
      'span',
      'p',
      'a',
      'button',
      'input',
      'form',
      'ul',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'section',
      'article',
      'header',
      'footer',
      'nav',
      'main',
      'aside',
      'table',
      'tr',
      'td',
      'th',
      'img',
      'svg',
      'path',
      'circle',
      'rect',
      'label',
      'select',
      'option',
      'textarea',
    ]);
    return intrinsicElements.has(name);
  }

  private isPropDefined(_componentType: any, _propName: string): boolean {
    // Для intrinsic элементов большинство пропсов валидны
    return true;
  }

  private isPropTypeCompatible(
    _componentType: any,
    _propName: string,
    _propType: TypeInfo
  ): boolean {
    // Упрощённая проверка
    return true;
  }

  private getExpectedPropType(propName: string): string {
    if (propName === 'onClick' || propName === 'onChange') return 'function';
    if (propName === 'children') return 'ReactNode';
    if (propName === 'className') return 'string';
    return 'any';
  }

  private getRequiredProps(_componentType: any): string[] {
    // Упрощённо
    return [];
  }

  private checkReactImport(sourceFile: SourceFile): boolean {
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (moduleSpecifier === 'react' || moduleSpecifier === 'react/jsx-runtime') {
        return true;
      }
    }
    return false;
  }

  /**
   * Публичный метод для получения информации о типе узла
   */
  public getTypeInfo(node: Node): TypeInfo | null {
    return (this.typeAnalyzer as any).getTypeInfo(node);
  }

  generateReport(result: JSXAnalysisResult): string {
    let report = '';
    report += '='.repeat(60) + '\n';
    report += '⚛️ JSX/TSX ANALYSIS REPORT\n';
    report += '='.repeat(60) + '\n\n';

    report += '📊 Statistics:\n';
    report += `   • JSX elements: ${result.elements.length}\n`;
    report += `   • Components: ${result.componentProps.size}\n`;
    report += `   • Missing imports: ${result.missingImports.length}\n`;
    report += `   • Type errors: ${result.propTypeErrors.length}\n`;
    report += `   • Linting issues: ${result.jsxLintingIssues.length}\n\n`;

    if (result.elements.length > 0) {
      report += '📦 JSX Elements:\n';
      for (const element of result.elements.slice(0, 20)) {
        report += `   • <${element.name}> at line ${element.line}\n`;
        if (element.props.size > 0) {
          report += `     Props: ${Array.from(element.props.keys()).join(', ')}\n`;
        }
      }
      if (result.elements.length > 20) {
        report += `   ... and ${result.elements.length - 20} more\n`;
      }
      report += '\n';
    }

    if (result.componentProps.size > 0) {
      report += '🧩 Components:\n';
      for (const [name, props] of result.componentProps) {
        report += `   • ${name}: ${props.size} prop(s)\n`;
      }
      report += '\n';
    }

    if (result.propTypeErrors.length > 0) {
      report += '❌ Prop Type Errors:\n';
      for (const error of result.propTypeErrors.slice(0, 10)) {
        report += `   • ${error.message}\n`;
        report += `     Expected: ${error.expected}, Got: ${error.actual}\n`;
      }
      if (result.propTypeErrors.length > 10) {
        report += `   ... and ${result.propTypeErrors.length - 10} more\n`;
      }
      report += '\n';
    }

    if (result.jsxLintingIssues.length > 0) {
      report += '⚠️ Linting Issues:\n';
      for (const issue of result.jsxLintingIssues.slice(0, 10)) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        report += `   ${icon} ${issue.ruleId}: ${issue.message}\n`;
      }
      if (result.jsxLintingIssues.length > 10) {
        report += `   ... and ${result.jsxLintingIssues.length - 10} more\n`;
      }
      report += '\n';
    }

    if (result.missingImports.length > 0) {
      report += '📦 Missing imports:\n';
      for (const imp of result.missingImports) {
        report += `   • ${imp}\n`;
      }
      report += '\n';
    }

    report += '='.repeat(60) + '\n';

    return report;
  }

  applyFixes(sourceFile: SourceFile, issues: JSXLintingIssue[]): boolean {
    let hasChanges = false;
    let text = sourceFile.getText();

    // Применяем фиксы в обратном порядке (чтобы не сбивать позиции)
    const sortedIssues = [...issues].sort((a, b) => b.line - a.line);

    for (const issue of sortedIssues) {
      if (issue.fix) {
        const newText = issue.fix();
        if (newText) {
          // Находим и заменяем соответствующую строку
          const lines = text.split('\n');
          const lineIndex = issue.line - 1;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            const oldLine = lines[lineIndex];
            const fixedLine = newText.split('\n')[0];
            // Добавляем проверку на undefined
            if (oldLine !== undefined && fixedLine !== undefined && oldLine !== fixedLine) {
              lines[lineIndex] = fixedLine;
              text = lines.join('\n');
              hasChanges = true;
            }
          }
        }
      }
    }

    // Добавляем недостающие импорты
    if (
      this.checkReactImport(sourceFile) === false &&
      issues.some(i => i.ruleId === 'react/react-in-jsx-scope')
    ) {
      const reactImport = "import React from 'react';\n";
      if (!text.includes(reactImport)) {
        text = reactImport + text;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      sourceFile.replaceWithText(text);
    }

    return hasChanges;
  }
}

// Экспорт утилит для удобства
export function isJSXFile(filePath: string): boolean {
  return filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
}

export function getJSXFiles(filePaths: string[]): string[] {
  return filePaths.filter(f => isJSXFile(f));
}
