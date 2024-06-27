/*
 * Artemis QL Client Library
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
  value: number | string | boolean | CmpValue | RangeValue | PairValue | Token[],
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
        type: 'pin',
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

  let token: Token;
  let token2: Token;

  while (i < l) {
    token = tokens[i];
    token2 = tokens[i + 1];
    switch (token.type) {
      case 'pin':
        if (token2) {
          if (token2.type === 'word' || token2.type === 'quoted_string') {
            result.push({
              ...token,
              type: 'pin',
              value: [token2],
            });
            i += 2;
          } else {
            result.push({
              ...token,
              isError: true,
              type: 'pin',
            });
            i += 1;
          }
        } else {
          result.push({
            ...token,
            type: 'incomplete:pin',
          });
          i += 1;
        }
        break;
      case 'word':
        switch ((token.value as string).toUpperCase()) {
          case 'AND':
            result.push({
              ...token,
              type: 'and',
            });
            i += 1;
            break;
          case 'OR':
            result.push({
              ...token,
              type: 'or',
            });
            i += 1;
            break;
          case 'NOT':
            result.push({
              ...token,
              type: 'not',
            });
            i += 1;
            break;
          case 'NULL':
            result.push({
              ...token,
              type: 'null',
            });
            i += 1;
            break;
          default:
            result.push(token);
            i += 1;
            break;
        }
        break;
      case 'group':
        result.push({
          ...token,
          value: parseTokens(token.value as Token[]),
        });
        i += 1;
        break;
      default:
        result.push(token);
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

  let token: Token;
  let done: boolean = false;
  while (i2 < l) {
    token = tokens[i2];
    switch (token.type) {
      case 'word':
      case 'quoted_string':
      case 'range':
      case 'cmp':
      case 'pin':
      case 'null':
      case 'wildcard':
      case 'any_char':
        acc.push(token);
        break;
      case 'group': {
        const {
          tokens: newTokens,
        // eslint-disable-next-line
        } = decodeToken([token], 0);
        newTokens.forEach((newToken) => {
          acc.push(newToken);
        });
      } break;
      default:
        done = true;
        break;
    }
    i2 += 1;
    if (done) {
      break;
    }
  }

  const result: Token[] = [];

  if (acc.length === 1) {
    result.push(acc[0]);
  } else if (acc.length > 1) {
    result.push({
      type: 'partial',
      index: acc[0].index,
      value: acc,
    });
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
      token = tokens[i2];

      if (token && token.type !== 'space') {
        if (token.type === 'continuation_op') {
          // keep going!
          i2 += 1;
        } else {
          throw new Error(`list must be terminated by space or eos (got ${token.type})`);
        }
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return {
    i2,
    tokens: result,
  };
}

function decodeTokenPair(key: Token, tokens: Token[], i: number) {
  const {
    i2,
    tokens: valueTokens,
  // eslint-disable-next-line
  } = decodeToken(tokens, i);

  if (valueTokens.length > 0) {
    const value = valueTokens[0];
    return {
      i2,
      tokens: [
        {
          type: 'pair',
          index: key.index,
          value: {
            key,
            value,
          } as PairValue,
        },
      ],
    };
  }

  return {
    i2,
    tokens: [
      {
        type: 'incomplete:pair',
        index: key.index,
        value: {
          key,
          value: null,
        } as PairValue,
      },
    ],
  };
}

function decodeTokenOther(tokens: Token[], i: number) {
  const {
    i2: i3,
    tokens: valueTokens,
  } = decodeTokenAsValue(tokens, i);

  if (valueTokens.length < 1) {
    return {
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
        } = decodeTokensAsValueList(tokens, i2);
        i2 = i4;
        return {
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
          i2,
          tokens: valueTokens,
        };
    }
  } else {
    return {
      i2,
      tokens: valueTokens,
    };
  }
}

export function decodeToken(tokens: Token[], i: number): DecodeTokenResult {
  const token = tokens[i];
  const token2 = tokens[i + 1];

  if (!token) {
    return {
      i2: i,
      tokens: [],
    };
  }

  switch (token.type) {
    case 'or':
    case 'and':
    case 'not':
    case 'null':
      return {
        i2: i + 1,
        tokens: [token],
      };
    case 'group':
      return {
        i2: i + 1,
        tokens: [
          {
            ...token,
            // eslint-disable-next-line
            value: decodeTokens(token.value as Token[]),
          },
        ],
      };
    case 'cmp_op': {
      const {
        i2,
        tokens: valueTokens,
      } = decodeTokenAsValue(tokens, i + 1);

      return {
        i2,
        tokens: [
          {
            type: 'cmp',
            index: token.index,
            value: {
              op: token.value,
              value: valueTokens[0],
            } as CmpValue,
          },
        ],
      };
    }
    case 'range_op': {
      if (token2 && token2.type !== 'space') {
        const {
          i2,
          tokens: valueTokens,
        } = decodeTokenAsValue(tokens, i + 1);

        return {
          i2,
          tokens: [
            {
              type: 'range',
              index: token.index,
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
            index: token.index,
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
      if (token2 && token2.type === 'pair_op') {
        return decodeTokenPair(token, tokens, i + 2);
      }
      return decodeTokenOther(tokens, i);
    default: {
      return decodeTokenOther(tokens, i);
    }
  }
}

export function decodeTokens(tokens: Token[]) {
  const result: Token[] = [];
  const l = tokens.length;
  let i = 0;

  let token: Token;
  while (i < l) {
    token = tokens[i];

    if (token.type === 'space') {
      i += 1;
    } else {
      const {
        i2,
        tokens: newTokens,
      } = decodeToken(tokens, i);
      newTokens.forEach((newToken) => {
        result.push(newToken);
      });
      i = i2;
    }
  }

  return result;
}

export function parse(str: string): Token[] {
  const {
    value,
  } = tokenize(str);

  let tokens = parseTokens(value);
  tokens = decodeTokens(tokens);

  return tokens;
}

export default {
  OPERATORS,
  tokenize,
  parse,
  decodeTokens,
  decodeToken,
};
