"""Exercise api/contact.php with PHP's built-in server and a stub PHPMailer.

Usage:  python tests/php-contact-test.py [path-to-php]
Tests the disabled state, CSRF, honeypot, timing check, validation, header-injection stripping,
rate limiting, honest SMTP-failure reporting and the success path. Real SMTP delivery is NOT tested
(the stub records the message instead of sending it). Temporary .env / vendor / storage files are removed.
"""
import http.cookiejar
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHP = sys.argv[1] if len(sys.argv) > 1 else shutil.which("php") or r"C:\xampp\php\php.exe"
PORT = 8790
URL = f"http://127.0.0.1:{PORT}/api/contact.php"
ENV = os.path.join(ROOT, ".env")
VENDOR = os.path.join(ROOT, "vendor")
OUTBOX = os.path.join(ROOT, "storage", "test-outbox.json")

STUB = r"""<?php
namespace PHPMailer\PHPMailer;
class Exception extends \Exception {}
class PHPMailer {
    const ENCRYPTION_STARTTLS = 'tls';
    const ENCRYPTION_SMTPS = 'ssl';
    public $Host, $Port, $SMTPAuth, $Username, $Password, $SMTPSecure, $SMTPAutoTLS = true, $CharSet, $Subject, $Body;
    private $from = [], $to = [], $replyTo = [];
    public function __construct($exceptions = false) {}
    public function isSMTP() {}
    public function isHTML($v) {}
    public function setFrom($a, $n = '') { $this->from = [$a, $n]; }
    public function addAddress($a, $n = '') { $this->to[] = [$a, $n]; }
    public function addReplyTo($a, $n = '') { $this->replyTo = [$a, $n]; }
    public function send() {
        if ($this->Host === 'fail.invalid') { throw new Exception('SMTP connect() failed (stub)'); }
        file_put_contents(dirname(__DIR__, 4) . '/storage/test-outbox.json', json_encode([
            'host' => $this->Host, 'secure' => $this->SMTPSecure, 'from' => $this->from, 'to' => $this->to,
            'replyTo' => $this->replyTo, 'subject' => $this->Subject, 'body' => $this->Body]));
        return true;
    }
}
"""

results = []


def check(ok, msg):
    results.append(("PASS" if ok else "FAIL") + "  " + msg)


def write_env(host="smtp.example.test", limit=3):
    with open(ENV, "w", encoding="utf-8") as f:
        f.write(f"""CONTACT_FORM_ENABLED=true
CONTACT_TO_EMAIL=frontdesk@example.test
SMTP_HOST={host}
SMTP_PORT=587
SMTP_SECURE=tls   # inline comment must be ignored
SMTP_USER=user@example.test
SMTP_PASS="p@ss # not a comment"
SMTP_FROM_EMAIL=website@example.test
CONTACT_RATE_LIMIT={limit}
""")


def clear_storage():
    d = os.path.join(ROOT, "storage")
    for name in os.listdir(d):
        if name.startswith("rl_") or name == "test-outbox.json":
            os.remove(os.path.join(d, name))


def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def call(opener, method="GET", data=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(URL, data=body, method=method, headers={"Accept": "application/json"})
    try:
        with opener.open(req, timeout=10) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw or b"{}"), dict(r.headers)
            except ValueError:
                return r.status, {"raw": raw.decode(errors="replace")[:600]}, dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}"), dict(e.headers)


if os.path.exists(ENV) or os.path.exists(VENDOR):
    sys.exit("Refusing to run: .env or vendor/ already exists in the project (would be overwritten).")

