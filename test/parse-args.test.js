const assert = require('node:assert/strict');
const test = require('node:test');
const { parseArgs } = require('../dist/cli.js');

test('parseArgs accepts output before id', () => {
  const args = parseArgs(['node', 'cli', 'series', '-o', './out', '16015437']);
  assert.equal(args.command, 'series');
  assert.equal(args.id, '16015437');
  assert.ok(args.output.endsWith('/out'));
});

test('parseArgs rejects invalid id', () => {
  assert.throws(
    () => parseArgs(['node', 'cli', 'novel', 'abc']),
    /Invalid novel ID/,
  );
});

test('parseArgs rejects extra positional args', () => {
  assert.throws(
    () => parseArgs(['node', 'cli', 'novel', '123', '456']),
    /Unexpected extra arguments/,
  );
});
