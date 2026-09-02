// packages/ast-analyzer/src/cli/commands/VerifyCommand.ts
// ИСПРАВЛЕННАЯ ВЕРСИЯ - Удалены неиспользуемые импорты

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

/**
 * Команда для формальной верификации функций через Z3
 *
 * Использование:
 *   npx ast-analyzer verify <file> --function <name>
 *   npx ast-analyzer verify <file> --contract <file.json>
 *   npx ast-analyzer verify <file> --function <name> --output result.json
 */
export class VerifyCommand {
  private program: Command;

  constructor() {
    this.program = new Command()
      .name('verify')
      .description('🔬 Formal verification with Z3')
      .argument('<file>', 'Path to the file containing the function')
      .option('-f, --function <name>', 'Function name to verify')
      .option('-c, --contract <file>', 'Contract file (JSON)')
      .option('-o, --output <file>', 'Save result to file')
      .option('-v, --verbose', 'Verbose output')
      .option('--timeout <ms>', 'Timeout in milliseconds', '30000')
      .action(async (file: string, options: any) => {
        await this.execute(file, options);
      });
  }

  /**
   * Выполняет команду
   */
  async execute(file: string, options: any): Promise<void> {
    console.log('🔬 Formal verification...');
    console.log(`📄 File: ${file}`);
    console.log(`⏱️ Timeout: ${options.timeout}ms`);

    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${absolutePath}`);
      process.exit(1);
    }

    let contract: any = null;

    // Загружаем контракт из файла или извлекаем из функции
    if (options.contract) {
      contract = await this.loadContractFromFile(options.contract);
    } else if (options.function) {
      contract = await this.extractContractFromFunction(absolutePath, options.function);
    } else {
      console.error('❌ Please specify --function <name> or --contract <file>');
      process.exit(1);
    }

    if (!contract) {
      console.error('❌ Failed to load contract');
      process.exit(1);
    }

    // Выводим информацию о контракте
    this.printContractInfo(contract);

    // Запускаем верификацию
    const result = await this.runVerification(contract, parseInt(options.timeout));

    // Выводим результат
    this.printResult(result, contract.name);

    // Сохраняем результат
    if (options.output) {
      await this.saveResult(result, contract, options.output);
    }

    // Выходим с соответствующим кодом
    process.exit(result.isValid ? 0 : 1);
  }

  /**
   * Загружает контракт из JSON файла
   */
  private async loadContractFromFile(contractPath: string): Promise<any> {
    const absolutePath = path.resolve(contractPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ Contract not found: ${absolutePath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const contract = JSON.parse(content);

      // Валидация контракта
      if (!contract.name) {
        console.warn('⚠️ Contract missing "name" field');
      }
      if (!contract.params) {
        console.warn('⚠️ Contract missing "params" field');
      }
      if (!contract.returnType) {
        console.warn('⚠️ Contract missing "returnType" field');
      }

      console.log(`📋 Contract loaded: ${absolutePath}`);
      return contract;
    } catch (error) {
      console.error(`❌ Failed to parse contract: ${error}`);
      return null;
    }
  }

  /**
   * Извлекает контракт из функции в файле
   */
  private async extractContractFromFunction(filePath: string, functionName: string): Promise<any> {
    console.log(`📋 Extracting contract from function: ${functionName}`);

    const { Project } = await import('ts-morph');
    const { range } = await import('../../formal/Z3Verifier.js');

    const project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: false,
    });

    let sourceFile;
    try {
      sourceFile = project.addSourceFileAtPath(filePath);
    } catch (error) {
      console.error(`❌ Failed to parse file: ${error}`);
      return null;
    }

    const func = sourceFile.getFunction(functionName);
    if (!func) {
      console.error(`❌ Function '${functionName}' not found in ${filePath}`);
      return null;
    }

    // Извлекаем параметры
    const params = func.getParameters().map((p: any) => {
      const type = this.getParamType(p);
      return { name: p.getName(), type };
    });

    // Извлекаем тип возврата
    const returnType = func.getReturnType();
    let retType: 'int' | 'bool' | 'string' | 'void' = 'int';
    if (returnType.isBoolean()) retType = 'bool';
    else if (returnType.isString()) retType = 'string';
    else if (returnType.isVoid()) retType = 'void';

    // Извлекаем предусловия из JSDoc
    const preconditions: any[] = [];
    const jsDocs = func.getJsDocs();
    for (const jsDoc of jsDocs) {
      const tags = jsDoc.getTags();
      for (const tag of tags) {
        const tagName = tag.getTagName();
        const comment = tag.getCommentText();

        if (tagName === 'param' && comment) {
          const paramMatch = comment.match(/(\w+)\s*-\s*([^<]+)/);
          if (paramMatch) {
            const paramName = paramMatch[1];
            if (paramName) {
              if (comment.includes('positive') || comment.includes('>0')) {
                preconditions.push(range(paramName, 1, Number.MAX_SAFE_INTEGER));
              } else if (comment.includes('non-negative') || comment.includes('>=0')) {
                preconditions.push(range(paramName, 0, Number.MAX_SAFE_INTEGER));
              }
            }
          }
        }

        if (tagName === 'returns' && comment) {
          if (comment.includes('positive')) {
            preconditions.push(range('result', 1, Number.MAX_SAFE_INTEGER));
          }
        }
      }
    }

    // Добавляем диапазоны по умолчанию
    if (preconditions.length === 0) {
      for (const param of params) {
        preconditions.push(range(param.name, -1000, 1000));
      }
    }

    // Извлекаем тело функции для проверки
    let body: string | undefined;
    try {
      const bodyNode = func.getBody();
      if (bodyNode) {
        body = bodyNode.getText();
      }
    } catch {
      // Игнорируем ошибки получения тела
    }

    const contract = {
      name: functionName,
      params,
      returnType: retType,
      preconditions,
      postconditions: [],
      invariants: [],
      body,
    };

    console.log(`✅ Contract extracted from function: ${functionName}`);
    return contract;
  }

  /**
   * Определяет тип параметра
   */
  private getParamType(param: any): 'int' | 'bool' | 'string' {
    try {
      const type = param.getType();
      if (type.isNumber()) return 'int';
      if (type.isBoolean()) return 'bool';
      if (type.isString()) return 'string';
    } catch {
      // Игнорируем ошибки
    }
    return 'int';
  }

  /**
   * Выводит информацию о контракте
   */
  private printContractInfo(contract: any): void {
    console.log('\n📋 CONTRACT:');
    console.log(`   Function: ${contract.name}`);
    console.log(`   Params: ${contract.params.map((p: any) => `${p.name}:${p.type}`).join(', ')}`);
    console.log(`   Return: ${contract.returnType}`);
    console.log(`   Preconditions: ${contract.preconditions?.length || 0}`);
    console.log(`   Postconditions: ${contract.postconditions?.length || 0}`);
    console.log(`   Invariants: ${contract.invariants?.length || 0}`);
    if (contract.body) {
      console.log(
        `   Body: ${contract.body.substring(0, 100)}${contract.body.length > 100 ? '...' : ''}`
      );
    }
    console.log('');
  }

  /**
   * Запускает верификацию через Z3
   */
  private async runVerification(contract: any, timeout: number): Promise<any> {
    console.log('⏳ Running verification...');

    const { Z3Verifier } = await import('../../formal/Z3Verifier.js');
    const z3 = new Z3Verifier();

    // Устанавливаем таймаут
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Verification timed out after ${timeout}ms`)), timeout);
    });

    try {
      await z3.initialize();

      const result = await Promise.race([z3.verifyFunction(contract), timeoutPromise]);

      await z3.dispose();
      return result;
    } catch (error) {
      await z3.dispose();
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
        time: 0,
      };
    }
  }

  /**
   * Выводит результат верификации
   */
  private printResult(result: any, functionName: string): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION RESULT');
    console.log('='.repeat(60));

    if (result.isValid) {
      console.log(`✅ Function '${functionName}' VERIFIED!`);
      console.log(`   All contracts are satisfied`);
    } else {
      console.log(`❌ Function '${functionName}' NOT VERIFIED!`);
      if (result.counterexample) {
        console.log('\n🔍 Counterexample found:');
        for (const [key, value] of result.counterexample) {
          console.log(`   ${key} = ${value}`);
        }
      }
      if (result.error) {
        console.log(`\n⚠️ Error: ${result.error}`);
      }
    }

    console.log(`\n⏱️ Time: ${result.time || 0}ms`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Сохраняет результат в файл
   */
  private async saveResult(result: any, contract: any, outputPath: string): Promise<void> {
    const absolutePath = path.resolve(outputPath);
    const outputDir = path.dirname(absolutePath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      contract: {
        name: contract.name,
        params: contract.params,
        returnType: contract.returnType,
        preconditionsCount: contract.preconditions?.length || 0,
        postconditionsCount: contract.postconditions?.length || 0,
        invariantsCount: contract.invariants?.length || 0,
      },
      result: {
        isValid: result.isValid,
        counterexample: result.counterexample ? Object.fromEntries(result.counterexample) : null,
        error: result.error || null,
        time: result.time || 0,
      },
    };

    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2));
    console.log(`📄 Result saved: ${absolutePath}`);
  }

  /**
   * Получает экземпляр Command для регистрации
   */
  getCommand(): Command {
    return this.program;
  }
}

// Экспорт по умолчанию
export default VerifyCommand;
