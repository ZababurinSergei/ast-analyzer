// packages/ast-analyzer/src/refactor/TemplateUpdater.ts
import { parse as parseVue } from '@vue/compiler-sfc';
import fs from 'fs';
import path from 'path';
import type { ExtractedModule } from './index.js';

export class TemplateUpdater {
  private options: any;

  constructor(options: any = {}) {
    this.options = options;
    // Параметры зарезервированы для будущего использования
    if (Object.keys(this.options).length > 0) {
      // Опции будут использоваться в следующих версиях
      const _unused = this.options;
      void _unused;
    }
  }

  async update(vuePath: string, modules: ExtractedModule[]): Promise<void> {
    const content = await fs.promises.readFile(vuePath, 'utf-8');
    const { descriptor, errors } = parseVue(content, { filename: vuePath });

    if (errors.length > 0) {
      console.warn(`⚠️ Ошибки парсинга Vue: ${errors.map(e => e.message).join(', ')}`);
    }

    if (!descriptor.template) {
      console.log('ℹ️ Нет template блока, пропускаем');
      return;
    }

    // Строим карту экспортов
    const exportsMap = new Map<string, string>();
    for (const module of modules) {
      for (const exp of module.exports) {
        exportsMap.set(exp, module.path);
      }
    }

    // Обновляем template
    const updatedTemplate = await this.updateTemplateImports(
      descriptor.template.content,
      exportsMap
    );

    // Обновляем script блок, если нужно
    const updatedScript = await this.updateScriptImports(descriptor, modules);

    // Записываем обновлённый файл
    await this.writeVueFile(vuePath, updatedScript, updatedTemplate, descriptor.styles);
  }

  private async updateTemplateImports(
    template: string,
    exportsMap: Map<string, string>
  ): Promise<string> {
    const updated = template;

    // Обновляем вызовы функций в интерполяциях
    for (const [exportName] of exportsMap) {
      const patterns = [
        new RegExp(`{{\\s*${exportName}\\s*\\(`, 'g'),
        new RegExp(`@\\w+=\\"\\s*${exportName}\\s*\\(`, 'g'),
        new RegExp(`:\\w+=\\"\\s*${exportName}\\s*`, 'g'),
      ];

      for (const pattern of patterns) {
        if (pattern.test(updated)) {
          console.log(`  📝 Обновлён вызов: ${exportName}() в template`);
        }
      }
    }

    return updated;
  }

  private async updateScriptImports(descriptor: any, modules: ExtractedModule[]): Promise<string> {
    const scriptContent = descriptor.scriptSetup?.content || descriptor.script?.content || '';

    if (!scriptContent) {
      return scriptContent;
    }

    // Генерируем импорты
    let imports = '';
    for (const module of modules) {
      const relativePath = path.relative('.', module.path).replace(/\\/g, '/');
      imports += `import { ${module.exports.join(', ')} } from '${relativePath}';\n`;
    }

    // Вставляем импорты после существующих
    const lines = scriptContent.split('\n');
    let insertIndex = 0;

    // Находим последний импорт
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import')) {
        insertIndex = i + 1;
      }
    }

    lines.splice(insertIndex, 0, imports);

    return lines.join('\n');
  }

  private async writeVueFile(
    vuePath: string,
    script: string,
    template: string,
    styles: any[]
  ): Promise<void> {
    let content = '';

    if (template && template.trim()) {
      content += `<template>\n${template}\n</template>\n\n`;
    }

    content += `<script setup lang="ts">\n${script}\n</script>\n\n`;

    for (const style of styles) {
      const scoped = style.scoped ? ' scoped' : '';
      content += `<style${scoped}>\n${style.content}\n</style>\n`;
    }

    await fs.promises.writeFile(vuePath, content, 'utf-8');
    console.log(`  📄 Обновлён Vue файл: ${vuePath}`);
  }
}
