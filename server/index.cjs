const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const TESTS_DIR = path.join(__dirname, 'tests');
if (!fs.existsSync(TESTS_DIR)) fs.mkdirSync(TESTS_DIR);

// Run Playwright test
app.post('/api/run', async (req, res) => {
  try {
    const { code, url } = req.body;
    if (!code || !url) return res.status(400).json({ error: 'Missing code or URL' });
    const testFile = path.join(TESTS_DIR, 'temp.spec.ts');
    const testCode = `import { test, expect } from '@playwright/test';\ntest('User test', async ({ page }) => {\n  await page.goto('${url}');\n${code}\n});`;
    fs.writeFileSync(testFile, testCode, 'utf8');
    exec(`npx playwright test ${testFile} --project=chromium --reporter=line`, (err, stdout, stderr) => {
      fs.unlinkSync(testFile);
      if (err) {
        const output = stderr || stdout || '';
        const suggestions = [];
        if (/Timeout.*exceeded|timed out/i.test(output)) suggestions.push('Timeout exceeded: The page may be slow or selector may not exist.');
        if (/not found|No node found|Unable to locate element|waiting for selector/i.test(output)) suggestions.push('Selector not found: Check your selector.');
        if (/expect.*failed|AssertionError|assertion failed/i.test(output)) suggestions.push('Assertion failed: Check your assertions and page state.');
        if (suggestions.length === 0) suggestions.push('Check the error message and your code.');
        return res.json({ success: false, output, suggestions });
      }
      res.json({ success: true, output: stdout, suggestions: [] });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save test
app.post('/api/save', (req, res) => {
  const { name, code, url, gherkin } = req.body;
  if (!name || !code || !url) return res.status(400).json({ error: 'Missing fields' });
  const file = path.join(TESTS_DIR, `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  fs.writeFileSync(file, JSON.stringify({ name, code, url, gherkin }, null, 2));
  res.json({ success: true });
});

// List saved tests
app.get('/api/tests', (req, res) => {
  const files = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.json'));
  const tests = files.map(f => {
    const data = fs.readFileSync(path.join(TESTS_DIR, f));
    return JSON.parse(data);
  });
  res.json({ tests });
});

const PORT = 5174;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
