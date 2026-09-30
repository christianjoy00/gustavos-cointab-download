<?php
declare(strict_types=1);

/*
 * Same-origin proxy for the dashboard hosted on rentaride.top.
 * It forwards only known Gustavo's Cointab API routes to api.rentaride.top.
 * No API secret is stored in this file.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => ['code' => 'METHOD_NOT_ALLOWED', 'message' => 'POST required.']]);
    exit;
}

$path = (string)($_GET['path'] ?? '');
if (!preg_match('#^/[a-z0-9/_-]+$#i', $path)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => ['code' => 'INVALID_PATH', 'message' => 'Invalid API path.']]);
    exit;
}

$allowedPrefixes = [
    '/health', '/auth/', '/dashboard/', '/account/', '/licenses/',
    '/commands/', '/sales/', '/configuration/'
];
$allowed = false;
foreach ($allowedPrefixes as $prefix) {
    if ($path === $prefix || str_starts_with($path, $prefix)) {
        $allowed = true;
        break;
    }
}
if (!$allowed) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => ['code' => 'PATH_NOT_ALLOWED', 'message' => 'API path not allowed.']]);
    exit;
}

$body = file_get_contents('php://input');
if ($body === false || strlen($body) > 2_000_000) {
    http_response_code(413);
    echo json_encode(['ok' => false, 'error' => ['code' => 'INVALID_BODY', 'message' => 'Request body is too large.']]);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => ['code' => 'CURL_MISSING', 'message' => 'PHP cURL is not enabled on this hosting account.']]);
    exit;
}

$target = 'https://api.rentaride.top/api/v1' . $path;
$headers = ['Content-Type: application/json', 'Accept: application/json'];
if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];
} elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $headers[] = 'Authorization: ' . $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);
$response = curl_exec($ch);
if ($response === false) {
    $message = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => ['code' => 'API_UNREACHABLE', 'message' => 'Could not connect to the API: ' . $message]]);
    exit;
}

$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$responseBody = substr($response, $headerSize);
curl_close($ch);

http_response_code($status ?: 502);
if ($contentType !== '') {
    header('Content-Type: ' . $contentType);
}
echo $responseBody;
