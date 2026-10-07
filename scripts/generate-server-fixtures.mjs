// Offline source-of-truth fixtures. Requires Elixir/OTP with :json (OTP 27+).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv[2]) throw new Error('Usage: node scripts/generate-server-fixtures.mjs /path/to/artemis_ql');
const server = resolve(process.argv[2]);
const values = ['a', 'NULL', 'a*', 'a?b', '"a"', '^other', '(a,b)',
  'foo.bar', '10.0.0.0/8', '+1.5', 'José', '東京', '😀', '"\\u{1F600}"'];
const queries = new Set();
for (const v of values) {
  for (const prefix of ['', 'field:', 'field:>', 'field:!~']) queries.add(prefix + v);
  // A leading bare NULL or group is decoded directly by the server,
  // so it cannot start an unparenthesized list.
  for (const w of (['NULL', '(a,b)'].includes(v) ? [] : ['b', '>2', '=3', '<4', 'NULL', '^other'])) queries.add('field:' + v + ',' + w);
}
for (const s of ['field:..', 'field:a..', 'field:..b', 'field:a..b',
  'field:>1,=2,<3', 'field:', 'field: ', 'name:foo.bar status:active',
  'field:a,b..c', 'field:!10..20', 'field:(a,b)', 'field:!(a,b)',
  '"\\u30C9"', '"\\u{10FFFF}"', '"\\\\\\\"\\0\\b\\f\\n\\r\\s\\t\\v"']) queries.add(s);
const invalid = ['"\\u1zzZ"', '"\\u{1zzZ}"', '"\\u{110000}"', '"\\u{D800}"',
  '"\\uD800"', '"\\u{}"', '"\\u12"a', '"a\\x"', '"a\u0001b"', '"a\nb"'];
const args = [];
const hash = createHash('sha256');
for (const name of ['tokens', 'utils', 'tokenizer', 'decoder']) {
  const path = resolve(server, 'lib/artemis_ql', name + '.ex');
  args.push('-r', path);
  hash.update(readFileSync(path));
}
const code = String.raw`
defmodule ParityFixture do
  def norm({kind, value, _meta}) do
    value = case kind do
      k when k in [:pair, :range] -> value |> Tuple.to_list() |> Enum.map(&norm/1)
      :cmp -> {op, v} = value; [Atom.to_string(op), norm(v)]
      :pin -> norm(value)
      k when k in [:group, :list, :partial] -> Enum.map(value, &norm/1)
      :NULL -> :null
      _ -> if is_nil(value), do: :null, else: value
    end
    [Atom.to_string(kind), value]
  end
  def norm(nil), do: :null
end
input = :json.decode(IO.read(:stdio, :eof))
valid = Enum.map(input["valid"], fn q ->
  {:ok, tokens, ""} = ArtemisQL.Decoder.decode(q)
  %{query: q, tokens: Enum.map(tokens, &ParityFixture.norm/1)}
end)
invalid = Enum.map(input["invalid"], fn q ->
  {:error, _} = ArtemisQL.Decoder.decode(q)
  q
end)
IO.puts(:json.encode(%{valid: valid, invalid: invalid}))
`;
const result = JSON.parse(execFileSync('elixir', [...args, '-e', code], {
  input: JSON.stringify({ valid: [...queries], invalid }), encoding: 'utf8',
}));
const destination = fileURLToPath(new URL('../tests/server-parity.json', import.meta.url));
const before = (() => { try { return readFileSync(destination, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; return null; } })();
const version = readFileSync(resolve(server, 'mix.exs'), 'utf8').match(/version: "([^"]+)"/)[1];
const text = '{\n  "source": ' + JSON.stringify(`ArtemisQL ${version} tokenizer/decoder`)
  + ',\n  "sourceSha256": ' + JSON.stringify(hash.digest('hex'))
  + ',\n  "valid": [\n' + result.valid.map(row => '    ' + JSON.stringify(row)).join(',\n')
  + '\n  ],\n  "invalid": ' + JSON.stringify(result.invalid) + '\n}\n';
if (before !== null && readFileSync(destination, 'utf8') !== before) throw new Error('Fixture changed during generation');
writeFileSync(destination, text);
console.log(`Generated ${result.valid.length} accepted queries and ${result.invalid.length} rejected quotes.`);
