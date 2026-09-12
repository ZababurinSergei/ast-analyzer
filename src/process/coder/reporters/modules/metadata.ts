// src/reporters/modules/metadata.ts
// Метаданные отчета

export interface ReportMetadata {
  name: string;
  version: string;
  lockfileVersion: number;
  timestamp: string;
}

export function createMetadata(): ReportMetadata {
  return {
    name: 'ast-analyzer',
    version: '3.0.0',
    lockfileVersion: 3,
    timestamp: new Date().toISOString(),
  };
}

export function getReportName(): string {
  return 'ast-analyzer';
}

export function getReportVersion(): string {
  return '3.0.0';
}

export function getLockfileVersion(): number {
  return 3;
}

export function getDefaultTimestamp(): string {
  return new Date().toISOString();
}

export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function getReportMetadata(
  customName?: string,
  customVersion?: string,
  customLockfileVersion?: number
): ReportMetadata {
  return {
    name: customName || getReportName(),
    version: customVersion || getReportVersion(),
    lockfileVersion: customLockfileVersion || getLockfileVersion(),
    timestamp: getDefaultTimestamp(),
  };
}

export default {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
  getDefaultTimestamp,
  formatTimestamp,
  getReportMetadata,
};
