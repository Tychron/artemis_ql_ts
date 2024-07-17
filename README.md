# Artemis QL Typescript

Simply copy the `artemis_ql.ts` file into your project for use, this isn't really a library fyi (yet).

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

`incomplete:` tokens are only available in this module for providing a utility for search suggestions, the `artemis_ql` server library will treat them as hard errors and abort.

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

They may contain some escape sequences such as spaces, newlines and unicode.

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
| `\a` | Alert/Bell |
| `\b` | Backspace |
| `\f` | Form Feed |
| `\n` | Newline |
| `\r` | Carriage Return |
| `\s` | Space |
| `\t` | Tab |
| `\v` | Vertical Tab |

#### `word`

A word is any unbroken sequence of `letters` (A-Z a-z) and numbers (0-9) and some special characters (`-`, `_`, `.`, `@`)

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