server = subprocess.Popen([PHP, "-S", f"127.0.0.1:{PORT}", "-t", ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    clear_storage()
    # 1. Not configured
    op, jar = client()
    st, body, hdr = call(op)
    check(st == 200 and body == {"enabled": False} and "Set-Cookie" not in hdr, f"disabled: GET -> {st} {body}, no cookie")
    st, body, _ = call(op, "POST", {"name": "A"})
    check(st == 503 and "could not be sent" in body.get("error", ""), f"disabled: POST -> {st} honest error")

    # 2. Configured (stub mailer)
    os.makedirs(os.path.join(VENDOR, "phpmailer", "phpmailer", "src"))
    with open(os.path.join(VENDOR, "phpmailer", "phpmailer", "src", "PHPMailer.php"), "w") as f:
        f.write(STUB)
    with open(os.path.join(VENDOR, "autoload.php"), "w") as f:
        f.write("<?php require __DIR__ . '/phpmailer/phpmailer/src/PHPMailer.php';\n")
    write_env()

    op, jar = client()
    st, body, hdr = call(op)
    csrf, ts = body.get("csrf"), body.get("ts")
    cookie = hdr.get("Set-Cookie", "")
    check(st == 200 and body.get("enabled") is True and csrf and len(csrf) == 64, "enabled: GET returns CSRF token")
    check("HttpOnly" in cookie and "SameSite=Strict" in cookie, f"session cookie HttpOnly + SameSite=Strict ({cookie[:80]}...)")

    good = {"name": "Test Guest", "email": "guest@example.test", "message": "Do you have a twin room on 3 Dec?", "website": "", "csrf": csrf, "ts": ts - 10}
    st, body, _ = call(op, "POST", {**good, "csrf": "wrong"})
    check(st == 403, f"bad CSRF token rejected ({st})")
    st, body, _ = call(client()[0], "POST", good)
    check(st == 403, f"no session (cross-site) rejected ({st})")
    st, body, _ = call(op, "POST", {**good, "website": "http://spam"})
    check(st == 400, f"honeypot rejected ({st})")
    st, body, _ = call(op, "POST", {**good, "ts": int(time.time())})
    check(st == 400, f"too-fast submission rejected ({st})")
    st, body, _ = call(op, "POST", {**good, "ts": int(time.time()) - 8000})
    check(st == 400, f"stale form (>2 h) rejected ({st})")
    st, body, _ = call(op, "POST", {**good, "email": "not-an-email", "message": "hi"})
    check(st == 422 and "valid email" in body.get("error", "") and "message" in body.get("error", ""), f"validation errors ({st}): {body.get('error')}")

    st, body, _ = call(op, "POST", {**good, "name": "Eve\r\nBcc: victim@example.test"})
    mail = json.load(open(OUTBOX)) if os.path.exists(OUTBOX) else {}
    check(st == 200 and body == {"ok": True}, f"valid message accepted ({st} {body})")
    if "raw" in body: print(body["raw"])
    check(mail.get("to") == [["frontdesk@example.test", "Hotel Nepal Bhumi"]] and mail.get("replyTo", [None])[0] == "guest@example.test", "sent to CONTACT_TO_EMAIL with guest as Reply-To")
    check("\n" not in mail.get("subject", "\n") and "\r" not in mail.get("subject", "\r"), f"header injection stripped from subject: {mail.get('subject')!r}")
    check(mail.get("secure") == "tls", ".env inline comment ignored (SMTP_SECURE=tls)")

    # 3. Rate limit (limit 3; 1 accepted attempt so far)
    codes = [call(op, "POST", good)[0] for _ in range(3)]
    check(codes == [200, 200, 429], f"rate limit after 3 attempts per IP ({codes})")

    # 4. Honest SMTP failure
    clear_storage()
    write_env(host="fail.invalid")
    op, jar = client()
    st, body, _ = call(op)
    st, body, _ = call(op, "POST", {**good, "csrf": body["csrf"], "ts": body["ts"] - 10})
    check(st == 502 and body.get("ok") is False and "could not be sent" in body.get("error", ""), f"SMTP failure reported honestly ({st})")
finally:
    server.terminate()
    if os.path.exists(ENV):
        os.remove(ENV)
    shutil.rmtree(VENDOR, ignore_errors=True)
    clear_storage()

print("\n".join(results))
fails = sum(r.startswith("FAIL") for r in results)
print(f"\n{len(results) - fails} passed, {fails} failed  (real SMTP delivery not tested)")
sys.exit(1 if fails else 0)
