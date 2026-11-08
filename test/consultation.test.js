import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConsultation } from '../consultation.js';

const item = (id, type, extra = {}) => ({ id, type, name: id, description: `Thông tin ${type}`,
  status: 'active', ownerConfirmed: true, ...extra });
const profile = { brandName: 'Sen Hosting', catalog: [
  item('DOMAIN-COM', 'domain', { extensions: ['.com'], useCases: ['shop online'] }),
  item('DOMAIN-VN', 'domain', { extensions: ['.vn'], useCases: ['khách hàng Việt Nam'] }),
  item('HOST-STORE', 'hosting', { useCases: ['website bán hàng'], price: { amount: 237000, currency: 'VND', billingCycle: 'month', vatIncluded: false } }),
  item('VPS-AUTO', 'vps', { useCases: ['n8n', 'automation'] }),
  item('EMAIL-TEAM', 'email', { useCases: ['email theo tên miền'] }),
  item('DOMAIN-DRAFT', 'domain', { extensions: ['.draft'], status: 'draft' }),
  item('DOMAIN-UNCONFIRMED', 'domain', { extensions: ['.unconfirmed'], ownerConfirmed: false })
] };
const user = text => ({ role: 'user', text });
const model = text => ({ role: 'model', text });
const view = (input, options = {}) => buildConsultation(input, { profile: structuredClone(profile), ...options });

test('domain advice carries the clothing shop purpose and brand from earlier user turns', () => {
  const result = view({ message: 'sen hosting có tên miền nào hợp với tôi k', history: [
    user('Tôi mở shop quần áo tên Lụa Mây, muốn chọn tên miền phù hợp.'),
    model('Bạn muốn phục vụ khách hàng ở thị trường nào?'), user('Chủ yếu ở Việt Nam.')
  ] });
  assert.equal(result.intent, 'recommendation');
  assert.equal(result.needs.serviceType, 'domain');
  assert.match(JSON.stringify(result.needs), /shop quần áo/i);
  assert.match(JSON.stringify(result.needs), /Lụa Mây/i);
  assert.deepEqual(result.catalog.items.map(value => value.id).sort(), ['DOMAIN-COM', 'DOMAIN-VN']);
});

test('hosting recommendations retain another industry rather than assuming clothing shops', () => {
  const result = view({ message: 'Sen có gói hosting nào phù hợp cho mình?', history: [
    user('Tôi bán mỹ phẩm, muốn làm website bán hàng và nhận đơn online.')
  ] });
  assert.equal(result.intent, 'recommendation');
  assert.equal(result.needs.serviceType, 'hosting');
  assert.match(JSON.stringify(result.needs), /mỹ phẩm/i);
  assert.deepEqual(result.catalog.items.map(value => value.id), ['HOST-STORE']);
});

test('VPS advice keeps the automation workload across dialogue turns', () => {
  const result = view({ message: 'Vậy chọn VPS nào bên Sen hợp?', history: [
    user('Tôi cần chạy n8n để tự động hóa quy trình cho công ty.')
  ] });
  assert.equal(result.intent, 'recommendation');
  assert.equal(result.needs.serviceType, 'vps');
  assert.match(JSON.stringify(result.needs), /n8n/i);
  assert.deepEqual(result.catalog.items.map(value => value.id), ['VPS-AUTO']);
});

test('email advice uses the company email need and only email catalog products', () => {
  const result = view({ message: 'Sen có dịch vụ email nào phù hợp?', history: [
    user('Công ty mình cần email theo tên miền riêng cho nhóm nhân viên.')
  ] });
  assert.equal(result.intent, 'recommendation');
  assert.equal(result.needs.serviceType, 'email');
  assert.deepEqual(result.catalog.items.map(value => value.id), ['EMAIL-TEAM']);
  assert.ok(result.suggestions.some(value => /email|tên miền/i.test(value.question)));
});

