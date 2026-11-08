import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReply, validateChat } from '../ai.js';

const profile = { brandName: 'Sen Hosting', catalog: [
  { id:'DOMAIN-COM', type:'domain', name:'Tên miền .com', extensions:['.com'], status:'active', ownerConfirmed:true },
  { id:'DOMAIN-VN', type:'domain', name:'Tên miền .vn', extensions:['.vn'], status:'active', ownerConfirmed:true },
  { id:'VPS-AUTO', type:'vps', name:'VPS Automation', useCases:['n8n'], status:'active', ownerConfirmed:true }
] };
const history = [
  { role:'user', text:'Tôi mở shop quần áo tên Lụa Mây, bán cho khách ở Việt Nam.' },
  { role:'model', text:'Mình có thể giúp bạn chọn hướng đặt tên miền cho thương hiệu.' }
];
const question = 'sen hosting có tên miền nào hợp với tôi k';
const context = (serviceType='domain', currentProfile=profile) => ({
  intent:'recommendation', needs:{purpose:serviceType==='vps'?'chạy n8n':'shop quần áo',brandName:'Lụa Mây',serviceType},
  catalog:{status:currentProfile.catalog.length?'available':'missing',items:currentProfile.catalog.filter(item=>item.type===serviceType)},
  availability:{checked:false}, constraints:['Tiếp tục tư vấn khi chưa có danh mục. Tên miền gợi ý chưa kiểm tra còn trống.'],
  suggestions:[{question:'Bạn muốn ưu tiên đuôi .com hay .vn?'}]
});
const knowledge = (currentProfile=profile) => ({
  retrieve:()=>({kind:'fallback',text:'Sen chưa có dữ liệu.',evidence:[],suggestions:[]}),
  forConsultation:input=>context(/vps/i.test(input.message)?'vps':'domain',currentProfile),
  catalog:()=>({suggestions:[{id:'BACKUP',question:'Backup là gì?'}],faqs:[],stats:{}})
});
const output = extra => ({kind:'answer',text:'Với shop Lụa Mây, tên ngắn và dễ đọc sẽ dễ nhớ hơn. Bạn có thể cân nhắc luamay.com; tên này chưa được kiểm tra còn trống.',
  sourceIds:[],relatedIds:[],recommendedItemIds:['DOMAIN-COM'],
  domainIdeas:[{name:'luamay.com',reason:'Dễ nhớ theo tên shop',availability:'unchecked'}],
  followUpQuestions:['Bạn muốn ưu tiên đuôi .com hay .vn?'],...extra});
const provider = value => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});

test('recommendation follows the customer purpose and approved catalog instead of stopping at a missing FAQ', async () => {
  let calls=0;
  const reply=await generateReply({message:question,history},{key:'test-key',profile,knowledge:knowledge(),fetcher:async(url,options)=>{
    calls++;
    const body=JSON.parse(options.body);
    const data=JSON.parse(body.contents.at(-1).parts[0].text);
    assert.ok(data.CONSULTATION);
    assert.equal(data.CONSULTATION.needs.serviceType,'domain');
    assert.match(JSON.stringify(data.CONSULTATION.needs),/shop quần áo|Lụa Mây/i);
    assert.deepEqual(data.CONSULTATION.catalog.items.map(item=>item.id).sort(),['DOMAIN-COM','DOMAIN-VN']);
    assert.equal(data.CONSULTATION.availability.checked,false);
    assert.ok(body.contents.some(turn=>JSON.stringify(turn).includes(history[0].text)));
    return provider(output());
  }});
  assert.equal(calls,1);
  assert.equal(reply.source,'gemini');
  assert.equal(reply.route,'consultation');
  assert.equal(reply.kind,'answer');
  assert.match(reply.text,/Lụa Mây/);
  assert.deepEqual(reply.recommendations.map(item=>item.id),['DOMAIN-COM']);
});

test('empty catalog still permits useful generated advice and asks a relevant next question', async () => {
  const empty={brandName:'Sen Hosting',catalog:[]};
  let calls=0;
  const reply=await generateReply({message:question,history},{key:'test',profile:empty,knowledge:knowledge(empty),fetcher:async(url,options)=>{
    calls++;
    const data=JSON.parse(JSON.parse(options.body).contents.at(-1).parts[0].text);
    assert.equal(data.CONSULTATION.catalog.status,'missing');
    assert.deepEqual(data.CONSULTATION.catalog.items,[]);
    return provider(output({recommendedItemIds:[],text:'Với shop Lụa Mây, bạn nên ưu tiên tên ngắn, dễ đọc và dễ gõ. Mình gợi ý luamay.com để tham khảo; cần kiểm tra khả dụng trước khi đăng ký.'}));
  }});
  assert.equal(calls,1);
  assert.equal(reply.source,'gemini');
  assert.notEqual(reply.kind,'fallback');
  assert.match(reply.text,/Lụa Mây/);
  assert.ok(reply.suggestions.some(item=>/\.com|\.vn|tên miền/i.test(item.question)));
  assert.ok(reply.suggestions.every(item=>!/backup|sao lưu/i.test(item.question)));
});

