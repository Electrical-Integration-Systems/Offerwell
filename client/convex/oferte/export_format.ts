export const CURRENT_EXPORT_FORMAT = 3;

export function isCurrentExcelOutput(output?: { formatVersion?: number }) {
  return output?.formatVersion === CURRENT_EXPORT_FORMAT;
}
