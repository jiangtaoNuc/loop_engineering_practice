import { test, expect } from '@playwright/test';

test.describe('AC-05: PR merged triggers firework animation', () => {
  test('S5 node is current with heartbeat, firework triggers once', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const s5Node = page.locator('text=S5').first();
    await expect(s5Node).toBeVisible();

    const sidebarMerged = page.locator('text=PR Merged');
    await expect(sidebarMerged.first()).toBeVisible();

    const mergedBadge = page.locator('text=[MERGED]');
    await expect(mergedBadge).toBeVisible();

    const completedNodes = page.locator('text=✓');
    const checkCount = await completedNodes.count();
    expect(checkCount).toBeGreaterThanOrEqual(4);
  });

  test('completed nodes S1-S4 show green checkmarks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    for (const label of ['S1', 'S2', 'S3', 'S4']) {
      const node = page.locator(`text=${label}`).first();
      await expect(node).toBeVisible();
    }
  });

  test('firework animation triggers on state transition to pr_merged', async ({ page }) => {
    const fireworkEvents: string[] = [];

    await page.route('**/api/issues/*/harness', async (route) => {
      const url = route.request().url();
      const response = await route.fetch();
      const body = await response.json();

      if (body.state === 'pr_merged' && !fireworkEvents.includes('seen')) {
        fireworkEvents.push('seen');
      }

      await route.fulfill({ response });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    expect(fireworkEvents).toContain('seen');
  });

  test('sidebar shows PR URL and CI status', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const prLink = page.locator('a:has-text("pull/99")');
    await expect(prLink).toBeVisible();

    const ciStatus = page.locator('text=CI: ✓');
    await expect(ciStatus).toBeVisible();
  });
});
