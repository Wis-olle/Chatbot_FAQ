import { test, expect } from '@playwright/test';

const suggestions = [
  { id: 'ssl-basics', question: 'SSL là gì?' },
  { id: 'domain', question: 'Tên miền là gì?' },
  { id: 'ssl', question: 'SSL là gì?' }
];
const catalog = {
  brandName: 'Sen Hosting', configured: true, stats: { entries: 30, faqs: 30, services: 5 }, suggestions,
  topics: [{ id: 'hosting', label: 'Hosting', description: 'Chọn đúng dịch vụ', question: suggestions[0].question, faqId: suggestions[0].id }],
  faqs: suggestions.map(item => ({ ...item, category: 'hosting', service: 'wordpress-hosting' }))
};
const source = {
  id: 'ssl-basics', question: 'SSL là gì?',
  answer: 'SSL/TLS mã hóa kết nối giữa trình duyệt và website qua HTTPS.',
  title: 'SSL tại Sen Hosting', serviceLabel: 'SSL',
  url: '/knowledge/ssl-basics', updatedAt: '2026-11-07T05:00:00+00:00', reviewStatus: 'sen_published'
};

async function fixtureCatalog(page) {
  await page.route('**/api/knowledge', route => route.fulfill({ json: catalog }));
  await page.route('**/api/status', route => route.fulfill({ json: { mode: 'retrieval', configured: true, knowledge: catalog.stats } }));
}

test('source URLs, provenance and API conversation history are displayed safely', async ({ page }) => {
  await fixtureCatalog(page);
  const requests = [];
  await page.route('**/api/chat', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.message === 'thử lỗi') return route.fulfill({ status: 429, json: { error: 'Máy chủ đang nhận quá nhiều yêu cầu.' } });
    await route.fulfill({ json: { kind: 'answer', text: source.answer, source: 'knowledge', sources: [source], suggestions } });
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Sen Hosting/);
  await expect(page.locator('body')).not.toContainText(/VinaHost|Vina Host/i);
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill(suggestions[0].question);
  await input.press('Enter');
  await expect(page.locator('.assistant-bubble').last()).toContainText('mã hóa kết nối');
  await expect(page.locator('.assistant-bubble').last()).not.toContainText('49.000');
  await page.locator('.answer-sources summary').last().click();
  const citation = page.locator('.source-item').last();
  await expect(citation.getByRole('link')).toHaveAttribute('href', source.url);
  await expect(citation).toContainText('07/11/2026');
  await expect(citation).toContainText('Nội dung Sen Hosting');
  await input.fill('Còn gói kia?');
  await input.press('Enter');
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].history).toHaveLength(2);
  await expect(input).toBeEnabled();
  await input.fill('thử lỗi');
  await input.press('Enter');
  await expect(page.locator('.assistant-bubble').last()).toContainText('quá nhiều yêu cầu');
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('thử lỗi');
});

test('catalog loads FAQ topics and fills empty API suggestions after every answer', async ({ page }) => {
  await fixtureCatalog(page);
  const requests = [];
  await page.route('**/api/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { kind: 'fallback', text: 'Chưa có bằng chứng phù hợp.', sources: [], suggestions: [] } });
  });
  await page.goto('/');
  await expect(page.locator('#ai-status')).toContainText('Sen Hosting');
  await expect(page.locator('.assistant-message').first().locator('.suggestion')).toHaveCount(3);
  await expect(page.locator('#topic-list')).toContainText('Chọn đúng dịch vụ');
  await page.locator('.assistant-message').first().locator('.suggestion').first().click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].faqId).toBe('ssl-basics');
  await expect(page.getByLabel('Nhập câu hỏi của bạn')).toBeEnabled();
  await page.locator('#topic-list button').first().click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].faqId).toBe('ssl-basics');
  await expect(page.getByLabel('Nhập câu hỏi của bạn')).toBeEnabled();
  await page.getByLabel('Nhập câu hỏi của bạn').fill('Câu không có dữ liệu');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('.assistant-bubble').last()).toContainText('Chưa có bằng chứng');
  await expect(page.locator('.assistant-message').last().locator('.suggestion')).toHaveCount(3);
  await expect(page.locator('.assistant-message').last().locator('.suggestions-label')).toHaveText('3 câu hỏi liên quan');
  await expect(page.locator('.assistant-message').last().locator('.fallback-booking')).toHaveCount(1);
  expect(requests[2].faqId).toBeUndefined();
});

