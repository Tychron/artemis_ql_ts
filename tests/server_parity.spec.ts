import { parse, tokenize, readUntilCharCode, Token } from '../index';
const fixture = require('./server-parity.json');

// Preserve the client-facing token names/shapes. Only normalize metadata and
// representation differences; field ownership and value boundaries must match.
function normalized(token: Token | null): any {
  if (!token) return null;
  const value: any = token.value;
  switch (token.type) {
    case 'pair': case 'incomplete:pair':
      return ['pair', [normalized(value.key), normalized(value.value)]];
    case 'cmp': return ['cmp', [value.op, normalized(value.value)]];
    case 'range': return ['range', [normalized(value.s), normalized(value.e)]];
    case 'pin': return ['pin', normalized(value[0])];
    case 'group': case 'list': case 'partial':
      return [token.type, value.map(normalized)];
    case 'quoted_string': return ['quote', value];
    case 'null': return ['NULL', null];
    case 'infinity': case 'wildcard': case 'any_char': return [token.type, null];
    default: return [token.type, value];
  }
}

describe('ArtemisQL server 0.7.0 parity', () => {
  test.each(fixture.valid)('$query', ({ query, tokens }: any) => {
    const result = parse(query);
    expect(result.tokenize.i2).toBe(query.length);
    expect(result.value.map(normalized)).toEqual(tokens);
  });
  test.each(fixture.invalid)('rejects closed invalid quote %s', (query: string) => {
    expect(() => parse(query)).toThrow(SyntaxError);
  });
});

describe('source spans and editing extensions', () => {
  test.each(['>=', '<=', '!~', '..'])('covers both characters of %s', (query) => {
    expect(tokenize(query).value[0].pos).toEqual([0, 2]);
  });
  test.each(['field:^other', 'field:(a,b)', 'field:..', 'field:a..',
    'field:..b', 'field:>1,=2,<3', 'field:a,b,', 'field:😀'])('covers all of %s', (query) => {
    const result = parse(query);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].pos).toEqual([0, query.length]);
  });
  test.each(['(field:^other', '(field:NULL', '(field:>1,=2', 'field:!(a,b'])('keeps unfinished %s', (query) => {
    const result = parse(query);
    expect(result.tokenize.i2).toBe(query.length);
    expect(result.value[0].pos).toEqual([0, query.length]);
  });
  test('normalizes pins and NULL in unfinished groups', () => {
    const group: any = parse('(field:^other empty:NULL').value[0];
    expect(group.type).toBe('incomplete:group');
    expect(group.value[0].value.value.type).toBe('pin');
    expect(group.value[1].value.value).toMatchObject({ type: 'null', value: null });
  });
  test.each(['"\\u{12', '"\\u12', '"foo\\xbar', '"foo\\'])('preserves unfinished escapes %s', (query) => {
    const token = parse(query).value[0];
    expect(token).toMatchObject({ type: 'incomplete:quoted_string', isError: true,
      value: query.slice(1), pos: [0, query.length] });
  });
  test('does not swallow later fields on a single dot or CIDR slash', () => {
    expect(parse('ip:10.0.0.0/8 name:foo.bar status:active').value).toHaveLength(3);
  });
  test('a double dot terminates a word as on the server', () => {
    expect(parse('field:1.5..2.5').value[0]).toMatchObject({
      value: { value: { type: 'range', value: {
        s: { value: '1.5' }, e: { value: '2.5' },
      } } },
    });
  });
  test('readUntilCharCode keeps the final character before its delimiter', () => {
    expect(readUntilCharCode('abc}', 0, 125)).toEqual({ i: 0, i2: 3, value: 'abc' });
    expect(readUntilCharCode('}', 0, 125).value).toBe('');
  });
  test('logical keywords retain the documented client representation', () => {
    expect(parse('a OR b AND NOT c').value.map(t => t.type))
      .toEqual(['word', 'or', 'word', 'and', 'not', 'word']);
  });
});
