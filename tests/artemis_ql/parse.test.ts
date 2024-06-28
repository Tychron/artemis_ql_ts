import ArtemisQL from '../../artemis_ql';

describe('parse/1', () => {
  test('can parse an empty string', () => {
    expect(ArtemisQL.parse('')).toMatchObject({
      value: [],
    });
  });

  test('can parse an empty spaced string', () => {
    expect(ArtemisQL.parse('\t ')).toMatchObject({
      value: [],
    });
  });

  describe('word', () => {
    test('can parse a single word', () => {
      expect(ArtemisQL.parse('WORD')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'word',
            value: 'WORD',
          },
        ],
      });
    });
  });

  describe('null', () => {
    test('can parse NULL keyword', () => {
      expect(ArtemisQL.parse('NULL Null null')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'null',
            value: null,
          },
          {
            index: 5,
            type: 'null',
            value: null,
          },
          {
            index: 10,
            type: 'null',
            value: null,
          },
        ],
      });
    });
  });

  describe('quoted string', () => {
    test('can parse an empty quoted string', () => {
      expect(ArtemisQL.parse('""')).toMatchObject({
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
      expect(ArtemisQL.parse('"My Quoted String"')).toMatchObject({
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
      expect(ArtemisQL.parse('key:value')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'pair',
            value: {
              key: {
                index: 0,
                type: 'word',
                value: 'key',
              },
              value: {
                index: 4,
                type: 'word',
                value: 'value',
              },
            },
          },
        ],
      });
    });

    test('can parse an incomplete key-value pair ', () => {
      expect(ArtemisQL.parse('key:')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'incomplete:pair',
            value: {
              key: {
                index: 0,
                type: 'word',
                value: 'key',
              },
              value: null,
            },
          },
        ],
      });

      expect(ArtemisQL.parse('key:    ')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'incomplete:pair',
            value: {
              key: {
                index: 0,
                type: 'word',
                value: 'key',
              },
              value: null,
            },
          },
        ],
      });
    });

    test('can parse mixed pairs', () => {
      expect(ArtemisQL.parse('key:value key2: ')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'pair',
            value: {
              key: {
                index: 0,
                type: 'word',
                value: 'key',
              },
              value: {
                index: 4,
                type: 'word',
                value: 'value'
              },
            },
          },
          {
            index: 10,
            type: 'incomplete:pair',
            value: {
              key: {
                index: 10,
                type: 'word',
                value: 'key2',
              },
              value: null,
            },
          },
        ],
      });
    });
  });

  describe('operators', () => {
    for (let name of Object.keys(ArtemisQL.OPERATORS)) {
      const op: string = ArtemisQL.OPERATORS[name];

      test(`can handle a ${name} operator`, () => {
        expect(ArtemisQL.parse(`${op}value`)).toMatchObject({
          value: [
            {
              index: 0,
              type: 'cmp',
              value: {
                op: name,
                value: {
                  index: op.length,
                  type: 'word',
                  value: 'value',
                },
              },
            },
          ],
        });
      });

      test(`can handle a ${name} operator in pair`, () => {
        expect(ArtemisQL.parse(`key:${op}value`)).toMatchObject({
          value: [
            {
              index: 0,
              type: 'pair',
              value: {
                key: {
                  index: 0,
                  type: 'word',
                  value: 'key',
                },
                value: {
                  index: 4,
                  type: 'cmp',
                  value: {
                    op: name,
                    value: {
                      index: 4+op.length,
                      type: 'word',
                      value: 'value',
                    },
                  },
                },
              },
            },
          ],
        });
      });
    }
  });

  describe('list', () => {
    test('can handle an empty list', () => {
      expect(ArtemisQL.parse(',')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'list',
            value: [
            ],
          },
        ],
      });
    });

    test('can handle a single element list', () => {
      expect(ArtemisQL.parse(',b')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'list',
            value: [
              {
                index: 1,
                type: 'word',
                value: 'b'
              },
            ],
          },
        ],
      });
    });

    test('can handle a list of 2 elements', () => {
      expect(ArtemisQL.parse('a,b')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'list',
            value: [
              {
                index: 0,
                type: 'word',
                value: 'a',
              },
              {
                index: 2,
                type: 'word',
                value: 'b',
              },
            ],
          },
        ],
      });
    });
  });

  describe('group', () => {
    test('can handle empty group', () => {
      expect(ArtemisQL.parse('()')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'group',
            value: [],
          },
        ],
      });
    });

    test('can handle multiple groups', () => {
      expect(ArtemisQL.parse('()()()')).toMatchObject({
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
      expect(ArtemisQL.parse('(')).toMatchObject({
        value: [
          {
            index: 0,
            type: 'incomplete:group',
            value: [],
          },
        ],
      });
    });

    test('can handle prematurely closed group', () => {
      expect(ArtemisQL.parse(')')).toMatchObject({
        value: [],
      });
    });
  });
});
