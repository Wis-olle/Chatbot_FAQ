import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConsultation } from '../consultation.js';
import { consultationResponse } from '../consultation-response.js';

const items = [
  { id:'SEN-PLAN-A', name:'Gói A', type:'hosting', status:'active', ownerConfirmed:true,
    description:'Gói cơ bản', specs:{ RAM:'2 GB', CPU:'1 vCPU' }, price:{display:'100.000đ/tháng',amount:100000,billingPeriod:'tháng'} },
  { id:'SEN-PLAN-B', name:'Gói B', type:'hosting', status:'active', ownerConfirmed:true,
    description:'Gói nâng cao', specs:{ RAM:'8 GB', CPU:'4 vCPU' }, price:{display:'200.000đ/tháng',amount:200000,billingPeriod:'tháng'} }
];
const context = () => buildConsultation({ message:'Tư vấn hosting phù hợp cho blog của mình',
  history:[{role:'user',text:'Nhóm mình có 5 người và chạy 2 workflow.'}] }, {profile:{catalog:items}});
const output = text => ({text,recommendedItemIds:['SEN-PLAN-A'],domainIdeas:[]});

test('a valid recommended product ID does not authorize invented backup, SLA or refund promises', () => {
  for (const text of [
    'Gói A được sao lưu 99 lần/ngày.',
    'Gói A cam kết uptime 100%.',
    'Sen Hosting hoàn tiền trong 365 ngày cho Gói A.'
  ]) {
    const reply = consultationResponse(output(text), context());
    assert.notEqual(reply.text, text, text);
    assert.doesNotMatch(reply.text, /99 lần|100%|365 ngày/);
    assert.equal(reply.kind, 'answer');
    assert.deepEqual(reply.recommendations.map(item=>item.id), ['SEN-PLAN-A']);
  }
});

test('another unselected plan price cannot be quoted for the selected product', () => {
  const text = 'Gói A có giá 200.000đ/tháng.';
  const reply = consultationResponse(output(text), context());
  assert.notEqual(reply.text, text);
  assert.doesNotMatch(reply.text, /200\.000/);
  assert.equal(reply.recommendations[0].price.display, '100.000đ/tháng');
});

test('short-form invented prices cannot bypass catalog price validation', () => {
  for (const text of ['Gói A chỉ có 1k/tháng.', 'Gói A chỉ có 1 nghìn đồng/tháng.']) {
    const reply = consultationResponse(output(text), context());
    assert.notEqual(reply.text, text, text);
  }
});

test('another unselected plan specifications cannot be assigned to the selected product', () => {
  const text = 'Gói A có RAM 8 GB và 4 vCPU nên phù hợp nhu cầu của bạn.';
  const reply = consultationResponse(output(text), context());
  assert.notEqual(reply.text, text);
  assert.doesNotMatch(reply.text, /8 GB|4 vCPU/);
  assert.equal(reply.recommendations[0].specs.RAM, '2 GB');
});

test('user workload numbers remain allowed in ordinary recommendation reasoning', () => {
  const text = 'Với nhóm 5 người và 2 workflow như bạn đã chia sẻ, mình sẽ cân nhắc Gói A để bắt đầu rồi theo dõi tài nguyên thực tế.';
  const reply = consultationResponse(output(text), context());
  assert.equal(reply.text, text);
});

test('domain availability cannot be asserted in free text or domain-idea reasons', () => {
  const domainContext = buildConsultation({message:'Gợi ý tên miền cho shop của mình'}, {profile:{catalog:[]}});
  const plain = consultationResponse({text:'Tên mayshop.com còn trống.',recommendedItemIds:[],domainIdeas:[]}, domainContext);
  assert.doesNotMatch(plain.text, /mayshop\.com còn trống/);
  const reply = consultationResponse({text:'Đây là một ý tưởng phù hợp cho thương hiệu của bạn.',recommendedItemIds:[],
    domainIdeas:[{name:'mayshop.com',reason:'Tên này chắc chắn còn trống, đăng ký ngay.',availability:'available'}]}, domainContext);
  assert.equal(reply.domainIdeas[0].availability, 'unchecked');
  assert.doesNotMatch(reply.domainIdeas[0].reason, /chắc chắn còn trống|đăng ký ngay/);
});
