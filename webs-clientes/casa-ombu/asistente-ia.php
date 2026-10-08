<?php
// chat.php — proxy seguro a Google Gemini para el asistente "Luz" de Casa Ombú.
// El navegador solo habla con este archivo (mismo dominio). La clave vive en el
// servidor y NUNCA se envía al frontend.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$MODELS     = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']; // preferente + respaldo (capa gratuita)
$PER_MIN    = 8;    // peticiones por IP y minuto
$PER_DAY    = 100;  // peticiones por IP y día
$GLOBAL_DAY = 1200; // tope global diario (protege la cuota gratuita)

function reply_json($text) {
  echo json_encode(['reply' => $text], JSON_UNESCAPED_UNICODE);
  exit;
}
function fallback_reply() {
  reply_json('Ahora mismo no puedo responder. Escribinos por WhatsApp o reservá desde la web y te ayudamos enseguida.');
}

// --- Solo POST ---
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  exit(json_encode(['error' => 'method']));
}

// --- Guard de mismo origen (si viene Origin/Referer, su host debe ser el del sitio) ---
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
$src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($src !== '') {
  $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
  if ($srcHost === '' || $srcHost !== $host) {
    http_response_code(403);
    exit(json_encode(['error' => 'origin']));
  }
}

// --- Rate limiting por IP + tope global (ficheros temporales) ---
$ip    = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$tmp   = sys_get_temp_dir();
$now   = time();
$today = date('Ymd');

$ipFile = $tmp . '/casaombu_rl_' . md5($ip) . '.json';
$stamps = [];
if (is_file($ipFile)) {
  $stamps = json_decode(@file_get_contents($ipFile), true);
  if (!is_array($stamps)) $stamps = [];
}
$inLastMin = array_filter($stamps, function ($t) use ($now) { return $t > $now - 60; });
$inLastDay = array_filter($stamps, function ($t) use ($now) { return $t > $now - 86400; });
if (count($inLastMin) >= $PER_MIN) {
  reply_json('Vas muy rápido 🙂 Esperá unos segundos y volvé a preguntarme.');
}
if (count($inLastDay) >= $PER_DAY) {
  reply_json('Hiciste muchas consultas hoy. Escribinos por WhatsApp y te ayudamos.');
}

$gFile  = $tmp . '/casaombu_rl_global_' . $today . '.txt';
$gCount = is_file($gFile) ? (int) @file_get_contents($gFile) : 0;
if ($gCount >= $GLOBAL_DAY) {
  reply_json('El asistente está muy solicitado ahora mismo. Escribinos por WhatsApp y te respondemos enseguida.');
}

// --- Clave: entorno -> fichero fuera de public_html -> secret_config.php ---
$key = getenv('GEMINI_API_KEY');
if (!$key && is_file(__DIR__ . '/../gemini_api_key.php')) { $key = @include __DIR__ . '/../gemini_api_key.php'; }
if (!$key && is_file(__DIR__ . '/secret_config.php'))     { $key = @include __DIR__ . '/secret_config.php'; }
$key = is_string($key) ? trim($key) : '';

// Clave de respaldo (Anthropic / Claude Haiku): entorno -> fuera de public_html -> secret_anthropic.php
$akey = getenv('ANTHROPIC_API_KEY');
if (!$akey && is_file(__DIR__ . '/../anthropic_api_key.php')) { $akey = @include __DIR__ . '/../anthropic_api_key.php'; }
if (!$akey && is_file(__DIR__ . '/secret_anthropic.php'))     { $akey = @include __DIR__ . '/secret_anthropic.php'; }
$akey = is_string($akey) ? trim($akey) : '';

$hasGemini    = ($key  !== '' && $key  !== 'TU_CLAVE_AQUI');
$hasAnthropic = ($akey !== '' && $akey !== 'TU_CLAVE_AQUI');
if (!$hasGemini && !$hasAnthropic) {
  reply_json('El asistente todavía se está configurando. Volvé a intentarlo en un ratito 🙂');
}

// --- Entrada ---
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$message = trim((string) ($in['message'] ?? ''));
$history = is_array($in['history'] ?? null) ? array_slice($in['history'], -8) : [];
if ($message === '' || mb_strlen($message) > 500) {
  http_response_code(400);
  exit(json_encode(['error' => 'input']));
}

