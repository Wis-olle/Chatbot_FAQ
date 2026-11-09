import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relatedSuggestions } from '../suggestions.js';

test('keeps model questions first and fills to exactly three distinct questions', () => {
  const fallback = [{ id: 'DNS', question: 'Trỏ DNS như thế nào?' }, { question: 'Khi nào cần SSL?' }];
  const result = relatedSuggestions(['  Chọn tên miền thế nào?  '], { fallback });
  assert.deepEqual(result, [{ question: 'Chọn tên miền thế nào?' }, ...fallback]);
  assert.equal(fallback[0].question, 'Trỏ DNS như thế nào?');
});

test('rejects invalid questions, duplicates and the current question before filling', () => {
  const result = relatedSuggestions([null, {}, 42, '', '  ', 'x'.repeat(181),
    'SSL là gì?', ' ssl la gi! ', 'Cài SSL thế nào?', ' cài   SSL thế nào? ',
    { id: 'SSL', question: 'Khi nào cần gia hạn SSL?' }], { message: 'SSL là gì?' });
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], { question: 'Cài SSL thế nào?' });
  assert.deepEqual(result[1], { id: 'SSL', question: 'Khi nào cần gia hạn SSL?' });
  assert.ok(result.every(item => item.question !== 'SSL là gì?'));
});

test('empty or malformed lists still supply three questions and untrusted IDs are discarded', () => {
  for (const items of [undefined, null, {}, 'bad', []]) {
    assert.equal(relatedSuggestions(items, { fallback: null }).length, 3);
  }
  const result = relatedSuggestions([{ id: '../bad', question: '<img src=x> nghĩa là gì?' },
    { id: 123, question: 'Câu hỏi thứ hai?' }, { id: 'SAFE-ID', question: 'Câu hỏi thứ ba?' }, 'Câu thứ tư?']);
  assert.deepEqual(result.map(item => item.id), [undefined, undefined, 'SAFE-ID']);
  assert.equal(result[0].question, '<img src=x> nghĩa là gì?');
});
