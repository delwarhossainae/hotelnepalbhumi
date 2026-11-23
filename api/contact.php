<?php
declare(strict_types=1);

/**
 * Optional contact-form endpoint.
 *   GET  -> {"enabled":bool,"csrf":"...","ts":int}   (the page shows the form only when enabled)
 *   POST -> {"ok":true} or {"ok":false,"error":"..."} with an honest HTTP status
 * Sends through authenticated SMTP with PHPMailer (run `composer install`).
 */

ini_set('display_errors', '0'); // never mix PHP warnings into the JSON response (they still go to the error log)
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$config   = require dirname(__DIR__) . '/includes/config.php';
$autoload = dirname(__DIR__) . '/vendor/autoload.php';

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

$ready = $config['enabled']
    && is_file($autoload)
    && filter_var($config['to_email'], FILTER_VALIDATE_EMAIL)
    && filter_var($config['from_email'], FILTER_VALIDATE_EMAIL)
    && $config['smtp_host'] !== ''
    && $config['smtp_user'] !== ''
    && $config['smtp_pass'] !== '';

if (!$ready && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    // Not configured: tell the page to keep the form hidden (no session cookie needed).
    http_response_code(200);
    echo json_encode(['enabled' => false]);
    exit;
}

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

$method   = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$fallback = 'Sorry, your message could not be sent. Please contact us on WhatsApp (+977 974-4465391) or by phone.';

if ($method === 'GET') {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    respond(200, ['enabled' => true, 'csrf' => $_SESSION['csrf'], 'ts' => time()]);
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

if (!$ready) {
    respond(503, ['ok' => false, 'error' => $fallback]);
}

// CSRF
$token = (string) ($_POST['csrf'] ?? '');
if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
    respond(403, ['ok' => false, 'error' => 'Your session has expired. Please reload the page and try again.']);
}

// Spam: honeypot + minimum fill time (3 s) + maximum form age (2 h)
$ts = (int) ($_POST['ts'] ?? 0);
if (($_POST['website'] ?? '') !== '' || $ts <= 0 || time() - $ts < 3 || time() - $ts > 7200) {
    respond(400, ['ok' => false, 'error' => 'Your message could not be accepted. Please try again.']);
}

// Rate limit per IP (file based, no database)
$dir = $config['storage'];
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
    respond(500, ['ok' => false, 'error' => $fallback]);
}
$ip     = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rlFile = $dir . '/rl_' . hash('sha256', $ip) . '.json';
$now    = time();
$hits   = is_file($rlFile) ? (json_decode((string) file_get_contents($rlFile), true) ?: []) : [];
$hits   = array_values(array_filter($hits, static fn ($t) => is_int($t) && $t > $now - $config['rate_window']));
if (count($hits) >= $config['rate_limit']) {
    respond(429, ['ok' => false, 'error' => 'Too many messages. Please try again later or contact us on WhatsApp.']);
}

// Validate + sanitise
$clean   = static fn (string $v): string => trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '');
$name    = str_replace(["\r", "\n"], ' ', $clean((string) ($_POST['name'] ?? '')));
$email   = $clean((string) ($_POST['email'] ?? ''));
$message = $clean((string) ($_POST['message'] ?? ''));

$errors = [];
if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
    $errors[] = 'Please enter your name.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120) {
    $errors[] = 'Please enter a valid email address.';
}
if (mb_strlen($message) < 5 || mb_strlen($message) > 2000) {
    $errors[] = 'Please enter a message (5–2000 characters).';
}
if ($errors) {
    respond(422, ['ok' => false, 'error' => implode(' ', $errors)]);
}

// Count every accepted attempt (not only successful sends) so a failing mailbox can't be hammered.
$hits[] = $now;
@file_put_contents($rlFile, json_encode($hits), LOCK_EX);

require $autoload;

$mail = new PHPMailer\PHPMailer\PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host       = $config['smtp_host'];
    $mail->Port       = $config['smtp_port'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['smtp_user'];
    $mail->Password   = $config['smtp_pass'];
    if ($config['smtp_secure'] === 'none') {
        $mail->SMTPSecure = '';        // only for a local test mail server
        $mail->SMTPAutoTLS = false;
    } else {
        $mail->SMTPSecure = $config['smtp_secure'] === 'ssl'
            ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
            : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    }
    $mail->CharSet = 'UTF-8';
    $mail->setFrom($config['from_email'], $config['from_name']);
    $mail->addAddress($config['to_email'], $config['to_name']);
    $mail->addReplyTo($email, $name);
    $mail->Subject = 'Website enquiry from ' . $name;
    $mail->isHTML(false);
    $mail->Body = "Name: {$name}\nEmail: {$email}\n\n{$message}\n\n-- Sent from the Hotel Nepal Bhumi website contact form";
    $mail->send();
} catch (Throwable $e) {
    error_log('[contact] mail failed: ' . $e->getMessage());
    respond(502, ['ok' => false, 'error' => $fallback]);
}

respond(200, ['ok' => true]);
