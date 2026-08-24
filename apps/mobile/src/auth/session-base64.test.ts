import { decodeBase64 } from "./session-base64";

describe("decodeBase64", () => {
  it.each([
    ["", []],
    ["Zg==", [102]],
    ["Zm8=", [102, 111]],
    ["Zm9v", [102, 111, 111]],
    ["AAECA/7/", [0, 1, 2, 3, 254, 255]],
  ])("decodes %s", (encoded, expected) => {
    expect([...decodeBase64(encoded as string)]).toEqual(expected);
  });

  it.each(["A", "A===", "AA=A", "AA?="])("rejects malformed input %s", (value) => {
    expect(() => decodeBase64(value)).toThrow("invalid_base64");
  });
});
