// End-to-end: page contact form <-> api/contact.php (PHP built-in server + stub PHPMailer; no real email).
// Usage: node tests/contact-form-e2e.mjs [path-to-php]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHP = process.argv[2] || 'C:\\xampp\\php\\php.exe';
const PORT = 8791;
const out = [];
const log = (ok, m) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${m}`);
if (existsSync(join(ROOT, '.env')) || existsSync(join(ROOT, 'vendor'))) { console.error('.env or vendor/ exists; refusing to overwrite'); process.exit(1); }

const stubDir = join(ROOT, 'vendor', 'phpmailer', 'phpmailer', 'src');
const setup = (host) => {
  mkdirSync(stubDir, { recursive: true });
  writeFileSync(join(stubDir, 'PHPMailer.php'), `<?php namespace PHPMailer\\PHPMailer; class PHPMailer { const ENCRYPTION_STARTTLS='tls'; const ENCRYPTION_SMTPS='ssl';
  public $Host,$Port,$SMTPAuth,$Username,$Password,$SMTPSecure,$SMTPAutoTLS,$CharSet,$Subject,$Body; public function __construct($e=false){}
  public function isSMTP(){} public function isHTML($v){} public function setFrom($a,$n=''){} public function addAddress($a,$n=''){} public function addReplyTo($a,$n=''){}
  public function send(){ if($this->Host==='fail.invalid') throw new \\Exception('stub failure'); file_put_contents(dirname(__DIR__,4).'/storage/test-outbox.json', json_encode(['body'=>$this->Body])); return true; } }`);
  writeFileSync(join(ROOT, 'vendor', 'autoload.php'), "<?php require __DIR__ . '/phpmailer/phpmailer/src/PHPMailer.php';\n");
  writeFileSync(join(ROOT, '.env'), `CONTACT_FORM_ENABLED=true\nCONTACT_TO_EMAIL=frontdesk@example.test\nSMTP_HOST=${host}\nSMTP_USER=u\nSMTP_PASS=p\nSMTP_FROM_EMAIL=web@example.test\n`);
};
const cleanup = () => { rmSync(join(ROOT, '.env'), { force: true }); rmSync(join(ROOT, 'vendor'), { recursive: true, force: true }); rmSync(join(ROOT, 'storage', 'test-outbox.json'), { force: true });
  for (const f of (await_list())) rmSync(join(ROOT, 'storage', f), { force: true }); };
import { readdirSync } from 'node:fs';
const await_list = () => readdirSync(join(ROOT, 'storage')).filter((f) => f.startsWith('rl_'));

const server = spawn(PHP, ['-S', `127.0.0.1:${PORT}`, '-t', ROOT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
try {
  // Disabled: form stays hidden, no console errors
  let page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  log(await page.isHidden('#contact-form'), 'not configured: contact form stays hidden');
  log(errs.length === 0, 'not configured: no JS errors');
  await page.close();

  // Enabled: form appears and sends
  setup('smtp.example.test');
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#contact-form:not([hidden])', { timeout: 5000 }).catch(() => {});
  log(await page.isVisible('#contact-form'), 'configured: contact form appears');
  await page.fill('#cf-name', 'Test Guest');
  await page.fill('#cf-email', 'guest@example.test');
  await page.fill('#cf-msg', 'Is there parking for a minibus?');
  await page.waitForTimeout(3200); // minimum fill time
  await page.click('#contact-form button[type="submit"]');
  await page.waitForFunction(() => /sent|could not/.test(document.querySelector('[data-cf-status]').textContent), null, { timeout: 8000 }).catch(() => {});
  const ok = await page.textContent('[data-cf-status]');
  const sent = existsSync(join(ROOT, 'storage', 'test-outbox.json')) && readFileSync(join(ROOT, 'storage', 'test-outbox.json'), 'utf8').includes('minibus');
  log(/has been sent/.test(ok) && sent, `success message only after the server accepted it ("${ok}")`);

  // SMTP failure: honest error
  cleanup(); setup('fail.invalid');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#contact-form:not([hidden])', { timeout: 5000 }).catch(() => {});
  await page.fill('#cf-name', 'Test Guest'); await page.fill('#cf-email', 'guest@example.test'); await page.fill('#cf-msg', 'Second message test');
  await page.waitForTimeout(3200);
  await page.click('#contact-form button[type="submit"]');
  await page.waitForFunction(() => /sent|could not/.test(document.querySelector('[data-cf-status]').textContent), null, { timeout: 8000 }).catch(() => {});
  const bad = await page.textContent('[data-cf-status]');
  log(/could not be sent/.test(bad) && !/has been sent/.test(bad), `mail failure shows an honest error ("${bad}")`);
} finally {
  await browser.close();
  server.kill();
  cleanup();
}
console.log(out.join('\n'));
const fails = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${out.length - fails} passed, ${fails} failed  (real SMTP delivery not tested)`);
process.exit(fails ? 1 : 0);
