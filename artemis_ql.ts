/**
 * Artemis QL Client Library
 *
 * This module provides the tokenizer and parsing functions from artemis_ql
 * (https://github.com/Tychron/artemis_ql)
 * By itself is not useful to you (the usual user), instead this library is intended to be used
 * to provide client-side parsing of search queries for features such as suggestions.
 */
type CharTable = { [index: number]: boolean };

type RangeValue = {
  // eslint-disable-next-line
  s: Token,
  // eslint-disable-next-line
  e: Token,
};
type PairValue = {
  // eslint-disable-next-line
  key: Token,
  // eslint-disable-next-line
  value: Token,
};
type CmpValue = {
  op: string,
  // eslint-disable-next-line
  value: Token,
};
type Token = {
  isError?: boolean,
  type: string,
  index: number,
  value: null | number | string | boolean | CmpValue | RangeValue | PairValue | Token[],
};

function makeInfinityToken(): Token {
  return {
    type: 'infinity',
    index: 0,
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
    const value = str.slice(i, i2 - 1);
    return {
      i,
      i2,
      value,
    };
  }

  throw new Error('read until end, but didn\'t find expected character');
}

export function parseQuotedString(str: string, i: number) {
  const l = str.length;
  let i2 = i;

  let c: number;

  c = str.charCodeAt(i2);

  if (c !== CHAR_TABLE['"']) {
    throw new Error(`Expected quotation mark, got ${str[i2]}`);
  }

  const result = [];

  let closed: boolean = false;

  i2 += 1;
  while (i2 < l) {
    c = str.charCodeAt(i2);

    if (c === CHAR_TABLE['"']) {
      // closing quote
      closed = true;
      i2 += 1;
      break;
    } else if (c === CHAR_TABLE['\\']) {
      // escape sequence
      i2 += 1;
      c = str.charCodeAt(i2);
      if (c === CHAR_TABLE.u) {
        // unicode sequence
        i2 += 1;
        c = str.charCodeAt(i2);
        if (c === CHAR_TABLE['{']) {
          const {
            i2: i3,
            value,
          } = readUntilCharCode(str, i2 + 1, CHAR_TABLE['}']);
          const code = parseInt(value, 16);
          result.push(String.fromCharCode(code));
          i2 = i3;
        } else {
          const hexcode = str.slice(i2, i2 + 4);
          const code = parseInt(hexcode, 16);
          result.push(String.fromCharCode(code));
          i2 += 6;
        }
      } else if (c === CHAR_TABLE['\\']) {
        result.push('\\');
      } else if (c === CHAR_TABLE['"']) {
        result.push('"');
      } else if (c === CHAR_TABLE['0']) {
        result.push('\0');
      } else if (c === CHAR_TABLE.a) {
        result.push('\a');
      } else if (c === CHAR_TABLE.b) {
        result.push('\b');
      } else if (c === CHAR_TABLE.f) {
        result.push('\f');
      } else if (c === CHAR_TABLE.n) {
        result.push('\n');
      } else if (c === CHAR_TABLE.r) {
        result.push('\r');
      } else if (c === CHAR_TABLE.s) {
        result.push(' ');
      } else if (c === CHAR_TABLE.t) {
        result.push('\t');
      } else if (c === CHAR_TABLE.v) {
        result.push('\v');
      }
    } else {
      result.push(str[i2]);
      i2 += 1;
    }
  }

  const value = result.join('');

  return {
    closed,
    i,
    i2,
    value,
  };
}

type TokenizeResult = {
  i: number;
  i2: number;
  value: Token[];
};

/**
 *
 * Args:
 * * `str` [String] the string to tokenize.
 * * `i` [String] the position to start tokenizing from
 *
 * Return:
 * * `result` [Object]
 *   * `i` [Number] the start position of the tokenizer
 *   * `i2` [Number] the final position of the tokenizer
 *   * `value` [Array<Token>] the list of tokens
 */
