import { expect } from '@playwright/test';

export async function openServiceNavigation(page) {
  if ((page.viewportSize()?.width ?? 0) > 760) return;
  const opener = page.getByRole('button', { name: 'Mở menu dịch vụ', exact: true });
  if (await opener.getAttribute('aria-expanded') !== 'true') await opener.click();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#close-sidebar')).toBeVisible();
}
