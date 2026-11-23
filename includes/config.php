<?php
declare(strict_types=1);

/**
 * Minimal .env loader + config for the optional contact endpoint.
 * Secrets live in .env (never committed, never served — see .htaccess).
 */
function hnb_env(string $key, ?string $default = null): ?string
{
    static $vars = null;
    if ($vars === null) {
        $vars = [];
        $file = dirname(__DIR__) . '/.env';
        if (is_readable($file)) {
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                    continue;
                }
                [$k, $v] = array_map('trim', explode('=', $line, 2));
                if ($v !== '' && ($v[0] === '"' || $v[0] === "'")) {
                    $q = $v[0];
                    $end = strpos($v, $q, 1);
                    $v = $end === false ? substr($v, 1) : substr($v, 1, $end - 1);
                } else {
                    $v = trim((string) preg_replace('/\s+#.*$/', '', $v)); // allow "KEY=value  # comment"
                }
                $vars[$k] = $v;
            }
        }
    }
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    return $vars[$key] ?? $default;
}

return [
    'enabled'     => hnb_env('CONTACT_FORM_ENABLED', 'false') === 'true',
    'to_email'    => (string) hnb_env('CONTACT_TO_EMAIL', ''),
    'to_name'     => (string) hnb_env('CONTACT_TO_NAME', 'Hotel Nepal Bhumi'),
    'smtp_host'   => (string) hnb_env('SMTP_HOST', ''),
    'smtp_port'   => (int) hnb_env('SMTP_PORT', '587'),
    'smtp_user'   => (string) hnb_env('SMTP_USER', ''),
    'smtp_pass'   => (string) hnb_env('SMTP_PASS', ''),
    'smtp_secure' => (string) hnb_env('SMTP_SECURE', 'tls'), // tls | ssl
    'from_email'  => (string) hnb_env('SMTP_FROM_EMAIL', ''),
    'from_name'   => (string) hnb_env('SMTP_FROM_NAME', 'Hotel Nepal Bhumi Website'),
    'rate_limit'  => (int) hnb_env('CONTACT_RATE_LIMIT', '5'),     // messages per window per IP
    'rate_window' => (int) hnb_env('CONTACT_RATE_WINDOW', '3600'), // seconds
    'storage'     => dirname(__DIR__) . '/storage',
];
