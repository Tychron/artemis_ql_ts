/*
 * Artemis QL Client Library
 * This module provides the tokenizer and parsing functions from artemis_ql
 * (https://github.com/Tychron/artemis_ql)
 * By itself is not useful to you (the usual user), instead this library is intended to be used
 * to provide client-side parsing of search queries for features such as suggestions.
 */
export const VERSION = '2026.10.7';

export type CharTable = { [index: number]: boolean };

export type RangeValue = {
  // eslint-disable-next-line
  s: Token;
  // eslint-disable-next-line
  e: Token;
};
export type PairValue = {
  // eslint-disable-next-line
  key: Token | null;
  // eslint-disable-next-line
  value: Token | null;
};
export type CmpValue = {
  op: string;
  // eslint-disable-next-line
  value: Token | null;
};
export type BaseToken = {
  isError?: boolean;
  type: string;
  index: number;
  pos: number[],
  // eslint-disable-next-line
  value: null | number | string | boolean | CmpValue | RangeValue | PairValue | Token[];
};

export type WordToken = BaseToken & {
  type: 'word';
  value: string;
};

export type PinOpToken = BaseToken & {
  type: 'pin_op';
  value: boolean;
};
export type PinToken = BaseToken & {
  type: 'pin' | 'incomplete:pin';
  // eslint-disable-next-line
  value: Token[];
};
export type CmpOpToken = BaseToken & {
  type: 'cmp_op';
  value: string;
};
export type CmpToken = BaseToken & {
  type: 'cmp';
  value: CmpValue;
};
export type PairOpToken = BaseToken & {
  type: 'pair_op';
  // eslint-disable-next-line
  value: boolean;
};
export type PairToken = BaseToken & {
  type: 'pair' | 'incomplete:pair';
  value: PairValue;
};
export type RangeOpToken = BaseToken & {
  type: 'range_op';
  // eslint-disable-next-line
  value: boolean;
};
export type ContinuationOpToken = BaseToken & {
  type: 'continuation_op';
  // eslint-disable-next-line
  value: boolean;
};
export type RangeToken = BaseToken & {
  type: 'range';
  value: RangeValue;
};
export type SpaceToken = BaseToken & {
  type: 'space';
  value: string;
};
export type QuotedStringToken = BaseToken & {
  type: 'quoted_string' | 'incomplete:quoted_string';
  value: string;
};
export type PartialToken = BaseToken & {
  type: 'partial';
  // eslint-disable-next-line
  value: Token[];
};
export type InfinityToken = BaseToken & {
  type: 'infinity';
  value: number;
};
export type GroupToken = BaseToken & {
  type: 'group' | 'incomplete:group';
  // eslint-disable-next-line
  value: Token[];
};
export type ListToken = BaseToken & {
  type: 'list';
  // eslint-disable-next-line
  value: Token[];
};
export type WildcardToken = BaseToken & {
  type: 'wildcard' | 'any_char';
  // eslint-disable-next-line
  value: boolean;
};
export type AndToken = BaseToken & {
  type: 'and';
  value: boolean;
};
export type OrToken = BaseToken & {
  type: 'or';
  value: boolean;
};
export type NotToken = BaseToken & {
  type: 'not';
  value: boolean;
};
export type NullToken = BaseToken & {
  type: 'null';
  value: null;
};
export type Token =
  AndToken
  | OrToken
  | NotToken
  | NullToken
  | WildcardToken
  | PairOpToken
  | PairToken
  | PinOpToken
  | PinToken
  | CmpOpToken
  | CmpToken
  | RangeOpToken
  | RangeToken
  | ContinuationOpToken
  | QuotedStringToken
  | PartialToken
  | SpaceToken
  | InfinityToken
  | WordToken
  | GroupToken
  | ListToken;

function makeInfinityToken(): Token {
  return {
    type: 'infinity',
    index: -1,
    pos: [-1, -1],
    value: Infinity,
  };
}

