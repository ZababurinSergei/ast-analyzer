// src/refactor/ESLintASTFixer.ts
import type { SourceFile } from 'ts-morph';
import { Project, Node } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { ESLint } from 'eslint';

export interface ESLintFixResult {
  success: boolean;
  file: string;
  fixes: number;
  errors: string[];
}

export interface ESLintDiagnostic {
  ruleId: string;
  severity: number;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

export class ESLintASTFixer {
  private eslint: ESLint;
  private project: Project;
  private fixHistory: Map<string, string[]> = new Map();

  constructor() {
    this.eslint = new ESLint({
      fix: false,
      overrideConfig: {
        rules: {
          'no-unused-vars': 'warn',
          'no-undef': 'warn',
          semi: 'warn',
          quotes: ['warn', 'single'],
          'no-trailing-spaces': 'warn',
          'eol-last': 'warn',
          'no-multiple-empty-lines': 'warn',
          'comma-dangle': ['warn', 'always-multiline'],
          'prefer-const': 'warn',
          eqeqeq: ['warn', 'always'],
          'no-var': 'warn',
          'object-shorthand': 'warn',
          'arrow-body-style': 'warn',
          'no-unused-expressions': 'warn',
        },
      },
    });

    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
      },
      useInMemoryFileSystem: false,
    });
  }

  /**
   * Загружает файл в проект
   */
  private loadFile(filePath: string): SourceFile | undefined {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Файл не существует: ${filePath}`);
      return undefined;
    }

    try {
      return this.project.addSourceFileAtPath(filePath);
    } catch (error) {
      console.error(`❌ Ошибка загрузки ${filePath}:`, error);
      return undefined;
    }
  }

  /**
   * Получает диагностики ESLint
   */
  async getDiagnostics(filePath: string): Promise<ESLintDiagnostic[]> {
    const results = await this.eslint.lintFiles([filePath]);
    if (results.length === 0) return [];

    const result = results[0];
    if (!result || !result.messages) return [];

    return result.messages.map(msg => ({
      ruleId: msg.ruleId || 'unknown',
      severity: msg.severity,
      message: msg.message,
      line: msg.line || 1,
      column: msg.column || 1,
      endLine: msg.endLine,
      endColumn: msg.endColumn,
      fix: msg.fix,
    }));
  }

  /**
   * Исправляет диагностику через AST
   */
  private fixDiagnostic(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    // Сначала проверяем JSX правила
    if (diagnostic.ruleId?.startsWith('react/')) {
      return this.fixJSXDiagnostic(sourceFile, diagnostic);
    }

    // Существующие правила
    switch (diagnostic.ruleId) {
      case 'no-unused-vars':
        return this.fixNoUnusedVars(sourceFile, diagnostic);
      case 'no-undef':
        return this.fixNoUndef(sourceFile, diagnostic);
      case 'semi':
        return this.fixMissingSemi(sourceFile, diagnostic);
      case 'quotes':
        return this.fixQuotes(sourceFile, diagnostic);
      case 'no-trailing-spaces':
        return this.fixTrailingSpaces(sourceFile, diagnostic);
      case 'eol-last':
        return this.fixEOL(sourceFile);
      case 'no-multiple-empty-lines':
        return this.fixMultipleEmptyLines(sourceFile);
      case 'comma-dangle':
        return this.fixCommaDangle(sourceFile, diagnostic);
      case 'prefer-const':
        return this.fixPreferConst(sourceFile, diagnostic);
      case 'eqeqeq':
        return this.fixEqEqEq(sourceFile, diagnostic);
      case 'no-var':
        return this.fixNoVar(sourceFile, diagnostic);
      case 'object-shorthand':
        return this.fixObjectShorthand(sourceFile, diagnostic);
      case 'arrow-body-style':
        return this.fixArrowBodyStyle(sourceFile, diagnostic);
      case 'no-unused-expressions':
        return this.fixNoUnusedExpressions(sourceFile, diagnostic);
      default:
        return false;
    }
  }

  /**
   * Исправляет JSX диагностики
   */
  private fixJSXDiagnostic(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    switch (diagnostic.ruleId) {
      case 'react/self-closing-comp':
        return this.fixSelfClosingComponent(sourceFile, diagnostic);
      case 'react/jsx-boolean-value':
        return this.fixJSXBooleanValue(sourceFile, diagnostic);
      case 'react/jsx-curly-brace-presence':
        return this.fixJSXCurlyBraces(sourceFile, diagnostic);
      case 'react/jsx-pascal-case':
        return this.fixJSXPascalCase(sourceFile, diagnostic);
      case 'react/jsx-closing-bracket-location':
        return this.fixJSXClosingBracketLocation(sourceFile, diagnostic);
      case 'react/jsx-curly-spacing':
        return this.fixJSXCurlySpacing(sourceFile, diagnostic);
      case 'react/jsx-equals-spacing':
        return this.fixJSXEqualsSpacing(sourceFile, diagnostic);
      case 'react/jsx-indent':
        return this.fixJSXIndent(sourceFile, diagnostic);
      case 'react/jsx-indent-props':
        return this.fixJSXIndentProps(sourceFile, diagnostic);
      case 'react/jsx-max-props-per-line':
        return this.fixJSXMaxPropsPerLine(sourceFile, diagnostic);
      case 'react/jsx-no-duplicate-props':
        return this.fixJSXNoDuplicateProps(sourceFile, diagnostic);
      case 'react/jsx-props-no-multi-spaces':
        return this.fixJSXPropsNoMultiSpaces(sourceFile, diagnostic);
      case 'react/jsx-tag-spacing':
        return this.fixJSXTagSpacing(sourceFile, diagnostic);
      case 'react/jsx-wrap-multilines':
        return this.fixJSXWrapMultilines(sourceFile, diagnostic);
      default:
        return false;
    }
  }

  /**
   * react/self-closing-comp: преобразует <Component></Component> в <Component />
   */
  private fixSelfClosingComponent(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Преобразуем <Component></Component> в <Component />
      const openClosePattern = /<(\w+)([^>]*)>[\s]*<\/\1>/g;
      if (openClosePattern.test(line)) {
        const newLine = line.replace(openClosePattern, '<$1$2 />');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/self-closing-comp: Преобразован в самозакрывающийся тег'
          );
          return true;
        }
      }

      // Также обрабатываем многострочные случаи
      if (line.includes('</') && lineIndex > 0) {
        let fullElement = '';
        let startIndex = lineIndex;
        let endIndex = lineIndex;

        // Ищем открывающий тег
        while (startIndex >= 0 && lines[startIndex] && !lines[startIndex]!.includes('<')) {
          startIndex--;
        }

        // Ищем закрывающий тег
        while (endIndex < lines.length && lines[endIndex] && !lines[endIndex]!.includes('</')) {
          endIndex++;
        }

        if (startIndex >= 0 && endIndex < lines.length) {
          for (let i = startIndex; i <= endIndex; i++) {
            const lineContent = lines[i];
            if (lineContent !== undefined) {
              fullElement += lineContent;
            }
          }

          const match = fullElement.match(/<(\w+)([^>]*)>[\s\S]*<\/\1>/);
          if (match) {
            const newElement = `<${match[1]}${match[2]} />`;
            const newLines = fullElement
              .replace(/<(\w+)([^>]*)>[\s\S]*<\/\1>/, newElement)
              .split('\n');

            // Заменяем все строки
            for (let i = startIndex; i <= endIndex; i++) {
              const newLineIndex = i - startIndex;
              if (newLineIndex < newLines.length) {
                const newLineContent = newLines[newLineIndex];
                if (newLineContent !== undefined) {
                  lines[i] = newLineContent;
                }
              } else {
                lines[i] = '';
              }
            }

            sourceFile.replaceWithText(lines.join('\n'));
            this.addToHistory(
              sourceFile.getFilePath(),
              'react/self-closing-comp: Преобразован в самозакрывающийся тег (многострочный)'
            );
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-boolean-value: преобразует prop={true} в prop
   */
  private fixJSXBooleanValue(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Преобразуем prop={true} в prop
      const truePattern = /(\w+)=\{true\}/g;
      if (truePattern.test(line)) {
        const newLine = line.replace(truePattern, '$1');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-boolean-value: Убрано лишнее {true}'
          );
          return true;
        }
      }

      // Преобразуем prop={false} в prop={false} (оставляем как есть, но можно предупредить)
      const falsePattern = /(\w+)=\{false\}/g;
      if (falsePattern.test(line)) {
        // false оставляем, но логируем
        this.addToHistory(
          sourceFile.getFilePath(),
          'react/jsx-boolean-value: prop с false найден, рекомендуется использовать {false}'
        );
      }
    }

    return false;
  }

  /**
   * react/jsx-curly-brace-presence: убирает лишние фигурные скобки
   */
  private fixJSXCurlyBraces(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Убираем лишние фигурные скобки вокруг строк
      const curlyStringPattern = /\{['"]([^'"]+)['"]\}/g;
      if (curlyStringPattern.test(line)) {
        const newLine = line.replace(curlyStringPattern, '$1');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-curly-brace-presence: Убраны лишние фигурные скобки вокруг строки'
          );
          return true;
        }
      }

      // Добавляем фигурные скобки для выражений
      const noCurlyPattern = /(\w+)=([a-zA-Z_][a-zA-Z0-9_]*)/g;
      if (noCurlyPattern.test(line) && !line.includes('className') && !line.includes('key')) {
        const newLine = line.replace(noCurlyPattern, '$1={$2}');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-curly-brace-presence: Добавлены фигурные скобки для выражения'
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-pascal-case: исправляет регистр имени компонента
   */
  private fixJSXPascalCase(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Находим имя компонента с маленькой буквы
      const lowerCasePattern = /<([a-z][a-z0-9]*)/g;
      let match;
      let modified = false;
      let newLine = line;

      while ((match = lowerCasePattern.exec(line)) !== null) {
        const oldName = match[1];
        if (oldName && !this.isReservedHtmlTag(oldName)) {
          const newName = oldName.charAt(0).toUpperCase() + oldName.slice(1);
          newLine = newLine.replace(`<${oldName}`, `<${newName}`);
          newLine = newLine.replace(`</${oldName}`, `</${newName}`);
          modified = true;
          this.addToHistory(
            sourceFile.getFilePath(),
            `react/jsx-pascal-case: Переименован компонент '${oldName}' → '${newName}'`
          );
        }
      }

      if (modified && newLine !== line) {
        lines[lineIndex] = newLine;
        sourceFile.replaceWithText(lines.join('\n'));
        return true;
      }
    }

    return false;
  }

  /**
   * react/jsx-closing-bracket-location: исправляет расположение закрывающей скобки
   */
  private fixJSXClosingBracketLocation(
    sourceFile: SourceFile,
    diagnostic: ESLintDiagnostic
  ): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Переносим закрывающую скобку на новую строку
      if (line.includes(' />') && line.length > 80) {
        const newLine = line.replace(' />', '\n/>');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-closing-bracket-location: Перенесена закрывающая скобка'
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-curly-spacing: исправляет пробелы внутри фигурных скобок
   */
  private fixJSXCurlySpacing(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Убираем пробелы внутри {}
      const spaceInsidePattern = /\{\s+([^}]+?)\s+\}/g;
      if (spaceInsidePattern.test(line)) {
        const newLine = line.replace(/\{\s+([^}]+?)\s+\}/g, '{$1}');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-curly-spacing: Убраны пробелы внутри фигурных скобок'
          );
          return true;
        }
      }

      // Добавляем пробелы если нужно
      const noSpacePattern = /\{([^}\s][^}]*[^}\s])\}/g;
      if (noSpacePattern.test(line) && line.includes('{')) {
        const newLine = line.replace(/\{([^}\s][^}]*[^}\s])\}/g, '{ $1 }');
        if (newLine !== line && !newLine.includes('{{') && !newLine.includes('}}')) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-curly-spacing: Добавлены пробелы внутри фигурных скобок'
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-equals-spacing: исправляет пробелы вокруг = в JSX атрибутах
   */
  private fixJSXEqualsSpacing(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Убираем пробелы вокруг =
      const spaceAroundEqual = /\s+=\s+/g;
      if (spaceAroundEqual.test(line)) {
        const newLine = line.replace(/\s+=\s+/g, '=');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            "react/jsx-equals-spacing: Убраны пробелы вокруг '='"
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-indent: исправляет отступы в JSX
   */
  private fixJSXIndent(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const indentMatch = line.match(/^(\s+)/);
      const currentIndent = indentMatch && indentMatch[1] ? indentMatch[1].length : 0;
      const expectedIndent = Math.floor(currentIndent / 2) * 2;

      if (currentIndent !== expectedIndent && line.trim()) {
        const newIndent = ' '.repeat(expectedIndent);
        const newLine = newIndent + line.trim();
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            `react/jsx-indent: Исправлен отступ с ${currentIndent} на ${expectedIndent}`
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-indent-props: исправляет отступы для props
   */
  private fixJSXIndentProps(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Находим prop строку
      if (line.trim() && !line.includes('<') && line.includes('=')) {
        const indentMatch = line.match(/^(\s+)/);
        const currentIndent = indentMatch && indentMatch[1] ? indentMatch[1].length : 0;

        // Пропсы должны иметь отступ на 2 пробела больше чем тег
        let tagLineIndex = lineIndex - 1;
        let tagIndent = 0;

        while (tagLineIndex >= 0 && lines[tagLineIndex] && !lines[tagLineIndex]!.includes('<')) {
          tagLineIndex--;
        }

        if (tagLineIndex >= 0 && lines[tagLineIndex]) {
          const tagIndentMatch = lines[tagLineIndex]!.match(/^(\s+)/);
          tagIndent = tagIndentMatch && tagIndentMatch[1] ? tagIndentMatch[1].length : 0;
          const expectedIndent = tagIndent + 2;

          if (currentIndent !== expectedIndent) {
            const newIndent = ' '.repeat(expectedIndent);
            const newLine = newIndent + line.trim();
            if (newLine !== line) {
              lines[lineIndex] = newLine;
              sourceFile.replaceWithText(lines.join('\n'));
              this.addToHistory(
                sourceFile.getFilePath(),
                'react/jsx-indent-props: Исправлен отступ пропа'
              );
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-max-props-per-line: переносит лишние пропсы на новую строку
   */
  private fixJSXMaxPropsPerLine(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Считаем количество пропсов в строке
      const propMatches = line.match(/\w+=/g);
      const propCount = propMatches ? propMatches.length : 0;

      // Если больше 1 пропа на строке и строка длинная, переносим
      if (propCount > 1 && line.length > 80 && line.includes('<') && !line.includes('/>')) {
        // Разбиваем пропсы на отдельные строки
        const tagMatch = line.match(/<(\w+)/);
        if (tagMatch) {
          const tagName = tagMatch[1];
          const props = line.match(/\w+=\{([^}]+)\}|\w+=\"[^\"]+\"|\w+='[^']+'|\w+(?=\s|>)/g);

          if (props && props.length > 1) {
            const firstProp = props[0];
            const remainingProps = props.slice(1);

            const newLine = `<${tagName} ${firstProp}`;
            const newLines = [newLine];

            for (const prop of remainingProps) {
              newLines.push(`  ${prop}`);
            }

            newLines.push('/>');

            // Заменяем строки
            const firstNewLine = newLines[0];
            if (firstNewLine !== undefined) {
              lines[lineIndex] = firstNewLine;
            }
            for (let i = 1; i < newLines.length; i++) {
              const newLineContent = newLines[i];
              if (newLineContent !== undefined) {
                lines.splice(lineIndex + i, 0, newLineContent);
              }
            }

            sourceFile.replaceWithText(lines.join('\n'));
            this.addToHistory(
              sourceFile.getFilePath(),
              'react/jsx-max-props-per-line: Перенесены пропсы на новые строки'
            );
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-no-duplicate-props: удаляет дублирующиеся пропсы
   */
  private fixJSXNoDuplicateProps(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      let line = lines[lineIndex];

      // Находим дублирующиеся пропсы
      const propNames = new Set<string>();
      const propRegex = /(\w+)=/g;
      let match;
      const duplicates: string[] = [];

      while ((match = propRegex.exec(line)) !== null) {
        const propName = match[1];
        if (propName) {
          if (propNames.has(propName)) {
            duplicates.push(propName);
          } else {
            propNames.add(propName);
          }
        }
      }

      if (duplicates.length > 0) {
        // Удаляем дубликаты (оставляем первое вхождение)
        for (const dup of duplicates) {
          const dupRegex = new RegExp(`\\s+${dup}=[^\\s>]+`, 'g');
          line = line.replace(dupRegex, '');
        }

        if (line !== lines[lineIndex]) {
          lines[lineIndex] = line;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            `react/jsx-no-duplicate-props: Удалены дублирующиеся пропсы: ${duplicates.join(', ')}`
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-props-no-multi-spaces: убирает множественные пробелы между пропсами
   */
  private fixJSXPropsNoMultiSpaces(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Заменяем множественные пробелы на один
      const multiSpacePattern = /\s{2,}/g;
      if (multiSpacePattern.test(line)) {
        const newLine = line.replace(/\s{2,}/g, ' ');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            'react/jsx-props-no-multi-spaces: Убраны множественные пробелы'
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * react/jsx-tag-spacing: исправляет пробелы вокруг тегов
   */
  private fixJSXTagSpacing(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      let line = lines[lineIndex];
      let modified = false;

      // Убираем пробел перед закрывающей скобкой самозакрывающегося тега
      if (line.includes(' />') && !line.includes('  />')) {
        const newLine = line.replace(' />', '/>');
        if (newLine !== line) {
          line = newLine;
          modified = true;
        }
      }

      // Добавляем пробел после открывающего тега
      const openingTagPattern = /<(\w+)(?![^>]*\/>)([^>]*?)>/g;
      if (openingTagPattern.test(line) && !line.includes('< ')) {
        const newLine = line.replace(/<(\w+)([^>]*?)>/g, '<$1 $2>');
        if (newLine !== line && !newLine.includes('<>')) {
          line = newLine;
          modified = true;
        }
      }

      if (modified) {
        lines[lineIndex] = line;
        sourceFile.replaceWithText(lines.join('\n'));
        this.addToHistory(
          sourceFile.getFilePath(),
          'react/jsx-tag-spacing: Исправлены пробелы вокруг тега'
        );
        return true;
      }
    }

    return false;
  }

  /**
   * react/jsx-wrap-multilines: оборачивает многострочный JSX в скобки
   */
  private fixJSXWrapMultilines(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Проверяем, что строка содержит JSX и не обернута в скобки
      if (
        line.includes('<') &&
        line.includes('>') &&
        !line.trim().startsWith('(') &&
        !line.trim().startsWith('return')
      ) {
        // Ищем родительскую строку с return
        let returnLineIndex = lineIndex - 1;
        while (
          returnLineIndex >= 0 &&
          lines[returnLineIndex] &&
          !lines[returnLineIndex]!.includes('return')
        ) {
          returnLineIndex--;
        }

        if (
          returnLineIndex >= 0 &&
          lines[returnLineIndex] &&
          lines[returnLineIndex]!.includes('return')
        ) {
          let returnLine = lines[returnLineIndex];
          if (returnLine) {
            // Добавляем открывающую скобку
            if (!returnLine.includes('(')) {
              returnLine = returnLine.replace('return', 'return (');
              lines[returnLineIndex] = returnLine;

              // Добавляем закрывающую скобку в конце JSX блока
              let closingLineIndex = lineIndex;
              while (
                closingLineIndex < lines.length &&
                lines[closingLineIndex] &&
                !lines[closingLineIndex]!.includes(';')
              ) {
                closingLineIndex++;
              }

              if (closingLineIndex < lines.length && lines[closingLineIndex]) {
                lines[closingLineIndex] = lines[closingLineIndex] + ')';
              }

              sourceFile.replaceWithText(lines.join('\n'));
              this.addToHistory(
                sourceFile.getFilePath(),
                'react/jsx-wrap-multilines: JSX обернут в скобки'
              );
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * no-unused-vars: добавляет префикс _ к неиспользуемой переменной
   */
  private fixNoUnusedVars(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const match = diagnostic.message.match(/'(\\w+)' is defined but never used/);
    if (!match) return false;

    const varName = match[1];
    if (!varName) return false;

    const variableDecl = sourceFile.getVariableDeclaration(varName);
    if (variableDecl) {
      const newName = `_${varName}`;
      variableDecl.rename(newName);
      this.addToHistory(
        sourceFile.getFilePath(),
        `no-unused-vars: Переименована '${varName}' → '${newName}'`
      );
      return true;
    }

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const param = func.getParameter(varName);
      if (param) {
        param.rename(`_${varName}`);
        this.addToHistory(
          sourceFile.getFilePath(),
          `no-unused-vars: Переименован параметр '${varName}' → '_${varName}'`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * no-undef: добавляет объявление переменной
   */
  private fixNoUndef(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const match = diagnostic.message.match(/'(\\w+)' is not defined/);
    if (!match) return false;

    const varName = match[1];
    if (!varName) return false;

    const existing =
      sourceFile.getVariableDeclaration(varName) ||
      sourceFile.getFunction(varName) ||
      sourceFile.getClass(varName);
    if (existing) return false;

    const declaration = `const ${varName} = undefined; // TODO: declare properly\n`;
    sourceFile.insertText(0, declaration);
    this.addToHistory(sourceFile.getFilePath(), `no-undef: Добавлено объявление '${varName}'`);
    return true;
  }

  /**
   * semi: добавляет точку с запятой
   */
  private fixMissingSemi(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmed = line.trimEnd();

      if (
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.endsWith('(') &&
        !trimmed.endsWith('[') &&
        !trimmed.endsWith(';')
      ) {
        lines[lineIndex] = trimmed + ';';
        sourceFile.replaceWithText(lines.join('\n'));
        this.addToHistory(
          sourceFile.getFilePath(),
          `semi: Добавлена точка с запятой на строке ${lineNumber}`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * quotes: заменяет двойные кавычки на одинарные
   */
  private fixQuotes(sourceFile: SourceFile, _diagnostic: ESLintDiagnostic): boolean {
    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isStringLiteral(node)) {
        const text = node.getText();
        if (text.startsWith('"') && !text.includes("'")) {
          const newText = text.replace(/"/g, "'");
          node.replaceWithText(newText);
          fixed = true;
        }
      }
    });

    if (fixed) {
      this.addToHistory(sourceFile.getFilePath(), 'quotes: Заменены двойные кавычки на одинарные');
    }

    return fixed;
  }

  /**
   * no-trailing-spaces: удаляет пробелы в конце строк
   */
  private fixTrailingSpaces(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const originalLine = lines[lineIndex];
      const trimmedLine = originalLine.replace(/\s+$/, '');

      if (originalLine !== trimmedLine) {
        lines[lineIndex] = trimmedLine;
        sourceFile.replaceWithText(lines.join('\n'));
        this.addToHistory(
          sourceFile.getFilePath(),
          `no-trailing-spaces: Удалены пробелы на строке ${lineNumber}`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * eol-last: добавляет пустую строку в конце файла
   */
  private fixEOL(sourceFile: SourceFile): boolean {
    const text = sourceFile.getText();
    if (!text.endsWith('\n')) {
      sourceFile.replaceWithText(text + '\n');
      this.addToHistory(
        sourceFile.getFilePath(),
        'eol-last: Добавлена пустая строка в конце файла'
      );
      return true;
    }
    return false;
  }

  /**
   * no-multiple-empty-lines: удаляет лишние пустые строки
   */
  private fixMultipleEmptyLines(sourceFile: SourceFile): boolean {
    const text = sourceFile.getText();
    const newText = text.replace(/\n{3,}/g, '\n\n');

    if (text !== newText) {
      sourceFile.replaceWithText(newText);
      this.addToHistory(
        sourceFile.getFilePath(),
        'no-multiple-empty-lines: Удалены лишние пустые строки'
      );
      return true;
    }

    return false;
  }

  /**
   * comma-dangle: добавляет или удаляет висящую запятую
   */
  private fixCommaDangle(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      if (diagnostic.message.includes('Missing')) {
        const newLine = line.replace(/\s*$/, ',');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            `comma-dangle: Добавлена висящая запятая на строке ${lineNumber}`
          );
          return true;
        }
      } else if (diagnostic.message.includes('Unexpected')) {
        const newLine = line.replace(/,\s*$/, '');
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          sourceFile.replaceWithText(lines.join('\n'));
          this.addToHistory(
            sourceFile.getFilePath(),
            `comma-dangle: Удалена висящая запятая на строке ${lineNumber}`
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * prefer-const: заменяет let на const где возможно
   */
  private fixPreferConst(sourceFile: SourceFile, _diagnostic: ESLintDiagnostic): boolean {
    let fixed = false;

    const variableStatements = sourceFile.getVariableStatements();
    for (const statement of variableStatements) {
      const declarationKind = statement.getDeclarationKind();
      if (declarationKind === 'let') {
        const declarations = statement.getDeclarations();
        let canBeConst = true;

        for (const decl of declarations) {
          const name = decl.getName();
          const assignments = this.findAssignmentsToVariable(sourceFile, name, decl);
          if (assignments.length > 0) {
            canBeConst = false;
            break;
          }
        }

        if (canBeConst) {
          statement.setDeclarationKind('const' as any);
          fixed = true;
        }
      }
    }

    if (fixed) {
      this.addToHistory(
        sourceFile.getFilePath(),
        "prefer-const: Заменены 'let' на 'const' где возможно"
      );
    }

    return fixed;
  }

  /**
   * eqeqeq: заменяет == на === и != на !==
   */
  private fixEqEqEq(sourceFile: SourceFile, _diagnostic: ESLintDiagnostic): boolean {
    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isBinaryExpression(node)) {
        const operatorToken = node.getOperatorToken();
        if (operatorToken) {
          const operatorText = operatorToken.getText();
          if (operatorText === '==') {
            operatorToken.replaceWithText('===');
            fixed = true;
          } else if (operatorText === '!=') {
            operatorToken.replaceWithText('!==');
            fixed = true;
          }
        }
      }
    });

    if (fixed) {
      this.addToHistory(sourceFile.getFilePath(), "eqeqeq: Заменены '==' на '===' и '!=' on '!=='");
    }

    return fixed;
  }

  /**
   * no-var: заменяет var на let или const
   */
  private fixNoVar(sourceFile: SourceFile, _diagnostic: ESLintDiagnostic): boolean {
    let fixed = false;

    const variableStatements = sourceFile.getVariableStatements();
    for (const statement of variableStatements) {
      const declarationKind = statement.getDeclarationKind();
      if (declarationKind === 'var') {
        const declarations = statement.getDeclarations();
        let canBeConst = true;

        for (const decl of declarations) {
          const name = decl.getName();
          const assignments = this.findAssignmentsToVariable(sourceFile, name, decl);
          if (assignments.length > 0) {
            canBeConst = false;
            break;
          }
        }

        const newKind = canBeConst ? 'const' : 'let';
        statement.setDeclarationKind(newKind as any);
        fixed = true;
      }
    }

    if (fixed) {
      this.addToHistory(sourceFile.getFilePath(), "no-var: Заменены 'var' на 'let' или 'const'");
    }

    return fixed;
  }

  /**
   * object-shorthand: сокращает объявления объектов
   */
  private fixObjectShorthand(sourceFile: SourceFile, _diagnostic: ESLintDiagnostic): boolean {
    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isPropertyAssignment(node)) {
        const name = node.getName();
        const initializer = node.getInitializer();

        if (initializer && Node.isIdentifier(initializer) && initializer.getText() === name) {
          const parent = node.getParent();
          if (parent && Node.isObjectLiteralExpression(parent)) {
            const newText = name;
            node.replaceWithText(newText);
            fixed = true;
          }
        }
      }
    });

    if (fixed) {
      this.addToHistory(
        sourceFile.getFilePath(),
        'object-shorthand: Использована сокращённая запись свойств'
      );
    }

    return fixed;
  }

  /**
   * arrow-body-style: упрощает стрелочные функции
   */
  private fixArrowBodyStyle(sourceFile: SourceFile, _diagnostic: ESLintDiagnostic): boolean {
    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isArrowFunction(node)) {
        const body = node.getBody();
        if (body && Node.isBlock(body)) {
          const statements = body.getStatements();
          if (statements.length === 1) {
            const statement = statements[0];
            if (statement && Node.isReturnStatement(statement)) {
              const returnExpr = statement.getExpression();
              if (returnExpr) {
                const params = node
                  .getParameters()
                  .map(p => p.getText())
                  .join(', ');
                const returnText = returnExpr.getText();
                const newText = `(${params}) => ${returnText}`;
                node.replaceWithText(newText);
                fixed = true;
              }
            }
          }
        }
      }
    });

    if (fixed) {
      this.addToHistory(sourceFile.getFilePath(), 'arrow-body-style: Упрощены стрелочные функции');
    }

    return fixed;
  }

  /**
   * no-unused-expressions: удаляет неиспользуемые выражения
   */
  private fixNoUnusedExpressions(sourceFile: SourceFile, diagnostic: ESLintDiagnostic): boolean {
    const lineNumber = diagnostic.line;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      if (
        !trimmed.includes('=') &&
        !trimmed.includes('return') &&
        !trimmed.includes('if') &&
        !trimmed.includes('for') &&
        !trimmed.includes('while') &&
        !trimmed.includes('function')
      ) {
        lines.splice(lineIndex, 1);
        sourceFile.replaceWithText(lines.join('\n'));
        this.addToHistory(
          sourceFile.getFilePath(),
          `no-unused-expressions: Удалено неиспользуемое выражение на строке ${lineNumber}`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Находит все присвоения переменной после её объявления
   */
  private findAssignmentsToVariable(
    sourceFile: SourceFile,
    varName: string,
    excludeNode: Node
  ): Node[] {
    const assignments: Node[] = [];

    sourceFile.forEachDescendant(node => {
      if (node === excludeNode) return;

      if (Node.isBinaryExpression(node)) {
        const operatorToken = node.getOperatorToken();
        if (operatorToken && operatorToken.getText() === '=') {
          const left = node.getLeft();
          if (left && Node.isIdentifier(left) && left.getText() === varName) {
            assignments.push(node);
          }
        }
      }
    });

    return assignments;
  }

  /**
   * Проверяет, является ли тег зарезервированным HTML тегом
   */
  private isReservedHtmlTag(tagName: string): boolean {
    const htmlTags = new Set([
      'div',
      'span',
      'p',
      'a',
      'button',
      'input',
      'form',
      'label',
      'select',
      'option',
      'table',
      'tr',
      'td',
      'th',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'header',
      'footer',
      'nav',
      'section',
      'article',
      'aside',
      'main',
      'figure',
      'img',
      'video',
      'audio',
      'canvas',
      'svg',
      'path',
      'circle',
      'rect',
      'line',
    ]);
    return htmlTags.has(tagName);
  }

  /**
   * Добавляет запись в историю исправлений
   */
  private addToHistory(filePath: string, fix: string): void {
    if (!this.fixHistory.has(filePath)) {
      this.fixHistory.set(filePath, []);
    }
    const history = this.fixHistory.get(filePath);
    if (history) {
      history.push(fix);
    }
  }

  /**
   * Возвращает список правил, которые могут быть исправлены через AST
   */
  private getFixableRules(): string[] {
    return [
      // Стандартные правила
      'no-unused-vars',
      'no-undef',
      'semi',
      'quotes',
      'no-trailing-spaces',
      'eol-last',
      'no-multiple-empty-lines',
      'comma-dangle',
      'prefer-const',
      'eqeqeq',
      'no-var',
      'object-shorthand',
      'arrow-body-style',
      'no-unused-expressions',

      // JSX/React правила
      'react/self-closing-comp',
      'react/jsx-boolean-value',
      'react/jsx-curly-brace-presence',
      'react/jsx-pascal-case',
      'react/jsx-closing-bracket-location',
      'react/jsx-curly-spacing',
      'react/jsx-equals-spacing',
      'react/jsx-indent',
      'react/jsx-indent-props',
      'react/jsx-max-props-per-line',
      'react/jsx-no-duplicate-props',
      'react/jsx-props-no-multi-spaces',
      'react/jsx-tag-spacing',
      'react/jsx-wrap-multilines',
    ];
  }

  /**
   * Основной метод исправления ESLint ошибок через AST
   */
  async fixFile(filePath: string, createBackup = true): Promise<ESLintFixResult> {
    let fixes = 0;
    const errors: string[] = [];
    let backupPath: string | undefined;

    console.log(`\n🔧 Исправление ESLint ошибок в ${path.basename(filePath)}`);

    try {
      if (createBackup) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.promises.copyFile(filePath, backupPath);
      }

      const sourceFile = this.loadFile(filePath);
      if (!sourceFile) {
        return { success: false, file: filePath, fixes: 0, errors: ['Не удалось загрузить файл'] };
      }

      const maxIterations = 5;
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        const diagnostics = await this.getDiagnostics(filePath);
        const fixableDiagnostics = diagnostics.filter(d =>
          this.getFixableRules().includes(d.ruleId || '')
        );

        if (fixableDiagnostics.length === 0) break;

        let iterationFixes = 0;
        for (const diagnostic of fixableDiagnostics) {
          const fixed = this.fixDiagnostic(sourceFile, diagnostic);
          if (fixed) {
            iterationFixes++;
            console.log(
              `  ✅ Исправлено: ${diagnostic.ruleId} - ${diagnostic.message.substring(0, 60)}`
            );
          }
        }

        if (iterationFixes === 0) break;

        fixes += iterationFixes;
        await sourceFile.save();
      }

      if (fixes > 0) {
        console.log(`  📝 Всего исправлений: ${fixes}`);
      }

      return { success: true, file: filePath, fixes, errors };
    } catch (error: any) {
      errors.push(error.message);
      if (backupPath && fs.existsSync(backupPath)) {
        await fs.promises.copyFile(backupPath, filePath);
      }
      return { success: false, file: filePath, fixes, errors };
    }
  }

  /**
   * Исправляет несколько файлов
   */
  async fixFiles(filePaths: string[], createBackup = true): Promise<ESLintFixResult[]> {
    const results: ESLintFixResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.fixFile(filePath, createBackup);
      results.push(result);

      if (result.success) {
        console.log(`✅ ${path.basename(filePath)}: исправлено ${result.fixes} проблем`);
      } else {
        console.log(`❌ ${path.basename(filePath)}: не удалось исправить`);
      }
    }

    const totalFixes = results.reduce((sum, r) => sum + r.fixes, 0);
    console.log(`\n📊 ВСЕГО ИСПРАВЛЕНО: ${totalFixes} проблем`);

    return results;
  }

  /**
   * Получить историю исправлений
   */
  getFixHistory(): Map<string, string[]> {
    return this.fixHistory;
  }

  /**
   * Очистить историю
   */
  clearHistory(): void {
    this.fixHistory.clear();
  }
}
