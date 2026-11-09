import { test, expect } from '@playwright/test';
import { openServiceNavigation } from './navigation-helpers.js';

async function stubChat(page, text = 'Mình sẽ giúp bạn chọn dịch vụ theo nhu cầu.') {
  const requests = [];
  await page.route('**/api/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { kind: 'answer', text, sources: [], suggestions: [] } });
  });
  return requests;
}

test('desktop keeps service navigation visible while mobile uses a menu button', async ({ page }) => {
  await page.goto('/');
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  const opener = page.getByRole('button', { name: 'Mở menu dịch vụ', exact: true });
  if (mobile) {
    await expect(opener).toBeVisible();
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#sidebar-backdrop')).toBeHidden();
  } else {
    await expect(opener).toBeHidden();
    await expect(page.locator('#app-sidebar')).toBeVisible();
    await expect(page.locator('#topic-list button')).toHaveCount(7);
  }
});

test('mobile drawer blocks background interaction and restores focus after closing', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 760, 'Mobile drawer behavior');
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Mở menu dịch vụ', exact: true });
  const main = page.locator('#main');
  await expect(main).toHaveJSProperty('inert', false);
  await openServiceNavigation(page);
  await expect(main).toHaveJSProperty('inert', true);
  await expect(page.locator('#sidebar-backdrop')).toBeVisible();
  await expect(page.locator('#close-sidebar')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.getElementById('app-sidebar').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(main).toHaveJSProperty('inert', false);
  await expect(page.locator('#sidebar-backdrop')).toBeHidden();
  await expect(opener).toBeFocused();
  await openServiceNavigation(page);
  await page.getByRole('button', { name: 'Đóng menu dịch vụ', exact: true }).click();
  await expect(opener).toBeFocused();
  await expect(main).toHaveJSProperty('inert', false);
});

test('selecting a service closes the mobile menu and sends its consultation prompt', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 760, 'Mobile drawer selection');
  const requests = await stubChat(page);
  await page.goto('/');
  await openServiceNavigation(page);
  await page.locator('#topic-list').getByRole('button', { name: /VPS n8n/ }).click();
  await expect(page.locator('#open-sidebar')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#main')).toHaveJSProperty('inert', false);
  await expect(page.locator('.assistant-message')).toHaveCount(2);
  expect(requests).toHaveLength(1);
  expect(requests[0].message).toBe('Tư vấn các gói VPS n8n của Sen Hosting');
  expect(requests[0].faqId).toBeUndefined();
  await expect(page.locator('#chat-page')).toHaveAttribute('data-state', 'conversation');
});

test('theme selection persists across reloads and can return to light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Chuyển sang giao diện tối', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('hosting-demo.theme.v1'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Chuyển sang giao diện sáng', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('hosting-demo.theme.v1'))).toBe('light');
});

test('service and FAQ choices from appointments return to the visible conversation', async ({ page }) => {
  const requests = await stubChat(page);
  for (const type of ['service', 'faq']) {
    await page.goto('/#admin');
    await expect(page.locator('#admin-page')).toBeVisible();
    await openServiceNavigation(page);
    if (type === 'service') await page.locator('#topic-list button').first().click();
    else {
      await page.locator('#all-faq-button').click();
      await page.locator('#all-faq-list button').first().click();
    }
    await expect(page).toHaveURL(/#chat$/);
    await expect(page.locator('#chat-page')).toBeVisible();
    await expect(page.locator('#admin-page')).toBeHidden();
    await expect(page.locator('.assistant-bubble').last()).toContainText('Mình sẽ giúp bạn chọn dịch vụ');
    await expect(page.locator('#message-input')).toBeEnabled();
  }
  expect(requests).toHaveLength(2);
});

test('composer remains in the viewport after long replies and reset restores the welcome screen', async ({ page }, testInfo) => {
  const text = Array.from({ length: 90 }, (_, index) => `Đoạn ${index + 1}: Mình sẽ tư vấn cấu hình và nhu cầu sử dụng phù hợp với website của bạn.`).join('\n\n');
  await stubChat(page, text);
  await page.goto('/');
  await expect(page.locator('#chat-page')).toHaveAttribute('data-state', 'welcome');
  const input = page.getByLabel('Nhập câu hỏi của bạn');
  await input.fill('Tôi muốn tư vấn hosting cho website.');
  await input.press('Enter');
  await expect(page.locator('.assistant-bubble').last()).toContainText('Đoạn 90:');
  await expect(input).toBeEnabled();
  await expect(page.locator('#chat-page')).toHaveAttribute('data-state', 'conversation');
  const dimensions = await page.locator('#chat-form').evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: innerWidth, height: innerHeight };
  });
  expect(dimensions.top).toBeGreaterThanOrEqual(0);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.height);
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('conversation-layout.png'), fullPage: true });
  await page.getByRole('button', { name: 'Bắt đầu cuộc trò chuyện mới', exact: true }).click();
  await expect(page.locator('#chat-page')).toHaveAttribute('data-state', 'welcome');
  await expect(page.locator('.user-message')).toHaveCount(0);
  await expect(page.locator('.assistant-message')).toHaveCount(1);
  await expect(input).toHaveValue('');
});