export const SPACE_CHARS: CharTable = {
  0x09: true,
  0x0B: true,
  // Whitespace
  0x20: true,
  // No-Break Space
  0xA0: true,
  // Ogham Space Mark
  0x1680: true,
  // En Quad
  0x2000: true,
  // Em Quad
  0x2001: true,
  // En Space
  0x2002: true,
  // Em Space
  0x2003: true,
  // Three-Per-Em Space
  0x2004: true,
  // Four-Per-Em Space
  0x2005: true,
  // Six-Per-Em Space
  0x2006: true,
  // Figure Space
  0x2007: true,
  // Punctuation Space
  0x2008: true,
  // Thin Space
  0x2009: true,
  // Hair Space
  0x200A: true,
  // Narrow No-Break Space
  0x202F: true,
  // Medium Mathematical Space
  0x205F: true,
  // Ideographic Space
  0x3000: true,
};

export const NEWLINE_CHARS: CharTable = {
  // New Line
  0x0A: true,
  // NP form feed, new page
  0x0C: true,
  // Carriage Return
  0x0D: true,
  // Next-Line
  0x85: true,
  // Line Separator
  0x2028: true,
  // Paragraph Separator
  0x2029: true,
};

export const OPERATORS = {
  gte: '>=',
  lte: '<=',
  gt: '>',
  lt: '<',
  eq: '=',
  neq: '!',
  fuzz: '~',
  nfuzz: '!~',
};

export function isSpaceLikeChar(code: number): boolean {
  return !!SPACE_CHARS[code];
}

export function isNewlineLikeChar(code: number): boolean {
  return !!NEWLINE_CHARS[code];
}

export function splitSpaces(str: string, i: number) {
  const l = str.length;
  let i2 = i;

  let c: number;

  while (i2 < l) {
    c = str.charCodeAt(i2);
    if (isSpaceLikeChar(c) || isNewlineLikeChar(c)) {
      i2 += 1;
    } else {
      break;
    }
  }

  const spaces = str.slice(i, i2);

  return {
    i,
    i2,
    value: spaces,
  };
}

const tmp: { [char: string]: number } = {};
for (let i = 32; i <= 126; i += 1) {
  tmp[String.fromCharCode(i)] = i;
}
export const CHAR_TABLE = tmp;

export function readUntilCharCode(str: string, i: number, expected: number) {
  const l = str.length;
  let i2 = i;

  let c: number;
  let ok: boolean = false;
  while (i2 < l) {
    c = str.charCodeAt(i2);
    if (c === expected) {
      ok = true;
      break;
    }
    i2 += 1;
  }

  if (ok) {
    const value = str.slice(i, i2);
    return {
      i,
      i2,
      value,
    };
  }

  throw new Error('read until end, but didn\'t find expected character');
}

// These are the server tokenizer's exact ranges, not a Unicode letter category.
export function isWordChar(c: number): boolean {
  return [0x40, 0x2D, 0x2B, 0x5F, 0x2E, 0x2F].includes(c)
    || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)
    || (c >= 0x30 && c <= 0x39)
    || (c >= 0x00C0 && c < 0x00D7) || (c >= 0x00D8 && c < 0x00F7)
    || (c >= 0x00F8 && c < 0x0100) || (c >= 0x0180 && c < 0x01C0)
    || (c >= 0x01C4 && c < 0x02B9) || (c >= 0x0370 && c < 0x0374)
    || (c >= 0x0376 && c < 0x0378) || (c >= 0x037B && c < 0x037E)
    || c === 0x037F || c === 0x0386 || (c >= 0x0388 && c < 0x0483)
    || (c >= 0x048A && c < 0x0530) || (c >= 0x0531 && c < 0xD7FF)
    || (c >= 0xE000 && c <= 0x10FFFF);
}

function isScalar(c: number): boolean {
  return (c >= 0 && c <= 0xD7FF) || (c >= 0xE000 && c <= 0x10FFFF);
}

