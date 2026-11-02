import { translate } from '@/lib/i18n';

/** A failure to fetch the spreadsheet chunk means the page is stale, not broken. */
export class ExcelEngineLoadError extends Error {
  constructor(cause: unknown) {
    super(translate('xls.staleReload'));
    this.name = 'ExcelEngineLoadError';
    this.cause = cause;
  }
}

export async function loadWriter() {
  try {
    return (await import('write-excel-file/browser')).default;
  } catch (error) {
    throw new ExcelEngineLoadError(error);
  }
}

export async function loadReader() {
  try {
    return (await import('read-excel-file/browser')).readSheet;
  } catch (error) {
    throw new ExcelEngineLoadError(error);
  }
}
