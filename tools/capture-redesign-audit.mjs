import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(".env") });
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/hotelos?schema=public";
const baseUrl = process.env.LAFLO_AUDIT_URL || "http://127.0.0.1:4212";
const outputDir = path.resolve(".artifacts/redesign-completion-audit");
await fs.mkdir(outputDir, { recursive: true });

const routes = [
  ["04-dashboard", "/"],
  ["05-bookings", "/bookings"],
  ["06-guests", "/guests"],
  ["07-rooms", "/rooms"],
  ["08-housekeeping", "/housekeeping"],
  ["09-maintenance", "/maintenance-center"],
  ["10-incidents", "/incidents"],
  ["11-security", "/security-center"],
  ["12-smart-building", "/operations/smart-building"],
  ["13-concierge", "/concierge"],
  ["14-messages", "/messages"],
  ["15-calls", "/calls"],
  ["16-reviews", "/reviews"],
  ["17-inventory", "/inventory"],
  ["18-calendar", "/calendar"],
  ["19-financials", "/financials"],
  ["20-reports", "/reports"],
  ["21-enterprise-search", "/operations-center/search"],
  ["22-hotel-brain", "/ai/hotel-brain"],
  ["23-users", "/users"],
  ["24-settings", "/settings"],
  ["25-integration-manager", "/settings?tab=integrations"],
  ["26-operations-center", "/operations-center"],
];

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
const authResponses = [];
let page;

function observe(targetPage) {
  targetPage.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ url: targetPage.url(), text: message.text() });
  });
  targetPage.on("pageerror", (error) => consoleErrors.push({ url: targetPage.url(), text: error.message }));
  targetPage.on("response", async (response) => {
    if (!response.url().includes("/auth/")) return;
    try {
      authResponses.push({ url: response.url(), status: response.status(), body: await response.json() });
    } catch {
      authResponses.push({ url: response.url(), status: response.status(), body: null });
    }
  });
}

async function capture(name, url, fullPage = true) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  const screenshotPath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage });
  return {
    name,
    requestedUrl: url,
    finalUrl: page.url(),
    title: await page.title(),
    body: body.slice(0, 1600),
    screenshotPath,
  };
}

const results = [];
const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
page = await publicContext.newPage();
observe(page);
results.push(await capture("01-login", `${baseUrl}/login`));
results.push(await capture("02-request-access", `${baseUrl}/request-access`));
results.push(await capture("03-reset-password", `${baseUrl}/reset-password?email=admin%40demo.hotel`));
await publicContext.close();

const prisma = new PrismaClient();
const admin = await prisma.user.findUnique({
  where: { email: "admin@demo.hotel" },
  select: {
    id: true, email: true, firstName: true, lastName: true, role: true, department: true,
    hotelId: true, isActive: true, mustChangePassword: true, modulePermissions: true,
    hotel: { select: { id: true, name: true, currency: true, timezone: true } },
  },
});
if (!admin) throw new Error("Local seeded admin user was not found");
const accessToken = jwt.sign(
  { userId: admin.id, email: admin.email, role: admin.role, hotelId: admin.hotelId },
  process.env.JWT_SECRET || "default-secret-change-in-production",
  { expiresIn: "30m" },
);
await prisma.$disconnect();

const authenticatedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await authenticatedContext.addInitScript(({ user, token }) => {
  localStorage.setItem("hotelos-auth", JSON.stringify({
    state: {
      user,
      accessToken: token,
      refreshToken: null,
      isAuthenticated: true,
    },
    version: 0,
  }));
}, { user: admin, token: accessToken });
page = await authenticatedContext.newPage();
observe(page);
const loginState = { finalUrl: `${baseUrl}/`, body: "Local seeded ADMIN session" };

for (const [name, route] of routes) {
  results.push(await capture(name, `${baseUrl}${route}`));
}

await page.setViewportSize({ width: 1024, height: 768 });
for (const [name, route] of [
  ["27-dashboard-small", "/"],
  ["28-bookings-small", "/bookings"],
  ["29-settings-small", "/settings"],
  ["30-integration-small", "/settings?tab=integrations"],
]) {
  results.push(await capture(name, `${baseUrl}${route}`, false));
}

await fs.writeFile(
  path.join(outputDir, "capture-report.json"),
  JSON.stringify({ baseUrl, loginState, authResponses, results, consoleErrors }, null, 2),
);
await authenticatedContext.close();
await browser.close();
console.log(JSON.stringify({ baseUrl, loginState, captures: results.length, consoleErrors: consoleErrors.length }, null, 2));
