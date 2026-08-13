export function normalizeGeneratedFileText(value) {
  return value.replace(/\r\n/g, "\n");
}

export function isGeneratedFileCurrent(current, generated) {
  return normalizeGeneratedFileText(current) === normalizeGeneratedFileText(generated);
}