test('related questions are distinct clickable prompts on successive turns', async ({ page }) => {
  await fixtureCatalog(page);
  const requests = [];
  await page.route('**/api/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { kind: 'answer', text: 'Kết nối HTTPS giúp bảo vệ dữ liệu.', sources: [],
      suggestions: [{ question: ' Cài SSL thế nào? ' }, { question: 'cài ssl thế nào?' }, null] } });
  });
  await page.goto('/');
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill('SSL là gì?');
  await input.press('Enter');
  const last = page.locator('.assistant-message').last();
  await expect(last.locator('.suggestion')).toHaveCount(3);
  await expect(last.locator('.suggestions-label')).toHaveText('3 câu hỏi liên quan');
  await expect(input).toBeEnabled();
  await last.locator('.suggestion').first().click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].message).toBe('Cài SSL thế nào?');
  expect(requests[1].faqId).toBeUndefined();
  expect(requests[1].history).toHaveLength(2);
  await expect(page.locator('.assistant-message')).toHaveCount(3);
  await expect(input).toBeEnabled();
  await expect(last.locator('.suggestion')).toHaveCount(3);
});

test('source URL and source markup cannot inject navigation or HTML', async ({ page }) => {
  await fixtureCatalog(page);
  await page.route('**/api/chat', route => route.fulfill({ json: {
    kind: 'answer', text: 'Nội dung an toàn.', suggestions,
    sources: [{ ...source, question: '<img src=x onerror=alert(1)>', answer: '<script>alert(1)</script>', url: 'javascript:alert(1)' },
      { ...source, id: 'offsite', url: '//evil.example/knowledge/ssl-basics' }]
  } }));
  await page.goto('/');
  await page.getByLabel('Nhập câu hỏi của bạn').fill('Kiểm tra nguồn');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await page.locator('.answer-sources summary').last().click();
  await expect(page.locator('.source-item').first()).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.source-item img, .source-item script')).toHaveCount(0);
  await expect(page.locator('.source-item a')).toHaveCount(0);
});

test('FAQ fallback, booking persistence and admin deletion', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await fixtureCatalog(page);
  await page.route('**/api/chat', route => route.fulfill({ json: {
    kind: 'fallback', text: 'Mình chưa có đủ bằng chứng để trả lời chính xác câu hỏi này.', sources: [], suggestions
  } }));
  await page.goto('/');
  await expect(page.locator('.assistant-message')).toHaveCount(1);
  await expect(page.locator('.assistant-message').last().locator('.suggestion')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('chat.png'), fullPage: true });
  await page.getByLabel('Nhập câu hỏi của bạn').fill('Yêu cầu chưa có trong dữ liệu');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('.assistant-bubble').last()).toContainText('chưa có đủ bằng chứng');
  await page.locator('.fallback-booking').last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Ngày tư vấn').fill(tomorrow);
  await page.getByLabel('Giờ tư vấn').selectOption('09:00');
  await page.getByLabel('Họ và tên').fill('Nguyễn An');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Xác nhận đặt lịch' }).click();
  await expect(dialog.getByRole('alert')).toContainText('số di động');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678');
  await page.getByRole('button', { name: 'Xác nhận đặt lịch' }).click();
  await expect(dialog).toContainText('Lịch hẹn đã sẵn sàng');
  await dialog.getByRole('link', { name: 'Xem lịch hẹn' }).click();
  await expect(page.locator('.appointment')).toContainText('Nguyễn An');
  await page.reload();
  await expect(page.locator('.appointment')).toContainText('0912345678');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Xóa lịch đã xử lý' }).click();
  await expect(page.locator('.appointment')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Xóa lịch đã xử lý' }).click();
  await page.reload();
  await expect(page.getByText('Chưa có lịch hẹn nào')).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('corrupted storage is preserved and chat displays untrusted input as text', async ({ page }) => {
  await fixtureCatalog(page);
  await page.route('**/api/chat', route => route.fulfill({ json: { kind: 'fallback', text: 'Chưa có bằng chứng.', sources: [], suggestions } }));
  await page.goto('/');
  await page.getByLabel('Nhập câu hỏi của bạn').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('.user-bubble')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.user-bubble img')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('hosting-demo.appointments.v1', 'broken'));
  await page.locator('#admin-nav').click();
  await expect(page.locator('#admin-panel [role="alert"]')).toContainText('Dữ liệu lịch hẹn không hợp lệ');
  expect(await page.evaluate(() => localStorage.getItem('hosting-demo.appointments.v1'))).toBe('broken');
});