export function tokenize(str: string, i: number = 0): TokenizeResult {
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
        value,
      });
      i2 = i3;
    } else if (c === CHAR_TABLE['"']) {
      const {
        closed,
        i2: i3,
        value,
      } = parseQuotedString(str, i2);

      result.push({
        type: closed ? 'quoted_string' : 'incomplete:quoted_string',
        index: i2,
        value,
      });
      i2 = i3;
    } else if (c === CHAR_TABLE['^']) {
      result.push({
        type: 'pin_op',
        index: i2,
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['>'] && c2 === CHAR_TABLE['=']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'gte',
      });
      i2 += 2;
    } else if (c === CHAR_TABLE['<'] && c2 === CHAR_TABLE['=']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'lte',
      });
      i2 += 2;
    } else if (c === CHAR_TABLE['!'] && c2 === CHAR_TABLE['~']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'nfuzz',
      });
      i2 += 2;
    } else if (c === CHAR_TABLE['>']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'gt',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['<']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'lt',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['!']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'neq',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['=']) {
      result.push({
        type: 'cmp_op',
        index: i2,
        value: 'eq',
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['~']) {
      result.push({
        type: 'cmp_op',
        index: i2,
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
      result.push({
        type: isClosed ? 'group' : 'incomplete:group',
        index: i2,
        value,
      });
      i2 = i3 + 1;
    } else if (c === CHAR_TABLE[')']) {
      break;
    } else if (c === CHAR_TABLE['*']) {
      result.push({
        type: 'wildcard',
        index: i2,
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['?']) {
      result.push({
        type: 'any_char',
        index: i2,
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE[':']) {
      result.push({
        type: 'pair_op',
        index: i2,
        value: true,
      });
      i2 += 1;
    } else if (c === CHAR_TABLE['.'] && c2 === CHAR_TABLE['.']) {
      result.push({
        type: 'range_op',
        index: i2,
        value: true,
      });
      i2 += 2;
    } else if (c === CHAR_TABLE[',']) {
      result.push({
        type: 'continuation_op',
        index: i2,
        value: true,
      });
      i2 += 1;
    } else {
      const parts = str.substr(i2).split(/^([@\w_-]+)/);
      if (parts.length > 1) {
        const value = parts[1];
        result.push({
          type: 'word',
          index: i2,
          value,
        });

        i2 += value.length;
      } else {
        break;
      }
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
              value: [nextToken],
            });
            i += 2;
          } else {
            result.push({
              ...subjectToken,
              isError: true,
              type: 'incomplete:pin',
              value: null,
            });
            i += 1;
          }
        } else {
          result.push({
            ...subjectToken,
            type: 'incomplete:pin',
            value: null,
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

/**
 * Determines if a specified token is embeddable in a partial token.
 * Partials will only contain `word`, `quoted_string`, `wildcard` or `any_char` tokens.
 *
 * Args:
 * * `token` [Token] the token to test.
 *
 * Return:
 * * `result` [Boolean] true if the token is compatible with a partial token, false otherwise.
 */
function isPartialCompatible(token: Token): boolean {
  switch (token.type) {
    case 'word':
    case 'quoted_string':
    case 'wildcard':
    case 'any_char':
      return true;
    default:
      return false;
  }
}

export function decodeTokenAsValue(tokens: Token[], i: number) {
  const acc: Token[] = [];
  const l = tokens.length;
  let i2 = i;

  let subjectToken: Token;
  let nextToken: Token;
  let noMoreValues: boolean = false;
  let isPartialContent: boolean = false;

  while (i2 < l) {
    subjectToken = tokens[i2];
    nextToken = tokens[i2 + 1];
    switch (subjectToken.type) {
      case 'null':
      case 'range':
      case 'cmp':
      case 'pin':
      case 'incomplete:pin':
        noMoreValues = true;
        if (!isPartialContent) {
          acc.push(subjectToken);
          i2 += 1;
        }
        break;

      case 'word':
      case 'quoted_string':
      case 'wildcard':
      case 'any_char':
        isPartialContent = true;
        if (nextToken) {
          noMoreValues = !isPartialCompatible(nextToken);
        } else {
          noMoreValues = true;
        }
        acc.push(subjectToken);
        i2 += 1;
        break;

      case 'group': {
        const {
          tokens: newTokens,
        // eslint-disable-next-line
        } = decodeToken([subjectToken], 0);
        newTokens.forEach((newToken) => {
          acc.push(newToken);
        });
        i2 += 1;
        noMoreValues = true;
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

  if (acc.length === 0) {
    // Nothing
  } else if (acc.length === 1) {
    result.push(acc[0]);
  } else if (isPartialContent && acc.length > 1) {
    result.push({
      type: 'partial',
      index: acc[0].index,
      value: acc,
    });
  } else {
    throw new Error('unexpected end of values');
  }

  return {
    i2,
    tokens: result,
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
    } = decodeTokenAsValue(tokens, i2);
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
      throw new Error(`list must be terminated by space or eos (got ${token.type})`);
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

  return {
    i2,
    tokens: [
      {
        type: (key && value) ? 'pair' : 'incomplete:pair',
        index: parent.index,
        value: {
          key,
          value,
        } as PairValue,
      },
    ],
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
          e = rightValueTokens[0];
        }
        return {
          isLast: false,
          i2,
          tokens: [
            {
              type: 'range',
              index,
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
        return {
          isLast: false,
          i2,
          tokens: [
            {
              type: 'list',
              index,
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
    case 'cmp_op': {
      // Comparison operators appear before a 'value' token
      const {
        i2,
        tokens: valueTokens,
      } = decodeTokenAsValue(tokens, i + 1);

      return {
        i2,
        tokens: [
          {
            type: 'cmp',
            index: subjectToken.index,
            value: {
              op: subjectToken.value,
              value: valueTokens[0],
            } as CmpValue,
          },
        ],
      };
    }
    case 'range_op': {
      if (nextToken && nextToken.type !== 'space') {
        const {
          i2,
          tokens: valueTokens,
        } = decodeTokenAsValue(tokens, i + 1);

        return {
          i2,
          tokens: [
            {
              type: 'range',
              index: subjectToken.index,
              value: {
                s: makeInfinityToken(),
                e: valueTokens[0],
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
            value: {
              s: makeInfinityToken(),
              e: makeInfinityToken(),
            } as RangeValue,
          },
        ],
      };
    }
    case 'quoted_string':
    case 'word':
      if (nextToken && nextToken.type === 'pair_op') {
        return decodeTokenPair(subjectToken, subjectToken, tokens, i + 2);
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

      if (newTokens.length > 0) {
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

type ParseResult = {
  tokenize: {
    i: number;
    i2: number;
    value: Token[];
  };
  decode: {
    i: number;
    i2: number;
    value: Token[];
  };
  value: Token[];
};

/**
 * Parse an Artemis QL search string.
 * The original tokenize step result is returned in a `tokenize` object.
 *
 * Args:
 * * `str` [String] the original search string to parse.
 *
 * Return:
 * * `result` [Object]
 *   * `tokenize` [Object]
 *     * `i` [Number] the original start position of the first valid token in the search string.
 *     * `i2` [Number] the end position of the last token in the search string.
 *     * `value` [Array<Token>] an array containing all parsed tokens.
 *                              (these are the raw underlying tokens used by the decode step).
 *   * `decode` [Object]
 *     * `i` [Number] the original start position of the first valid token in the search string.
 *     * `i2` [Number] the end position of the last token in the search string.
 *     * `value` [Array<Token>] an array containing all decoded tokens.
 *   * `value` [Array<Token>] Same as the `decode.tokens` but provided for convenience in case
 *                            an additional step is added in the future.
 */
export function parse(str: string): ParseResult {
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
