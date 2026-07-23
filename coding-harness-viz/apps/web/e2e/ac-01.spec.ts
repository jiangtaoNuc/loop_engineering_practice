import { test, expect } from '@playwright/test';

test.describe('AC-01: New issue lights up S1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('S1 node shows heartbeat animation', async ({ page }) => {
    const s1Node = page.locator('text=S1').first();
    await expect(s1Node).toBeVisible();
    const nodeCard = s1Node.locator('..');
    const animation = await nodeCard.evaluate((el) => {
      return window.getComputedStyle(el).animationName;
    });
    expect(animation).toContain('heartbeat');
  });

  test('S2-S6 nodes are greyed out (pending)', async ({ page }) => {
    for (const label of ['S2', 'S3', 'S4', 'S5', 'S6']) {
      const node = page.locator(`text=${label}`).first();
      await expect(node).toBeVisible();
    }
    const pendingNodes = page.locator('[style*="var(--ink-muted)"]');
    const count = await pendingNodes.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('issue tab bar shows the mock issue', async ({ page }) => {
    const tab = page.locator('text=MOCK-01');
    await expect(tab).toBeVisible();
  });

  test('sidebar shows CREATED STATE and no assignee', async ({ page }) => {
    const stateLabel = page.locator('text=Issue Created');
    await expect(stateLabel.first()).toBeVisible();
    const assigneeSection = page.locator('text=ASSIGNEE');
    await expect(assigneeSection).toHaveCount(0);
  });

  test('URL contains issue parameter', async ({ page }) => {
    await expect(page).toHaveURL(/.*issue=MOCK-01/);
  });
});
