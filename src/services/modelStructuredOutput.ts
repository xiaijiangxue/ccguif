export type ModelStructuredOutputParseKind = "no_json_object" | "invalid_json" | "schema_mismatch";

export class ModelStructuredOutputParseError extends Error {
  readonly kind: ModelStructuredOutputParseKind;

  constructor(kind: ModelStructuredOutputParseKind, message: string) {
    super(message);
    this.name = "ModelStructuredOutputParseError";
    this.kind = kind;
  }
}

export type ParseModelStructuredJsonObjectInput<T> = {
  text: string;
  validator: (value: unknown) => value is T;
  payloadDescription: string;
};

export function parseModelStructuredJsonObject<T>(input: ParseModelStructuredJsonObjectInput<T>): T {
  const candidates = extractJsonObjectCandidates(input.text);
  if (candidates.length === 0) {
    throw new ModelStructuredOutputParseError("no_json_object", "AI output did not contain a JSON object.");
  }

  let lastParseMessage = "Unable to parse JSON string";
  let sawParsableNonPayload = false;
  for (const objectText of candidates) {
    const strictResult = parseCandidate(objectText, input.validator);
    if (strictResult.status === "payload") {
      return strictResult.payload;
    }
    if (strictResult.status === "non_payload") {
      sawParsableNonPayload = true;
      continue;
    }
    lastParseMessage = strictResult.message;

    const repaired = repairLenientJsonObjectText(objectText);
    if (repaired === objectText) {
      continue;
    }
    const repairedResult = parseCandidate(repaired, input.validator);
    if (repairedResult.status === "payload") {
      return repairedResult.payload;
    }
    if (repairedResult.status === "non_payload") {
      sawParsableNonPayload = true;
      continue;
    }
    lastParseMessage = repairedResult.message;
  }

  if (sawParsableNonPayload) {
    throw new ModelStructuredOutputParseError(
      "schema_mismatch",
      `AI output did not contain a ${input.payloadDescription}.`,
    );
  }
  throw new ModelStructuredOutputParseError(
    "invalid_json",
    `AI output did not contain valid JSON. ${lastParseMessage}`,
  );
}

function parseCandidate<T>(
  objectText: string,
  validator: (value: unknown) => value is T,
): { status: "payload"; payload: T } | { status: "non_payload" } | { status: "invalid"; message: string } {
  try {
    const parsed = JSON.parse(objectText) as unknown;
    if (validator(parsed)) {
      return { status: "payload", payload: parsed };
    }
    return { status: "non_payload" };
  } catch (error) {
    return { status: "invalid", message: error instanceof Error ? error.message : String(error) };
  }
}

export function extractJsonObjectCandidates(text: string): string[] {
  const candidateTexts = [text, ...extractFencedBlockContents(text)];
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const candidateText of candidateTexts) {
    for (const objectText of scanBalancedJsonObjects(candidateText)) {
      const trimmed = objectText.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      candidates.push(trimmed);
      seen.add(trimmed);
    }
  }
  return candidates.sort((left, right) => right.length - left.length);
}

function extractFencedBlockContents(text: string): string[] {
  const blocks: string[] = [];
  const fencePattern = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null = fencePattern.exec(text);
  while (match) {
    if (match[1]?.trim()) {
      blocks.push(match[1]);
    }
    match = fencePattern.exec(text);
  }
  return blocks;
}

function scanBalancedJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      escaped = false;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(text.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

export function repairLenientJsonObjectText(text: string): string {
  return balanceJsonClosers(
    stripTrailingJsonCommas(
      quoteBareJsonStringValues(quoteBareJsonObjectKeys(removeJsonPlaceholderEllipsis(convertSingleQuotedJsonStrings(text)))),
    ),
  );
}

function removeJsonPlaceholderEllipsis(text: string): string {
  let result = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      const { value, endIndex } = readJsonStringLiteral(text, index);
      result += value;
      index = endIndex + 1;
      continue;
    }
    if (text.startsWith("...", index)) {
      index += 3;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

function convertSingleQuotedJsonStrings(text: string): string {
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== "'") {
      result += char;
      continue;
    }

    let value = "";
    let cursor = index + 1;
    while (cursor < text.length) {
      const current = text[cursor];
      if (current === "\\" && cursor + 1 < text.length) {
        value += text[cursor + 1];
        cursor += 2;
        continue;
      }
      if (current === "'") {
        break;
      }
      value += current;
      cursor += 1;
    }

    if (cursor < text.length && text[cursor] === "'") {
      result += JSON.stringify(value);
      index = cursor;
    } else {
      result += char;
    }
  }
  return result;
}

