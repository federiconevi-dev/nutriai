<?php
// reserva.php — guarda cada reserva/consulta de la web en un archivo privado
// (fuera de public_html si se puede). El dueño las ve en panel.php.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out($a) { echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); out(['ok' => false]); }

// Solo aceptamos envíos desde esta misma web
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
$src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($src !== '' && strtolower((string) parse_url($src, PHP_URL_HOST)) !== $host) { http_response_code(403); out(['ok' => false]); }

// Límite: 5 por minuto y 30 por día por persona
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rl = sys_get_temp_dir() . '/casaombu_res_' . md5($ip) . '.json';
$now = time();
$st = is_file($rl) ? json_decode(@file_get_contents($rl), true) : [];
if (!is_array($st)) $st = [];
if (count(array_filter($st, fn($t) => $t > $now - 60)) >= 5)    out(['ok' => false, 'reason' => 'rate']);
if (count(array_filter($st, fn($t) => $t > $now - 86400)) >= 30) out(['ok' => false, 'reason' => 'rate']);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
function s($v, $m = 80) { return mb_substr(trim(is_scalar($v) ? (string) $v : ''), 0, $m); }

$row = [
  'fecha_registro' => date('c'),
  'tipo'     => s($in['tipo'] ?? 'reserva', 20),
  'servicio' => s($in['servicio'] ?? ''),
  'dia'      => preg_match('/^\d{4}-\d{2}-\d{2}$/', $in['dia'] ?? '') ? $in['dia'] : '',
  'hora'     => preg_match('/^\d{2}:\d{2}$/', $in['hora'] ?? '') ? $in['hora'] : '',
  'nombre'   => s($in['nombre'] ?? ''),
  'telefono' => mb_substr(preg_replace('/[^0-9+\s]/', '', (string) ($in['telefono'] ?? '')), 0, 24),
  'email'    => filter_var($in['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '',
  'nota'     => s($in['nota'] ?? '', 300),
  'estado'   => 'nueva',
];
if ($row['nombre'] === '' || strlen(preg_replace('/\D/', '', $row['telefono'])) < 8) out(['ok' => false, 'reason' => 'datos']);

$st[] = $now;
@file_put_contents($rl, json_encode(array_slice($st, -100)), LOCK_EX);

// Guardar fuera de public_html si se puede; si no, en datos/ (protegido con .htaccess)
$dir = is_writable(__DIR__ . '/..') ? __DIR__ . '/..' : __DIR__ . '/datos';
if (!is_dir($dir)) @mkdir($dir, 0750, true);
$ok = @file_put_contents($dir . '/casaombu_reservas.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false;

// Aviso por email al dueño (opcional): crear ../casaombu_aviso.php con <?php return 'dueno@mail.com';
$to = is_file(__DIR__ . '/../casaombu_aviso.php') ? @include __DIR__ . '/../casaombu_aviso.php' : '';
if (is_string($to) && filter_var($to, FILTER_VALIDATE_EMAIL) && function_exists('mail')) {
  $body = '';
  foreach ($row as $k => $v) $body .= str_pad($k, 15) . ': ' . $v . "\n";
  @mail($to, 'Nueva reserva web — ' . $row['nombre'], $body, 'From: no-reply@' . $host . "\r\nContent-Type: text/plain; charset=utf-8");
}

out(['ok' => $ok]);
