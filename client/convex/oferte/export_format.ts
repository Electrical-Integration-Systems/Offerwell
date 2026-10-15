export const CURRENT_EXPORT_FORMAT = 2;

export function isCurrentExcelOutput(output?: { formatVersion?: number }) {
  return output?.formatVersion === CURRENT_EXPORT_FORMAT;
}