export function parseQuotedString(str: string, i: number) {
  if (str[i] !== '"') {
    throw new Error(`Expected quotation mark, got ${str[i]}`);
  }
  const result: string[] = [];
  const escapes: { [key: string]: string } = {
    '\\': '\\', '"': '"', '0': '\0', b: '\b', f: '\f', n: '\n',
    r: '\r', s: ' ', t: '\t', v: '\v',
  };
  let i2 = i + 1;
  let closed = false;
  let isError = false;
  while (i2 < str.length) {
    if (str[i2] === '"') {
      closed = true;
      i2 += 1;
      break;
    }
    if (str[i2] === '\\') {
      const start = i2;
      i2 += 1;
      const escaped = str[i2];
      if (escaped === 'u') {
        i2 += 1;
        const braced = str[i2] === '{';
        if (braced) i2 += 1;
        const hexStart = i2;
        // Stop before a quote or non-hex character: malformed escapes must
        // never swallow the closing quote or a subsequent query term.
        while (i2 < str.length && /[0-9a-f]/i.test(str[i2])
          && (braced || i2 - hexStart < 4)) i2 += 1;
        const hex = str.slice(hexStart, i2);
        const complete = braced ? str[i2] === '}' : hex.length === 4;
        if (braced && str[i2] === '}') i2 += 1;
        const code = Number.parseInt(hex, 16);
        if (complete && hex.length > 0 && isScalar(code)) {
          result.push(String.fromCodePoint(code));
        } else {
          isError = true;
          result.push(str.slice(start, i2));
        }
      } else if (Object.prototype.hasOwnProperty.call(escapes, escaped)) {
        result.push(escapes[escaped]);
        i2 += 1;
      } else {
        isError = true;
        if (i2 < str.length) i2 += 1;
        result.push(str.slice(start, i2));
      }
    } else {
      const code = str.codePointAt(i2)!;
      const width = code > 0xFFFF ? 2 : 1;
      if (code < 0x20 || code === 0x7F || !isScalar(code)) isError = true;
      result.push(str.slice(i2, i2 + width));
      i2 += width;
    }
  }
  // The UI keeps unfinished input for suggestions. A closed invalid quote
  // follows the server's error policy; search consumers retain the raw query
  // through their existing parse-error fallback instead of rewriting it.
  if (closed && isError) throw new SyntaxError(`Invalid quoted string at ${i}`);
  return { closed, isError, i, i2, value: result.join('') };
}