// Registrar la petición (ya validada) en los contadores
$stamps[] = $now;
$stamps   = array_slice($stamps, -300);
@file_put_contents($ipFile, json_encode(array_values($stamps)), LOCK_EX);
@file_put_contents($gFile, (string) ($gCount + 1), LOCK_EX);

// --- Prompt de sistema (persona + base de conocimiento) ---
$system = @include __DIR__ . '/knowledge.php';
if (!is_string($system) || $system === '') {
  $system = 'Eres «Luz», la asistente de Casa Ombú, un espacio de masajes en Palermo, Buenos Aires. Responde en español rioplatense, breve, solo sobre los servicios del spa, e invita a reservar turno.';
}

$contents = [];
foreach ($history as $h) {
  $role = ((($h['role'] ?? '')) === 'model') ? 'model' : 'user';
  $text = mb_substr((string) ($h['text'] ?? ''), 0, 1000);
  if ($text === '') continue;
  $contents[] = ['role' => $role, 'parts' => [['text' => $text]]];
}
$contents[] = ['role' => 'user', 'parts' => [['text' => $message]]];

// Mensajes en formato Anthropic (para el respaldo con Claude Haiku)
$amessages = [];
foreach ($history as $h) {
  $arole = ((($h['role'] ?? '')) === 'model') ? 'assistant' : 'user';
  $atext = mb_substr((string) ($h['text'] ?? ''), 0, 1000);
  if ($atext === '') continue;
  $amessages[] = ['role' => $arole, 'content' => $atext];
}
$amessages[] = ['role' => 'user', 'content' => $message];

$payload = [
  'system_instruction' => ['parts' => [['text' => $system]]],
  'contents'           => $contents,
  'generationConfig'   => ['temperature' => 0.4, 'topP' => 0.9, 'maxOutputTokens' => 700, 'thinkingConfig' => ['thinkingBudget' => 0]],
  'safetySettings'     => [
    ['category' => 'HARM_CATEGORY_HARASSMENT',        'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_HATE_SPEECH',       'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
  ],
];
$body = json_encode($payload, JSON_UNESCAPED_UNICODE);

// --- Llamada a Gemini (modelo preferente, y si falla, respaldo) ---
function call_gemini($model, $key, $body) {
  $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . urlencode($key);
  $ch  = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_TIMEOUT        => 30,
  ]);
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  return [$resp, $code, $err];
}

// --- Respaldo: Claude Haiku (Anthropic) ---
function call_anthropic($akey, $system, $amessages) {
  $payload = [
    'model'      => 'claude-haiku-4-5',
    'max_tokens' => 700,
    'system'     => $system,
    'messages'   => $amessages,
  ];
  $ch = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
      'content-type: application/json',
      'x-api-key: ' . $akey,
      'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT    => 30,
  ]);
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  return [$resp, $code, $err];
}

$reply   = '';
$lastErr = '';

// 1) Gemini (capa gratuita)
if ($hasGemini) {
  foreach ($MODELS as $model) {
    list($resp, $code, $err) = call_gemini($model, $key, $body);
    if ($resp === false || $code >= 400) {
      $lastErr = "modelo $model http $code $err " . substr((string) $resp, 0, 300);
      continue;
    }
    $data  = json_decode($resp, true);
    $reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if ($reply !== '') break;
    $block   = $data['promptFeedback']['blockReason'] ?? ($data['candidates'][0]['finishReason'] ?? 'desconocido');
    $lastErr = "modelo $model respuesta vacía ($block)";
  }
}

// 2) Respaldo con Claude Haiku si Gemini no ha respondido
if ($reply === '' && $hasAnthropic) {
  list($aresp, $acode, $aerr) = call_anthropic($akey, $system, $amessages);
  if ($aresp !== false && $acode < 400) {
    $adata = json_decode($aresp, true);
    $reply = $adata['content'][0]['text'] ?? '';
  } else {
    $lastErr .= " | haiku http $acode $aerr " . substr((string) $aresp, 0, 200);
  }
}

if ($reply === '') {
  @error_log('[casaombu-chat] ' . $lastErr);
  fallback_reply();
}

reply_json($reply);
