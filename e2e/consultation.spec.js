import { test, expect } from '@playwright/test';
import { generateReply } from '../ai.js';
import { getKnowledge } from '../knowledge.js';

const knowledge = getKnowledge();
const response = output => Response.json({ candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({kind:'answer',sourceIds:[],relatedIds:[],...output})}]}}] });

test('shop conversation flows into real catalog recommendations and unchecked name ideas', async ({ page }) => {
  let lastRequest;
  await page.route('**/api/chat', async route => {
    const input = route.request().postDataJSON();
    lastRequest = input;
    const reply = await generateReply(input, { key:'test', knowledge, fetcher:async(url, options) => {
      const context = JSON.parse(JSON.parse(options.body).contents.at(-1).parts[0].text).CONSULTATION;
      expect(JSON.stringify(context.needs)).toContain('Lụa Mây');
      const selected = context.catalog.items.filter(item=>['.com','.vn'].includes(item.name));
      expect(selected).toHaveLength(2);
      return response({text:'Với shop quần áo Lụa Mây, mình ưu tiên tên ngắn, dễ đọc. .com dễ nhớ còn .vn phù hợp khi tập trung khách Việt. Bạn có thể cân nhắc luamay.com hoặc luamay.vn, hiện chưa kiểm tra còn trống.',
        recommendedItemIds:selected.map(item=>item.id),domainIdeas:[{name:'luamay.com',reason:'Giữ nguyên thương hiệu',availability:'unchecked'}],
        followUpQuestions:['Mình nên ưu tiên .com hay .vn cho shop này?']});
    } });
    await route.fulfill({json:reply});
  });
  await page.goto('/');
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill('Tôi mở shop quần áo tên Lụa Mây, muốn chọn tên miền phù hợp.');
  await input.press('Enter');
  await expect(page.locator('.recommendation-card')).toHaveCount(2);
  await expect(input).toBeEnabled();
  await input.fill('sen hosting có tên miền nào hợp với tôi k');
  await input.press('Enter');
  await expect(page.locator('.assistant-bubble').last()).toContainText('Lụa Mây');
  expect(lastRequest.history[0].text).toContain('shop quần áo');
  const last = page.locator('.assistant-message').last();
  await expect(last.locator('.recommendation-card')).toHaveCount(2);
  await expect(last.locator('.recommendation-card').first()).toContainText('370.000 đ');
  await expect(last.locator('.domain-ideas')).toContainText('Chưa kiểm tra còn trống');
  await expect(last.locator('.suggestion')).toContainText('.com hay .vn');
  await expect(last.locator('.fallback-booking')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('VPS automation advice uses the same needs and catalog composition', async ({ page }) => {
  await page.route('**/api/chat', async route => {
    const reply = await generateReply(route.request().postDataJSON(), { key:'test', knowledge, fetcher:async(url, options) => {
      const context = JSON.parse(JSON.parse(options.body).contents.at(-1).parts[0].text).CONSULTATION;
      expect(context.needs.serviceType).toBe('vps');
      const item = context.catalog.items.find(item=>item.service==='vps-n8n');
      expect(item).toBeTruthy();
      return response({text:'Để chạy n8n, mình sẽ chọn cấu hình theo số workflow và tần suất chạy. Đây là một gói n8n đang có trong danh mục để bạn cân nhắc.',
        recommendedItemIds:[item.id],domainIdeas:[],followUpQuestions:['Mình cần chạy bao nhiêu workflow cùng lúc?']});
    } });
    await route.fulfill({json:reply});
  });
  await page.goto('/');
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill('Tôi cần chạy n8n tự động hóa đơn hàng, Sen có VPS nào phù hợp?');
  await input.press('Enter');
  const last = page.locator('.assistant-message').last();
  await expect(last.locator('.recommendation-card')).toHaveCount(1);
  await expect(last.locator('.suggestion')).toContainText('workflow');
  await expect(last.locator('.fallback-booking')).toHaveCount(0);
});