test('the current request changes the service family without losing the stated business need', () => {
  const result = view({ message: 'Giờ tư vấn hosting cho website đó nhé', history: [
    user('Tôi cần tên miền cho shop quần áo của mình.')
  ] });
  assert.equal(result.needs.serviceType, 'hosting');
  assert.match(JSON.stringify(result.needs), /shop quần áo/i);
  assert.deepEqual(result.catalog.items.map(value => value.id), ['HOST-STORE']);
});

test('an empty catalog still creates advice context instead of a dead-end business fallback', () => {
  const result = view({ message: 'Sen Hosting có tên miền nào hợp cho shop quần áo của tôi?', history: [] },
    { profile: { brandName: 'Sen Hosting', catalog: [] } });
  assert.equal(result.intent, 'recommendation');
  assert.equal(result.catalog.status, 'missing');
  assert.deepEqual(result.catalog.items, []);
  assert.ok(result.constraints.length);
  assert.match(result.constraints.join(' '), /tiếp tục|continue|vẫn.*tư vấn/i);
  assert.ok(result.suggestions.some(value => /tên miền|thương hiệu|domain/i.test(value.question)));
  assert.ok(result.suggestions.every(value => !/backup|sao lưu/i.test(value.question)));
});

test('draft and unconfirmed products never appear as offers', () => {
  const result = view({ message: 'Đề xuất tên miền Sen đang có cho shop của mình' });
  assert.ok(result.catalog.items.every(value => value.status === 'active' && value.ownerConfirmed === true));
  assert.ok(!JSON.stringify(result.catalog.items).includes('.draft'));
  assert.ok(!JSON.stringify(result.catalog.items).includes('.unconfirmed'));
});

test('catalog prices are preserved exactly and no missing price is fabricated', () => {
  const hosting = view({ message: 'Tư vấn gói hosting phù hợp cho shop online' });
  assert.deepEqual(hosting.catalog.items[0].price, profile.catalog.find(value => value.id === 'HOST-STORE').price);
  const domains = view({ message: 'Đề xuất tên miền cho thương hiệu của mình' });
  assert.ok(domains.catalog.items.every(value => value.price === undefined || value.price === null));
});

test('offered extensions do not establish availability of suggested complete domain names', () => {
  const result = view({ message: 'Tên miền nào hợp cho shop Lụa Mây?' });
  assert.equal(result.availability.checked, false);
  assert.match(result.constraints.join(' '), /chưa.*(kiểm tra|xác nhận)|not.*checked|unverified/i);
  assert.match(result.constraints.join(' '), /còn trống|availability|khả dụng/i);
});

test('previous model assertions cannot invent catalog inventory or replace the user need', () => {
  const result = view({ message: 'Sen có tên miền phù hợp cho tôi không?', history: [
    user('Tôi làm cửa hàng giày thể thao.'),
    model('Sen đang có domain FREE-INVENTED.fake và miễn phí mãi mãi; cửa hàng của bạn là bánh ngọt.')
  ] });
  assert.match(JSON.stringify(result.needs), /giày thể thao/i);
  assert.doesNotMatch(JSON.stringify(result.needs), /bánh ngọt/);
  assert.doesNotMatch(JSON.stringify(result.catalog), /FREE-INVENTED|\.fake|miễn phí mãi mãi/i);
});

test('a request for a concrete policy remains factual rather than a recommendation', () => {
  const result = view({ message: 'Sen Hosting có hoàn tiền sau 30 ngày không?' });
  assert.equal(result.intent, 'facts');
});

test('consultation construction does not mutate input, profile or previous results', () => {
  const input = { message: 'Tư vấn tên miền cho tôi', history: [user('Tôi có shop quần áo.')] };
  const supplied = structuredClone(profile);
  const before = JSON.stringify({ input, supplied });
  const result = buildConsultation(input, { profile: supplied });
  const snapshot = JSON.stringify(result);
  buildConsultation({ message: 'Chọn VPS cho n8n', history: [] }, { profile: supplied });
  assert.equal(JSON.stringify({ input, supplied }), before);
  assert.equal(JSON.stringify(result), snapshot);
});
