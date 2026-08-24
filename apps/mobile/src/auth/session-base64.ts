const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function decodeBase64(value: string): Uint8Array {
  if (value.length === 0) return new Uint8Array();
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("invalid_base64");
  }

  const firstPadding = value.indexOf("=");
  if (firstPadding !== -1 && firstPadding < value.length - 2) {
    throw new Error("invalid_base64");
  }

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;

  for (let inputIndex = 0; inputIndex < value.length; inputIndex += 4) {
    const a = base64Value(value[inputIndex]);
    const b = base64Value(value[inputIndex + 1]);
    const c = value[inputIndex + 2] === "=" ? 0 : base64Value(value[inputIndex + 2]);
    const d = value[inputIndex + 3] === "=" ? 0 : base64Value(value[inputIndex + 3]);
    const combined = (a << 18) | (b << 12) | (c << 6) | d;

    if (outputIndex < output.length) output[outputIndex++] = combined >> 16;
    if (outputIndex < output.length) output[outputIndex++] = (combined >> 8) & 0xff;
    if (outputIndex < output.length) output[outputIndex++] = combined & 0xff;
  }

  return output;
}

function base64Value(character: string) {
  const value = base64Alphabet.indexOf(character);
  if (value === -1) throw new Error("invalid_base64");
  return value;
}
