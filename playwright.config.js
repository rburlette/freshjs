import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1,
  use: {baseURL: 'http://127.0.0.1:8080'},
  projects: [{name: 'chromium', use: {browserName: 'chromium', launchOptions: {executablePath: process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'] : []}}}, {name: 'firefox', use: {browserName: 'firefox'}}, {name: 'webkit', use: {browserName: 'webkit'}}],
  webServer: {command: 'node scripts/server.mjs', url: 'http://127.0.0.1:8080/tests/', reuseExistingServer: !process.env.CI}
});
