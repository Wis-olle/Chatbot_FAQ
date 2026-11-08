import { test, expect } from '@playwright/test';

test('live Sen Hosting explains hosting and domain using its own knowledge page', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Sen Hosting/);
  await expect(page.locator('#ai-status')).toContainText('Sen Hosting');
  await expect(page.locator('body')).not.toContainText(/VinaHost|Vina Host/i);
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill('Hosting và tên miền khác nhau thế nào?');
  await input.press('Enter');
  await expect(page.locator('.assistant-bubble').last()).toContainText(/địa chỉ|tên miền/i);
  await expect(page.locator('.assistant-bubble').last()).toContainText(/lưu trữ|tài nguyên|hosting/i);
  await expect(page.locator('.assistant-bubble').last()).not.toContainText(/VinaHost|Starter|49.000|99.000/i);
  await page.locator('.answer-sources summary').last().click();
  const source = page.locator('.source-item a').first();
  await expect(source).toHaveAttribute('href', /^\/knowledge\/[A-Za-z0-9_-]+$/);
  const popupPromise = page.waitForEvent('popup');
  await source.click();
  const popup = await popupPromise;
  await expect(popup).toHaveTitle(/Sen Hosting/);
  await expect(popup.locator('body')).not.toContainText(/VinaHost|Vina Host/i);
  await popup.close();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'desktop') {
    await page.locator('.conversation').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/sen-hosting-desktop.png', fullPage: true });
  }
});

test('Sen Hosting does not adopt another provider backup promises and unknown requests fall back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ai-status')).toContainText('Sen Hosting');
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill('WordPress Hosting sao lưu bao nhiêu lần?');
  await input.press('Enter');
  await expect(page.locator('.assistant-bubble').last()).toContainText(/xác nhận|cập nhật|nhân viên|dịch vụ/);
  await expect(page.locator('.assistant-bubble').last()).not.toContainText(/4 lần|VinaHost/i);
  await input.fill('Sen Hosting bán vé máy bay đi Sao Hỏa giá bao nhiêu?');
  await input.press('Enter');
  await expect(page.locator('.assistant-message').last().locator('.fallback-booking')).toHaveCount(1);
  await expect(page.locator('.assistant-message').last().locator('.answer-sources')).toHaveCount(0);
});
