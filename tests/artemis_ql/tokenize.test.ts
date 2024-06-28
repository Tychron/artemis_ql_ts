import ArtemisQL from '../../artemis_ql';

describe('tokenize/1', () => {
  test('can tokenize an empty string', () => {
    expect(ArtemisQL.tokenize('')).toStrictEqual({
      i: 0,
      i2: 0,
      value: [],
    });
  });

  test('can parse an empty spaced string', () => {
    expect(ArtemisQL.tokenize('\t ')).toStrictEqual({
      i: 0,
      i2: 2,
      value: [
        {
          index: 0,
          type: 'space',
          value: '\t ',
        },
      ],
    });
  });

  describe('word', () => {
    test('can parse a single word', () => {
      expect(ArtemisQL.tokenize('WORD')).toStrictEqual({
        i: 0,
        i2: 4,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'WORD',
          },
        ],
      });
    });

    test('can parse a single words with some special characters', () => {
      expect(ArtemisQL.tokenize('WORD @special _underscore hyphe-nated')).toStrictEqual({
        i: 0,
        i2: 37,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'WORD',
          },
          {
            index: 4,
            type: 'space',
            value: ' ',
          },
          {
            index: 5,
            type: 'word',
            value: '@special',
          },
          {
            index: 13,
            type: 'space',
            value: ' ',
          },
          {
            index: 14,
            type: 'word',
            value: '_underscore',
          },
          {
            index: 25,
            type: 'space',
            value: ' ',
          },
          {
            index: 26,
            type: 'word',
            value: 'hyphe-nated',
          },
        ],
      });
    });
  });

  describe('quoted string', () => {
    test('can parse an empty quoted string', () => {
      expect(ArtemisQL.tokenize('""')).toStrictEqual({
        i: 0,
        i2: 2,
        value: [
          {
            index: 0,
            type: 'quoted_string',
            value: '',
          },
        ],
      });
    });

    test('can parse a quoted string', () => {
      expect(ArtemisQL.tokenize('"My Quoted String"')).toStrictEqual({
        i: 0,
        i2: 18,
        value: [
          {
            index: 0,
            type: 'quoted_string',
            value: 'My Quoted String',
          },
        ],
      });
    });
  });

  describe('pairs', () => {
    test('can parse a key-value pair', () => {
      expect(ArtemisQL.tokenize('key:value')).toStrictEqual({
        i: 0,
        i2: 9,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'key'
          },
          {
            index: 3,
            type: 'pair_op',
            value: true,
          },
          {
            index: 4,
            type: 'word',
            value: 'value',
          },
        ],
      });
    });

    test('can parse an incomplete key-value pair ', () => {
      expect(ArtemisQL.tokenize('key:')).toStrictEqual({
        i: 0,
        i2: 4,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'key',
          },
          {
            index: 3,
            type: 'pair_op',
            value: true,
          },
        ]
      });

      expect(ArtemisQL.tokenize('key:    ')).toStrictEqual({
        i: 0,
        i2: 8,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'key',
          },
          {
            index: 3,
            type: 'pair_op',
            value: true,
          },
          {
            index: 4,
            type: 'space',
            value: '    '
          },
        ],
      });

      expect(ArtemisQL.tokenize(':value')).toStrictEqual({
        i: 0,
        i2: 6,
        value: [
          {
            index: 0,
            type: 'pair_op',
            value: true,
          },
          {
            index: 1,
            type: 'word',
            value: 'value',
          },
        ]
      });
    });

    test('can parse mixed pairs', () => {
      expect(ArtemisQL.tokenize('key:value key2: ')).toStrictEqual({
        i: 0,
        i2: 16,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'key',
          },
          {
            index: 3,
            type: 'pair_op',
            value: true,
          },
          {
            index: 4,
            type: 'word',
            value: 'value'
          },
          {
            index: 9,
            type: 'space',
            value: ' ',
          },
          {
            index: 10,
            type: 'word',
            value: 'key2',
          },
          {
            index: 14,
            type: 'pair_op',
            value: true,
          },
          {
            index: 15,
            type: 'space',
            value: ' ',
          },
        ]
      });
    });
  });

  describe('operators', () => {
    for (let name of Object.keys(ArtemisQL.OPERATORS)) {
      const op: string = ArtemisQL.OPERATORS[name];

      test(`can handle a ${name} operator`, () => {
        expect(ArtemisQL.tokenize(`${op}value`)).toStrictEqual({
          i: 0,
          i2: op.length + 5,
          value: [
            {
              index: 0,
              type: 'cmp_op',
              value: name,
            },
            {
              index: op.length,
              type: 'word',
              value: 'value',
            },
          ],
        });
      });

      test(`can handle a ${name} operator in pair`, () => {
        expect(ArtemisQL.tokenize(`key:${op}value`)).toStrictEqual({
          i: 0,
          i2: op.length + 9,
          value: [
            {
              index: 0,
              type: 'word',
              value: 'key',
            },
            {
              index: 3,
              type: 'pair_op',
              value: true,
            },
            {
              index: 4,
              type: 'cmp_op',
              value: name,
            },
            {
              index: 4+op.length,
              type: 'word',
              value: 'value',
            },
          ]
        });
      });
    }
  });

  describe('list', () => {
    test('can handle an empty list', () => {
      expect(ArtemisQL.tokenize(',')).toStrictEqual({
        i: 0,
        i2: 1,
        value: [
          {
            index: 0,
            type: 'continuation_op',
            value: true,
          },
        ],
      });
    });

    test('can handle a single element list', () => {
      expect(ArtemisQL.tokenize(',b')).toStrictEqual({
        i: 0,
        i2: 2,
        value: [
          {
            index: 0,
            type: 'continuation_op',
            value: true,
          },
          {
            index: 1,
            type: 'word',
            value: 'b',
          },
        ],
      });
    });

    test('can handle a list of 2 elements', () => {
      expect(ArtemisQL.tokenize('a,b')).toStrictEqual({
        i: 0,
        i2: 3,
        value: [
          {
            index: 0,
            type: 'word',
            value: 'a',
          },
          {
            index: 1,
            type: 'continuation_op',
            value: true,
          },
          {
            index: 2,
            type: 'word',
            value: 'b',
          },
        ],
      });
    });
  });

  describe('group', () => {
    test('can handle empty group', () => {
      expect(ArtemisQL.tokenize('()')).toStrictEqual({
        i: 0,
        i2: 2,
        value: [
          {
            index: 0,
            type: 'group',
            value: [],
          },
        ],
      });
    });

    test('can handle multiple empty groups', () => {
      expect(ArtemisQL.tokenize('()()()')).toStrictEqual({
        i: 0,
        i2: 6,
        value: [
          {
            index: 0,
            type: 'group',
            value: [],
          },
          {
            index: 2,
            type: 'group',
            value: [],
          },
          {
            index: 4,
            type: 'group',
            value: [],
          },
        ],
      });
    });

    test('can handle incomplete group', () => {
      expect(ArtemisQL.tokenize('(')).toStrictEqual({
        i: 0,
        i2: 2,
        value: [
          {
            index: 0,
            type: 'incomplete:group',
            value: [],
          },
        ],
      });
    });

    test('can prematurely closed group', () => {
      expect(ArtemisQL.tokenize(')')).toStrictEqual({
        i: 0,
        i2: 0,
        value: [],
      });
    });
  });
});
