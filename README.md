# Artemis QL Typescript

The implementation lives in `index.ts`; `artemis_ql.ts` re-exports it for compatibility.

## Usage

```javascript
import { parse } from 'artemis_ql';

const { value: tokens } = parse(`
  inserted_at:@today
`);

tokens; // a list of all parsed tokens
```

## Tokens

`tokenize` and `parse` produce a list of tokens typically, while the both share the same structure internally, `tokenize` produces 1:1 mappings of low-level components in Artemis, while parse will return higher level compound tokens (e.g. `tokenize`'s `pin_op` becomes a `pin`)

### Parse

These are the tokens that should be expected from a `parse`.

`incomplete:` tokens are client editing extensions for suggestions. The server rejects unfinished quotes and groups, but accepts a key with no value (`key:` or `key: `) as a pair with a nil value. The client labels that pair `incomplete:pair` while editing.

Closed quotes follow the server's escape and control-character validation and throw `SyntaxError` when invalid. Unfinished invalid escapes remain verbatim in an `incomplete:quoted_string` with `isError: true`. Token `pos` values are half-open JavaScript UTF-16 offsets, including compound syntax; synthetic infinity tokens use `[-1, -1]`. Logical keywords remain flat client tokens rather than the server's compacted logical tree.

Server parity fixtures are generated from the actual Elixir tokenizer and decoder:

```sh
node scripts/generate-server-fixtures.mjs /path/to/artemis_ql
npm test -- --runInBand
```

The checked-in fixtures run without Elixir or the server checkout. Regeneration needs Elixir and Erlang/OTP 27+; the fixture records a SHA-256 of the four server modules.

#### `pin`

Formed from a `pin_op` (`^`) and a `word` or `quoted_string`.

```
^other_field
```

A pin or pinned field is used to designate a field's value should be used for the search value.

Pins are only valid in `pair` and have no defined behaviour when used outside of that context.

#### `incomplete:pin`

Formed when a `pin_op` is not followed by a `word` or `quoted_string`.

```
^ other_thing
```

#### `and`

Logical `AND`, support for logical keywords is limited at the moment.

```
A AND B C and D
```

#### `or`

Logical `OR`, support for logical keywords is limited at the moment.

```
A OR B C or D
```

#### `not`

Logical `NOT`, support for logical keywords is limited at the moment.

```
NOT abc
```

#### `null`

Explicit `NULL`.

```
abc:NULL
```

#### `partial`

Partial tokens contain a list of `word`, `quoted_string`, `wildcard` and `any_char` tokens.

```
word*other?"Thing"
```

#### `range`

Ranges are composed of one left hand value typically a `word` or `quoted_string` and a right hand value also a `word` or `quoted_string`.

Ranges may also have one or both values left empty to represent an `infinity`.

Ranges do not support partials.

```
..
A..
..B
A..B
```

#### `list`

Lists are created with a `continuation_op` (`,`) after a term.

```
A,B,C
D,E,F,G
```

#### `cmp`

Comparison tokens are formed from a `comparison_op` and value term.

The available operators are:
* `>=` Greater-Than-Or-Equal-To
* `<=` Less-Than-Or-Equal-To
* `>` Greater-Than
* `<` Less-Than
* `~` Fuzz
* `!~` Not-Fuzz
* `!` Not
* `=` Equal

```
>=A
<=B
>C
<D
~E
!~F
!G
=H
```

#### `quoted_string`

A quoted string is any sequence of characters enclosed in a pair of `"`.

They support the server escape sequences below. Raw ASCII control characters (including raw newlines) are rejected; use escaped forms.

```
"ABC"
"\n\n"
"\s\r\n"
"\uFFEF"
```

| Escape | Description |
| ------ | ---- |
| `\\` | Escape `\` |
| `\uHHHH` | Unicode four nibble sequence |
| `\u{H+}` | Unicode N+ nibble sequence |
| `\"` | Escape `"` |
| `\0` | Null |
| `\b` | Backspace |
| `\f` | Form Feed |
| `\n` | Newline |
| `\r` | Carriage Return |
| `\s` | Space |
| `\t` | Tab |
| `\v` | Vertical Tab |

#### `word`

Words use the server tokenizer's exact character ranges: ASCII letters/digits, `@`, `-`, `+`, `_`, `.`, `/`, and its supported Unicode ranges. A double dot (`..`) ends a word and starts a range; a single dot stays in the word.

```
WORD
also_a_word
```

#### `pair`

A pair is any key and value element that forms a single reference.

The key is typically the name of an underlying field or key in the seach spec.

Keys can be either a `word` or a `quoted_string`.

Values can be any valid value except another pair.

```
key:value
inserted_at:@today
```

#### `incomplete:pair`

A pair that is missing either it's key or value, normally this form is not valid for artemis, but is provided for search suggestions.

#### `group`

A group is zero or more tokens enclosed by `(` and `)`.

Groups are typically used with lists to negate the entire list.

```
()
(A,B,C)
!(A,B,C)
```

#### `incomplete:group`

An incomplete group is one that has not been closed with `)` and is currently ongoing.

This is only provided for search suggestion and completion.
