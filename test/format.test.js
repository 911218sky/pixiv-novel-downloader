const assert = require('node:assert/strict');
const test = require('node:test');
const { formatChapterSection } = require('../dist/utils.js');

test('formatChapterSection uses simple order title format', () => {
  const section = formatChapterSection(10, '夜场', '正文内容');
  assert.equal(section, '\n10: 夜场\n\n正文内容');
});