export function tokenize(str: string, i: number = 0) {
  const l = str.length;
  let i2 = i;

  const result: Token[] = [];

  let c: number;
  let c2: number;

  while (i2 < l) {
    c = str.charCodeAt(i2);
    c2 = str.charCodeAt(i2 + 1);

    if (isSpaceLikeChar(c) || isNewlineLikeChar(c)) {
      const {
        i2: i3,
        value,
      } = splitSpaces(str, i2);

      result.push({
        type: 'space',
        index: i2,
        pos: [i2, i3],
        value,
      });
      i2 = i3;
    } else if (c === CHAR_TABLE['"']) {
      const {
        closed,
        isError,
        i2: i3,
        value,
      } = parseQuotedString(str, i2);

      result.push({
        type: closed ? 'quoted_string' : 'incomplete:quoted_string',
        ...(isError ? { isError: true } : {}),
        index: i2,
        pos: [i2, i3],
        value,
      });
      i2 = i3;
    } else if (c === CHAR_TABLE['^']) {
      result.push({
        type: 'pin_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['>'] && c2 === CHAR_TABLE['=']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 2],
        value: 'gte',
      });
      i2 += 2;
    } else if (c === CHAR_TABLE['<'] && c2 === CHAR_TABLE['=']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 2],
        value: 'lte',
      });
      i2 += 2;
    } else if (c === CHAR_TABLE['!'] && c2 === CHAR_TABLE['~']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 2],
        value: 'nfuzz',
      });
      i2 += 2;
    } else if (c === CHAR_TABLE['>']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: 'gt',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['<']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: 'lt',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['!']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: 'neq',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['=']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: 'eq',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['~']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: 'fuzz',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['(']) {
      // Group
      const {
        i2: i3,
        value,
      } = tokenize(str, i2 + 1);

      c = str.charCodeAt(i3);
      const isClosed = c === CHAR_TABLE[')'];
      const end = isClosed ? i3 + 1 : i3;
      result.push({
        type: isClosed ? 'group' : 'incomplete:group',
        index: i2,
        pos: [i2, end],
        value,
      });
      i2 = end;
    } else if (c === CHAR_TABLE[')']) {
      break;
    } else if (c === CHAR_TABLE['*']) {
      result.push({
        type: 'wildcard',
        index: i2,
        pos: [i2, i2 + 1],
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['?']) {
      result.push({
        type: 'any_char',
        index: i2,
        pos: [i2, i2 + 1],
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE[':']) {
      result.push({
        type: 'pair_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['.'] && c2 === CHAR_TABLE['.']) {
      result.push({
        type: 'range_op',
        index: i2,
        pos: [i2, i2 + 2],
        value: true,
      });
      i2 += 2;
    } else if (c === CHAR_TABLE[',']) {
      result.push({
        type: 'continuation_op',
        index: i2,
        pos: [i2, i2 + 1],
        value: true,
      });
      i2 += 1;
    } else {
      const start = i2;
      while (i2 < l && str.slice(i2, i2 + 2) !== '..') {
        const code = str.codePointAt(i2)!;
        if (!isWordChar(code)) break;
        i2 += code > 0xFFFF ? 2 : 1;
      }
      if (i2 === start) break;
      result.push({ type: 'word', index: start, pos: [start, i2], value: str.slice(start, i2) });
    }
  }

  return {
    i,
    i2,
    value: result,
  };
}

export function parseTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];

  const l = tokens.length;
  let i = 0;

  let subjectToken: Token;
  let nextToken: Token;

  while (i < l) {
    subjectToken = tokens[i];
    nextToken = tokens[i + 1];
    switch (subjectToken.type) {
      case 'pin_op':
        if (nextToken) {
          if (nextToken.type === 'word' || nextToken.type === 'quoted_string') {
            result.push({
              ...subjectToken,
              type: 'pin',
              pos: [subjectToken.pos[0], nextToken.pos[1]],
              value: [nextToken],
            });
            i += 2;
          } else {
            result.push({
              ...subjectToken,
              isError: true,
              type: 'pin',
              value: [],
            });
            i += 1;
          }
        } else {
          result.push({
            ...subjectToken,
            type: 'incomplete:pin',
            value: [],
          });
          i += 1;
        }
        break;
      case 'word':
        switch ((subjectToken.value as string).toUpperCase()) {
          case 'AND':
            result.push({
              ...subjectToken,
              type: 'and',
              value: true,
            });
            i += 1;
            break;
          case 'OR':
            result.push({
              ...subjectToken,
              type: 'or',
              value: true,
            });
            i += 1;
            break;
          case 'NOT':
            result.push({
              ...subjectToken,
              type: 'not',
              value: true,
            });
            i += 1;
            break;
          case 'NULL':
            result.push({
              ...subjectToken,
              type: 'null',
              value: null,
            });
            i += 1;
            break;
          default:
            result.push(subjectToken);
            i += 1;
            break;
        }
        break;
      case 'incomplete:group':
      case 'group':
        result.push({
          ...subjectToken,
          value: parseTokens(subjectToken.value as Token[]),
        });
        i += 1;
        break;
      default:
        result.push(subjectToken);
        i += 1;
        break;
    }
  }

  return result;
}

type DecodeTokenResult = {
  i2: number,
  tokens: Token[],
};

// let decodeToken: (tokens: Token[], i: number) => DecodeTokenResult;

export function decodeTokenAsValue(tokens: Token[], i: number) {
  const acc: Token[] = [];
  const l = tokens.length;
  let i2 = i;

  let subjectToken: Token;
  let noMoreValues: boolean = false;
  while (i2 < l) {
    subjectToken = tokens[i2];
    switch (subjectToken.type) {
      case 'word':
      case 'quoted_string':
      case 'incomplete:quoted_string':
      case 'null':
      case 'range':
      case 'cmp':
      case 'pin':
      case 'wildcard':
      case 'any_char':
        acc.push(subjectToken);
        i2 += 1;
        break;
      case 'incomplete:group':
      case 'group': {
        const {
          tokens: newTokens,
        // eslint-disable-next-line
        } = decodeToken([subjectToken], 0);
        newTokens.forEach((newToken) => {
          acc.push(newToken);
        });
        i2 += 1;
      } break;
      default:
        noMoreValues = true;
        break;
    }
    if (noMoreValues) {
      break;
    }
  }

  const result: Token[] = [];

  if (acc.length === 1) {
    result.push(acc[0]);
  } else if (acc.length > 1) {
    const first = acc[0];
    const last = acc[acc.length - 1];
    result.push({
      type: 'partial',
      index: first.index,
      pos: [first.pos[0], last.pos[1]],
      value: acc,
    });
  }

  return {
    i2,
    tokens: result,
  };
}

function decodeComparison(tokens: Token[], i: number): DecodeTokenResult {
  const parent = tokens[i];
  const decoded = decodeTokenAsValue(tokens, i + 1);
  const value = decoded.tokens[0] || null;
  return {
    i2: decoded.i2,
    tokens: [{ type: 'cmp', index: parent.index,
      pos: [parent.pos[0], value ? value.pos[1] : parent.pos[1]],
      value: { op: String(parent.value), value } }],
  };
}

export function decodeTokensAsValueList(tokens: Token[], i: number) {
  const result: Token[] = [];
  const l = tokens.length;
  let i2 = i;
  let token: Token;

  while (i2 < l) {
    const {
      i2: i3,
      tokens: valueTokens,
    } = tokens[i2].type === 'cmp_op'
      ? decodeComparison(tokens, i2)
      : decodeTokenAsValue(tokens, i2);
    i2 = i3;

    if (valueTokens.length > 0) {
      result.push(valueTokens[0]);
    }
    token = tokens[i2];

    if (!token) {
      break;
    }

    if (token.type === 'space') {
      break;
    }

    if (token.type === 'continuation_op') {
      // keep going!
      i2 += 1;
    } else {
      // Invalid list continuation; stop list decoding and let outer parser continue.
      break;
    }
  }

  return {
    i2,
    tokens: result,
  };
}

function decodeTokenPair(parent: Token, key: Token | null, tokens: Token[], i: number) {
  const {
    i2,
    tokens: valueTokens,
  // eslint-disable-next-line
  } = decodeToken(tokens, i);

  let value = null;

  if (valueTokens.length > 0) {
    // eslint-disable-next-line
    value = valueTokens[0];
  }

  const s = key ? key.pos[0] : parent.pos[0];
  const e = value ? value.pos[1] : parent.pos[1];
  const token: PairToken = {
    type: (key && value) ? 'pair' : 'incomplete:pair',
    index: key ? key.index : parent.index,
    pos: [s, e],
    value: {
      key,
      value,
    } as PairValue,
  };

  return {
    i2,
    tokens: [token],
  };
}

interface DecodeTokenOtherResult {
  i2: number;
  isLast: boolean;
  tokens: Token[];
}

function decodeTokenOther(tokens: Token[], i: number): DecodeTokenOtherResult {
  const {
    i2: i3,
    tokens: valueTokens,
  } = decodeTokenAsValue(tokens, i);

  if (valueTokens.length < 1) {
    return {
      isLast: false,
      i2: i3,
      tokens: [],
    };
  }

  let i2 = i3;
  const valueToken = valueTokens[0];
  const { index } = valueToken;
  let nextToken = tokens[i2];

  if (nextToken) {
    switch (nextToken.type) {
      case 'range_op': {
        i2 += 1;
        nextToken = tokens[i2];
        let e = makeInfinityToken();
        if (nextToken && nextToken.type !== 'space') {
          const {
            i2: i4,
            tokens: rightValueTokens,
          } = decodeTokenAsValue(tokens, i2);
          i2 = i4;
          // eslint-disable-next-line
          e = rightValueTokens[0] || makeInfinityToken();
        }
        const pos = [valueToken.pos[0], tokens[i2 - 1].pos[1]];

        return {
          isLast: false,
          i2,
          tokens: [
            {
              type: 'range',
              index,
              pos,
              value: {
                s: valueToken,
                e,
              },
            },
          ],
        };
      }
      case 'continuation_op': {
        const {
          i2: i4,
          tokens: listTokens,
        } = decodeTokensAsValueList(tokens, i);
        i2 = i4;
        const pos = [tokens[i].pos[0], tokens[i2 - 1].pos[1]];
        return {
          isLast: false,
          i2,
          tokens: [
            {
              type: 'list',
              index,
              pos,
              value: listTokens,
            },
          ],
        };
      }
      default:
        return {
          isLast: false,
          i2,
          tokens: valueTokens,
        };
    }
  } else {
    return {
      isLast: true,
      i2,
      tokens: valueTokens,
    };
  }
}

export function decodeToken(tokens: Token[], i: number): DecodeTokenResult {
  const subjectToken = tokens[i];
  const nextToken = tokens[i + 1];

  if (!subjectToken) {
    return {
      i2: i,
      tokens: [],
    };
  }

  switch (subjectToken.type) {
    case 'or':
    case 'and':
    case 'not':
      return {
        i2: i + 1,
        tokens: [subjectToken],
      };
    case 'incomplete:group':
    case 'group': {
      // Groups and incomplete groups are decoded in the same way, decode all of their children
      const {
        value: decodedTokens,
      // eslint-disable-next-line
      } = decodeTokens(subjectToken.value as Token[]);

      return {
        i2: i + 1,
        tokens: [
          {
            ...subjectToken,
            value: decodedTokens,
          },
        ],
      };
    }
    case 'incomplete:pin': {
      return {
        i2: i + 1,
        tokens: [
          {
            ...subjectToken,
            isError: true,
          },
        ],
      };
    }
    case 'cmp_op': {
      const decoded = decodeComparison(tokens, i);
      if (tokens[decoded.i2]?.type !== 'continuation_op') return decoded;
      const list = decodeTokensAsValueList(tokens, i);
      return {
        i2: list.i2,
        tokens: [{ type: 'list', index: subjectToken.index,
          pos: [subjectToken.pos[0], tokens[list.i2 - 1].pos[1]], value: list.tokens }],
      };
    }
    case 'range_op': {
      if (nextToken && nextToken.type !== 'space') {
        const {
          i2,
          tokens: valueTokens,
        } = decodeTokenAsValue(tokens, i + 1);

        const s = makeInfinityToken();
        const e = valueTokens[0] || makeInfinityToken();
        return {
          i2,
          tokens: [
            {
              type: 'range',
              index: subjectToken.index,
              pos: [subjectToken.pos[0], tokens[i2 - 1].pos[1]],
              value: {
                s,
                e,
              } as RangeValue,
            },
          ],
        };
      }

      const i2 = i + 1;
      return {
        i2,
        tokens: [
          {
            type: 'range',
            index: subjectToken.index,
            pos: [...subjectToken.pos],
            value: {
              s: makeInfinityToken(),
              e: makeInfinityToken(),
            } as RangeValue,
          },
        ],
      };
    }
    case 'quoted_string':
    case 'incomplete:quoted_string':
    case 'word':
      if (nextToken && nextToken.type === 'pair_op') {
        return decodeTokenPair(nextToken, subjectToken, tokens, i + 2);
      }
      return decodeTokenOther(tokens, i);
    case 'pair_op':
      return decodeTokenPair(subjectToken, null, tokens, i + 1);
    case 'continuation_op': {
      const {
        i2,
        tokens: listTokens,
      } = decodeTokensAsValueList(tokens, i);

      return {
        i2,
        tokens: [
          {
            index: subjectToken.index,
            type: 'list',
            pos: [subjectToken.pos[0], tokens[i2 - 1].pos[1]],
            value: listTokens,
          },
        ],
      };
    }
    default: {
      return decodeTokenOther(tokens, i);
    }
  }
}

export function decodeTokens(tokens: Token[]) {
  const result: Token[] = [];
  const l = tokens.length;
  let i2 = 0;

  let subjectToken: Token;
  while (i2 < l) {
    subjectToken = tokens[i2];

    if (subjectToken.type === 'space') {
      i2 += 1;
    } else {
      const {
        i2: i3,
        tokens: newTokens,
      } = decodeToken(tokens, i2);

      if (newTokens.length > 0 && i3 > i2) {
        newTokens.forEach((newToken) => {
          result.push(newToken);
        });
        i2 = i3;
      } else {
        throw new Error(`nothing to decode, but there are still tokens left (next-token: ${subjectToken.type})`);
      }
    }
  }

  return {
    i2,
    value: result,
  };
}

export function parse(str: string) {
  const {
    i,
    i2,
    value,
  } = tokenize(str);

  const parsedTokens = parseTokens(value);

  const {
    i2: decodeI2,
    value: decodedTokens,
  } = decodeTokens(parsedTokens);

  return {
    tokenize: {
      i,
      i2,
      value,
    },
    decode: {
      i,
      i2: decodeI2,
      value: decodedTokens,
    },
    value: decodedTokens,
  };
}

export default {
  OPERATORS,
  tokenize,
  parse,
};
/**
 * * Date 2025-07-22
 *   * Broke down Token types
 *   * Added pos attribute to Token, it contains the start and end values
 */
