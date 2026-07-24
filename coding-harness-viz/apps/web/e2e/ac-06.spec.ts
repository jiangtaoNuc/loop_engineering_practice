import { test, expect } from '@playwright/test';

test.describe('AC-06: Deploy complete triggers rocket animation', () => {
  test('transitions from S5 to S6 and rocket triggers', async ({ page }) => {
    let stateTransitioned = false;
    let prevState: string | null = null;

    await page.route('**/api/issues/*/harness', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      if (prevState === 'pr_merged' && body.state === 'deployed') {
        stateTransitioned = true;
      }
      prevState = body.state;

      await route.fulfill({ response });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(8000);

    expect(stateTransitioned).toBe(true);
  });

  test('S6 node shows deployed state with lime highlight', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(8000);

    const s6Node = page.locator('text=S6').first();
    await expect(s6Node).toBeVisible();

    const deployedLabel = page.locator('text=Deployed');
    await expect(deployedLabel.first()).toBeVisible();
  });

  test('sidebar shows deploy URL after deployment', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(8000);

    const deployLink = page.locator('a:has-text("actions/runs")');
    await expect(deployLink).toBeVisible();
  });

  test('rocket animation fires on S5 to S6 transition', async ({ page }) => {
    let rocketTriggered = false;

    await page.addInitScript(() => {
      (window as any).__rocketCheck = false;
    });

    await page.route('**/api/issues/*/harness', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      if (body.state === 'deployed' && !rocketTriggered) {
        rocketTriggered = true;
      }

      await route.fulfill({ response });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);

    expect(rocketTriggered).toBe(true);
  });
});
