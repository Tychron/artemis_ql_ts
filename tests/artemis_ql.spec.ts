import * as ArtemisQL from '../artemis_ql';

describe('artemis_ql helpers', () => {
  test('detects space-like and newline-like chars', () => {
    expect(ArtemisQL.isSpaceLikeChar(0x20)).toBe(true);
    expect(ArtemisQL.isSpaceLikeChar(0x41)).toBe(false);

    expect(ArtemisQL.isNewlineLikeChar(0x0A)).toBe(true);
    expect(ArtemisQL.isNewlineLikeChar(0x20)).toBe(false);
  });

  test('splitSpaces returns contiguous spacing segment', () => {
    const res = ArtemisQL.splitSpaces(' \n\tabc', 0);

    expect(res).toEqual({
      i: 0,
      i2: 3,
      value: ' \n\t',
    });
  });

  test('readUntilCharCode throws when character is not found', () => {
    expect(() => ArtemisQL.readUntilCharCode('abc', 0, ArtemisQL.CHAR_TABLE['}']))
      .toThrow('read until end, but didn\'t find expected character');
  });
});

describe('artemis_ql tokenize/parseTokens', () => {
  test('tokenize parses quoted and incomplete quoted strings', () => {
    const closed = ArtemisQL.tokenize('"hello"').value;
    const open = ArtemisQL.tokenize('"hello').value;

    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({
      type: 'quoted_string',
      value: 'hello',
    });

    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      type: 'incomplete:quoted_string',
      value: 'hello',
    });
  });

  test('parseTokens normalizes logical keywords and NULL', () => {
    const tokens = ArtemisQL.parseTokens(ArtemisQL.tokenize('AND OR NOT NULL value').value);

    expect(tokens.map((t) => t.type)).toEqual([
      'and',
      'space',
      'or',
      'space',
      'not',
      'space',
      'null',
      'space',
      'word',
    ]);
  });

  test('parseTokens turns pin operator into pin token', () => {
    const tokens = ArtemisQL.parseTokens(ArtemisQL.tokenize('^user').value);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: 'pin',
    });
    expect((tokens[0].value as ArtemisQL.Token[])[0]).toMatchObject({
      type: 'word',
      value: 'user',
    });
  });
});

describe('artemis_ql decode/parse', () => {
  test('parse handles an unclosed quoted string without throwing', () => {
    expect(() => ArtemisQL.parse('"something')).not.toThrow();

    const parsed = ArtemisQL.parse('"something');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'incomplete:quoted_string',
      value: 'something',
    });
  });

  test('parse handles pair values with an unclosed quoted string', () => {
    expect(() => ArtemisQL.parse('name:"something')).not.toThrow();

    const parsed = ArtemisQL.parse('name:"something');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'pair',
      value: {
        key: {
          type: 'word',
          value: 'name',
        },
        value: {
          type: 'incomplete:quoted_string',
          value: 'something',
        },
      },
    });
  });

  test('parse decodes pair token', () => {
    const parsed = ArtemisQL.parse('status:active');

    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'pair',
      value: {
        key: {
          type: 'word',
          value: 'status',
        },
        value: {
          type: 'word',
          value: 'active',
        },
      },
    });
  });

  test('parse decodes range token with bounded values', () => {
    const parsed = ArtemisQL.parse('10..20');

    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'range',
      value: {
        s: {
          type: 'word',
          value: '10',
        },
        e: {
          type: 'word',
          value: '20',
        },
      },
    });
  });

  test('parse decodes left-open range to infinity start', () => {
    const parsed = ArtemisQL.parse('..20');

    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'range',
      value: {
        s: {
          type: 'infinity',
          value: Infinity,
        },
        e: {
          type: 'word',
          value: '20',
        },
      },
    });
  });

  test('parse decodes comma-separated lists', () => {
    const parsed = ArtemisQL.parse('red,green,blue');

    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'list',
    });

    const listValues = parsed.value[0].value as ArtemisQL.Token[];
    expect(listValues).toHaveLength(3);
    expect(listValues.map((t) => (t as ArtemisQL.WordToken).value)).toEqual(['red', 'green', 'blue']);
  });

  test('parse keeps incomplete groups as incomplete:group with decoded children', () => {
    const parsed = ArtemisQL.parse('(name:john');

    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'incomplete:group',
    });

    const children = parsed.value[0].value as ArtemisQL.Token[];
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: 'pair',
      value: {
        key: { value: 'name' },
        value: { value: 'john' },
      },
    });
  });

  test('parse handles unclosed groups with mixed values without throwing', () => {
    expect(() => ArtemisQL.parse('(name:john status:active')).not.toThrow();

    const parsed = ArtemisQL.parse('(name:john status:active');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'incomplete:group',
    });

    const children = parsed.value[0].value as ArtemisQL.Token[];
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ type: 'pair' });
    expect(children[1]).toMatchObject({ type: 'pair' });
  });

  test('parse handles pair value with trailing quote and no leading quote', () => {
    expect(() => ArtemisQL.parse('name:value"')).not.toThrow();

    const parsed = ArtemisQL.parse('name:value"');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'pair',
      value: {
        key: {
          type: 'word',
          value: 'name',
        },
        value: {
          type: 'partial',
        },
      },
    });

    const pairValue = parsed.value[0].value as ArtemisQL.PairValue;
    const partial = pairValue.value as ArtemisQL.PartialToken;
    const partialTokens = partial.value as ArtemisQL.Token[];
    expect(partialTokens.map((token) => token.type)).toEqual(['word', 'incomplete:quoted_string']);
    expect((partialTokens[0] as ArtemisQL.WordToken).value).toBe('value');
    expect((partialTokens[1] as ArtemisQL.QuotedStringToken).value).toBe('');
  });

  test('parse handles dangling pin operator without throwing', () => {
    expect(() => ArtemisQL.parse('^')).not.toThrow();

    const parsed = ArtemisQL.parse('^');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'incomplete:pin',
      isError: true,
    });
  });

  test('parse handles unknown quoted escape without hanging or throwing', () => {
    expect(() => ArtemisQL.parse('"foo\\xbar')).not.toThrow();

    const parsed = ArtemisQL.parse('"foo\\xbar');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'incomplete:quoted_string',
      value: 'foo\\xbar',
      isError: true,
    });
  });

  test('parse handles malformed unicode escape in quoted string', () => {
    expect(() => ArtemisQL.parse('"\\u{12')).not.toThrow();

    const parsed = ArtemisQL.parse('"\\u{12');
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]).toMatchObject({
      type: 'incomplete:quoted_string',
    });
  });

  test('parse handles malformed comma-list continuation gracefully', () => {
    expect(() => ArtemisQL.parse('a,b:c')).not.toThrow();

    const parsed = ArtemisQL.parse('a,b:c');
    expect(parsed.value.length).toBeGreaterThan(0);
  });
});