function quoteBareJsonObjectKeys(text: string): string {
  let result = "";
  let index = 0;
  let inString = false;
  let escaped = false;

  while (index < text.length) {
    const char = text[index];
    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      index += 1;
      continue;
    }
    if ((char === "{" || char === ",") && index + 1 < text.length) {
      result += char;
      let cursor = index + 1;
      while (/\s/.test(text[cursor] ?? "")) {
        result += text[cursor];
        cursor += 1;
      }
      if (isIdentifierStart(text[cursor] ?? "")) {
        let keyEnd = cursor + 1;
        while (isIdentifierPart(text[keyEnd] ?? "")) {
          keyEnd += 1;
        }
        let colonCursor = keyEnd;
        while (/\s/.test(text[colonCursor] ?? "")) {
          colonCursor += 1;
        }
        if (text[colonCursor] === ":") {
          result += JSON.stringify(text.slice(cursor, keyEnd));
          index = keyEnd;
          continue;
        }
      }
      index = cursor;
      continue;
    }
    result += char;
    index += 1;
  }

  return result;
}

function quoteBareJsonStringValues(text: string): string {
  let result = "";
  let index = 0;
  let inString = false;
  let escaped = false;

  while (index < text.length) {
    const char = text[index];
    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      index += 1;
      continue;
    }
    if ((char === ":" || char === "[") && index + 1 < text.length) {
      const quoted = quoteValueAfterJsonSeparator(text, index, char);
      result += quoted.value;
      index = quoted.endIndex;
      continue;
    }
    if (char === "," && isArrayItemSeparator(text, index + 1)) {
      const quoted = quoteValueAfterJsonSeparator(text, index, char);
      result += quoted.value;
      index = quoted.endIndex;
      continue;
    }
    result += char;
    index += 1;
  }

  return result;
}

function quoteValueAfterJsonSeparator(
  text: string,
  separatorIndex: number,
  separator: string,
): { value: string; endIndex: number } {
  let result = separator;
  let cursor = separatorIndex + 1;
  while (/\s/.test(text[cursor] ?? "")) {
    result += text[cursor];
    cursor += 1;
  }
  if (!shouldQuoteBareJsonValue(text, cursor, separator)) {
    return { value: result, endIndex: cursor };
  }
  const valueEnd = findBareJsonValueEnd(text, cursor);
  result += JSON.stringify(text.slice(cursor, valueEnd));
  return { value: result, endIndex: valueEnd };
}

function shouldQuoteBareJsonValue(text: string, valueStart: number, separator: string): boolean {
  const char = text[valueStart] ?? "";
  if (!char || char === '"' || char === "{" || char === "[" || char === "}" || char === "]" || char === ",") {
    return false;
  }
  if (separator === "," && !isArrayItemSeparator(text, valueStart)) {
    return false;
  }
  const valueEnd = findBareJsonValueEnd(text, valueStart);
  const value = text.slice(valueStart, valueEnd).trim();
  if (!value || value === "true" || value === "false" || value === "null") {
    return false;
  }
  return !/^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

function isArrayItemSeparator(text: string, valueStart: number): boolean {
  for (let cursor = valueStart - 2; cursor >= 0; cursor -= 1) {
    const char = text[cursor];
    if (/\s/.test(char)) {
      continue;
    }
    return char === "[" || char === ",";
  }
  return false;
}

function findBareJsonValueEnd(text: string, valueStart: number): number {
  let cursor = valueStart;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "," || char === "}" || char === "]" || char === "\n" || char === "\r") {
      break;
    }
    cursor += 1;
  }
  return cursor;
}

function readJsonStringLiteral(text: string, startIndex: number): { value: string; endIndex: number } {
  let result = '"';
  let escaped = false;
  for (let index = startIndex + 1; index < text.length; index += 1) {
    const char = text[index];
    result += char;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return { value: result, endIndex: index };
    }
  }
  return { value: result, endIndex: text.length - 1 };
}

function stripTrailingJsonCommas(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === ",") {
      let cursor = index + 1;
      while (/\s/.test(text[cursor] ?? "")) {
        cursor += 1;
      }
      if (text[cursor] === "}" || text[cursor] === "]") {
        continue;
      }
    }
    result += char;
  }
  return result;
}

function balanceJsonClosers(text: string): string {
  let result = "";
  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
      result += char;
      continue;
    }
    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      while (stack.length > 0 && stack[stack.length - 1] !== expected) {
        result += stack.pop() === "[" ? "]" : "}";
      }
      if (stack[stack.length - 1] === expected) {
        stack.pop();
      }
      result += char;
      continue;
    }
    result += char;
  }

  while (stack.length > 0) {
    result += stack.pop() === "[" ? "]" : "}";
  }
  return result;
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$-]/.test(char);
}
