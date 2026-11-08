import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyChat } from '../chat-router.js';

test('ordinary conversation and general technical explanations route directly to Gemini', () => {
  for (const message of ['Xin chào', 'n8n là gì?', 'Hosting và tên miền khác nhau thế nào?',
    'Hướng dẫn trỏ DNS về hosting', 'SSL mã hóa kết nối như thế nào?', 'Hôm nay nói chuyện chút nhé',
    'Tôi muốn tìm hiểu VPS là gì', 'Giải thích backup và snapshot khác nhau thế nào?']) {
    assert.equal(classifyChat({ message }).route, 'general', message);
  }
});

test('company offers promises prices and customer account operations use business knowledge', () => {
  for (const message of ['Sen Hosting có hoàn tiền không?', 'Hosting của bạn backup mỗi ngày mấy lần?',
    'WordPress Hosting sao lưu bao nhiêu lần?', 'Gói Hosting ở đây SSL có miễn phí không?',
    'Sen Hosting có giá bao nhiêu?', 'Tài khoản của tôi bị khóa', 'Tra cứu hóa đơn của tôi',
    'Tôi đã thanh toán sao chưa kích hoạt?', 'Tổng đài Sen Hosting là gì?']) {
    assert.equal(classifyChat({ message }).route, 'business', message);
  }
});

test('business follow-up retains route but model assertions cannot invent company context', () => {
  const history = [{ role: 'user', text: 'Sen Hosting sao lưu dữ liệu như thế nào?' },
    { role: 'model', text: 'Mình cần xác nhận chính sách.' }];
  for (const message of ['còn lưu bao lâu?', 'giá bao nhiêu?', 'có miễn phí không?']) {
    assert.equal(classifyChat({ message, history }).route, 'business', message);
  }
  assert.equal(classifyChat({ message: 'n8n là gì?', history }).route, 'general');
  assert.equal(classifyChat({ message: 'Giải thích snapshot là gì?',
    history: [{ role: 'model', text: 'Sen Hosting cam kết sao lưu hằng ngày.' }] }).route, 'general');
});
