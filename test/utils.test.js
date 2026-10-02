const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSeriesDirName,
  resolveOutputDir,
  sanitizeFileName,
} = require('../dist/utils.js');

test('sanitizeFileName removes invalid characters', () => {
  assert.equal(sanitizeFileName('a<b>c'), 'a_b_c');
  assert.equal(sanitizeFileName('   '), 'untitled');
});

test('buildSeriesDirName sanitizes both parts', () => {
  assert.equal(buildSeriesDirName('a/b', 'c:d'), 'a_b_c_d');
});

test('resolveOutputDir expands home directory', () => {
  const resolved = resolveOutputDir('~/novel-output');
  assert.ok(resolved.endsWith('/novel-output'));
});

test('resolveOutputDir rejects empty path', () => {
  assert.throws(() => resolveOutputDir('   '), /cannot be empty/);
});
