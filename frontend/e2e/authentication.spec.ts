import { expect, test } from "@playwright/test";

test("student sees a safe authentication error from the browser UI", async ({ page }) => {
  await page.route("http://localhost:8000/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Invalid email or password" }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.locator("form").getByRole("button", { name: "Sign In to Workspace" }).click();

  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  await expect(page.getByRole("heading", { name: "Welcome back to your passport." })).toBeVisible();
});