test('the same consultation generation works for VPS automation beyond the domain-shopping example', async () => {
  let calls=0;
  const reply=await generateReply({message:'Sen có VPS nào hợp với mình?',history:[{role:'user',text:'Tôi cần chạy n8n để tự động hóa quy trình.'}]},{
    key:'test',profile,knowledge:knowledge(),fetcher:async(url,options)=>{
      calls++;
      const data=JSON.parse(JSON.parse(options.body).contents.at(-1).parts[0].text);
      assert.equal(data.CONSULTATION.needs.serviceType,'vps');
      assert.match(JSON.stringify(data.CONSULTATION.needs),/n8n/i);
      assert.deepEqual(data.CONSULTATION.catalog.items.map(item=>item.id),['VPS-AUTO']);
      return provider(output({text:'Để chạy n8n, mình sẽ cân nhắc mức tài nguyên theo số workflow và tần suất chạy. VPS Automation có trong danh mục để đối chiếu nhu cầu.',recommendedItemIds:['VPS-AUTO'],domainIdeas:[],followUpQuestions:['Bạn dự kiến chạy bao nhiêu workflow n8n?']}));
    }
  });
  assert.equal(calls,1);
  assert.equal(reply.route,'consultation');
  assert.deepEqual(reply.recommendations.map(item=>item.id),['VPS-AUTO']);
  assert.ok(reply.suggestions.some(item=>/n8n|workflow/i.test(item.question)));
});

test('unlisted recommended products cannot be presented as confirmed Sen inventory', async () => {
  const reply=await generateReply({message:question,history},{key:'test',profile,knowledge:knowledge(),fetcher:async()=>provider(output({
    text:'Sen hiện có UNREGISTERED-FAKE cho bạn đăng ký ngay.',recommendedItemIds:['UNREGISTERED-FAKE'],domainIdeas:[]
  }))});
  assert.ok((reply.recommendations??[]).every(item=>profile.catalog.some(known=>known.id===item.id)));
  assert.doesNotMatch(reply.text,/UNREGISTERED-FAKE/);
});

test('a generated full domain name remains unverified even when its extension is offered', async () => {
  const reply=await generateReply({message:question,history},{key:'test',profile,knowledge:knowledge(),fetcher:async()=>provider(output({
    text:'luamay.com chắc chắn còn trống, đăng ký ngay.',
    domainIdeas:[{name:'luamay.com',reason:'Dễ nhớ',availability:'available'}]
  }))});
  assert.doesNotMatch(reply.text,/chắc chắn còn trống|đăng ký ngay/i);
  assert.ok(reply.domainIdeas?.length);
  assert.ok(reply.domainIdeas.every(idea=>idea.availability==='unchecked'));
});

test('recommendation metadata comes from approved catalog records rather than model-supplied prices and links', async () => {
  const reply=await generateReply({message:question,history},{key:'test',profile,knowledge:knowledge(),fetcher:async()=>provider(output({
    recommendations:[{id:'DOMAIN-COM',name:'Injected name',price:1,url:'https://evil.example/'}]
  }))});
  assert.equal(reply.recommendations[0].name,'Tên miền .com');
  assert.equal(reply.recommendations[0].price,undefined);
  assert.doesNotMatch(JSON.stringify(reply.recommendations),/Injected name|evil\.example/);
});

test('conversation validation retains enough turns for advice and rejects an excessive history', () => {
  const turns=Array.from({length:12},(_,index)=>({role:index%2?'model':'user',text:`Tin nhắn ${index}`}));
  assert.equal(validateChat({message:'Tiếp tục tư vấn nhé',history:turns}).history.length,12);
  assert.throws(()=>validateChat({message:'x',history:Array(21).fill({role:'user',text:'x'})}),/hợp lệ/);
});

test('mentioning a chosen plan does not turn a concrete policy question into open-ended advice', async () => {
  for (const message of ['Gói tôi chọn có hoàn tiền bao nhiêu ngày?', 'Gói tôi chọn sao lưu bao nhiêu lần?', 'Còn gói đã chọn cam kết uptime bao nhiêu?']) {
    let lookedUp = false;
    const reply = await generateReply({message,history:[{role:'user',text:'Tư vấn gói hosting phù hợp cho shop.'}]}, {key:'test', knowledge:{retrieve:()=>{
      lookedUp = true;
      return {kind:'fallback',text:'Cần xác nhận điều kiện của gói đã chọn.',evidence:[],suggestions:[]};
    }},fetcher:async()=>{assert.fail('missing concrete policy must not enter open advice');}});
    assert.equal(lookedUp,true);
    assert.equal(reply.kind,'fallback');
  }
});
