<?php
// setup.php — activar las claves del asistente (Gemini principal + Claude Haiku respaldo)
// UNA sola vez, desde el navegador. Las claves se validan y se guardan en el
// servidor (fuera de public_html si es posible). Nunca se muestran ni se registran.

$G_OUT = __DIR__ . '/../gemini_api_key.php';    $G_IN = __DIR__ . '/secret_config.php';
$A_OUT = __DIR__ . '/../anthropic_api_key.php'; $A_IN = __DIR__ . '/secret_anthropic.php';

function read_key($out, $in) {
  $k = '';
  if (is_file($out)) { $v = @include $out; if (is_string($v)) $k = trim($v); }
  if ($k === '' && is_file($in)) { $v = @include $in; if (is_string($v)) $k = trim($v); }
  return $k;
}
function is_set_key($k) { return ($k !== '' && $k !== 'TU_CLAVE_AQUI'); }
function write_key($out, $in, $key) {
  $content = "<?php return '" . str_replace("'", "\\'", $key) . "';\n";
  if (@file_put_contents($out, $content) !== false) return true;
  return (@file_put_contents($in, $content) !== false);
}
function validate_gemini($key) {
  if (!function_exists('curl_init')) return false;
  $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models?key=' . urlencode($key));
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
  $r = curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return ($r !== false && $c === 200);
}
function validate_anthropic($key) {
  if (!function_exists('curl_init')) return false;
  $ch = curl_init('https://api.anthropic.com/v1/models');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => ['x-api-key: ' . $key, 'anthropic-version: 2023-06-01']]);
  $r = curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return ($r !== false && $c === 200);
}

$gkey = read_key($G_OUT, $G_IN); $gSet = is_set_key($gkey);
$akey = read_key($A_OUT, $A_IN); $aSet = is_set_key($akey);
$msg = ''; $tone = 'info';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (isset($_POST['gemini_key']) && !$gSet) {
    $k = trim((string) $_POST['gemini_key']);
    if ($k === '' || strpos($k, 'AIza') !== 0) { $msg = 'La clave de Gemini debe empezar por «AIza». Revísala.'; $tone = 'warn'; }
    elseif (!validate_gemini($k)) { $msg = 'No he podido validar la clave de Gemini con Google.'; $tone = 'warn'; }
    elseif (write_key($G_OUT, $G_IN, $k)) { $gSet = true; $gkey = $k; $msg = '¡Clave de Gemini activada!'; $tone = 'ok'; }
    else { $msg = 'La clave de Gemini es válida pero no se pudo guardar (permisos).'; $tone = 'warn'; }
  } elseif (isset($_POST['anthropic_key']) && !$aSet) {
    $k = trim((string) $_POST['anthropic_key']);
    if ($k === '' || strpos($k, 'sk-ant-') !== 0) { $msg = 'La clave de Anthropic debe empezar por «sk-ant-». Revísala.'; $tone = 'warn'; }
    elseif (!validate_anthropic($k)) { $msg = 'No he podido validar la clave de Anthropic (Claude).'; $tone = 'warn'; }
    elseif (write_key($A_OUT, $A_IN, $k)) { $aSet = true; $akey = $k; $msg = '¡Clave de respaldo (Claude Haiku) activada!'; $tone = 'ok'; }
    else { $msg = 'La clave de Anthropic es válida pero no se pudo guardar (permisos).'; $tone = 'warn'; }
  } else {
    $msg = 'Esa clave ya estaba configurada. Por seguridad no se puede cambiar desde aquí.'; $tone = 'info';
  }
}
?><!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Configurar asistente · Casa Ombú</title>
<style>
  :root{--bg:#2a1f18;--ink:#eaf6f0;--mut:#aec7c0;--em:#b85c3a;--brd:rgba(255,255,255,.12)}
  *{box-sizing:border-box;margin:0}
  body{font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;background:
    radial-gradient(45% 45% at 15% 12%,rgba(52,211,153,.25),transparent 60%),
    radial-gradient(45% 45% at 85% 20%,rgba(34,211,238,.2),transparent 62%),var(--bg);
    color:var(--ink);min-height:100vh;display:grid;place-items:center;padding:24px;line-height:1.6}
  .box{width:100%;max-width:480px;background:rgba(255,255,255,.05);border:1px solid var(--brd);
    border-radius:22px;padding:30px;backdrop-filter:blur(18px);box-shadow:0 30px 60px -25px rgba(0,0,0,.7)}
  h1{font-size:1.45rem;letter-spacing:-.02em;margin-bottom:6px}
  .sub{color:var(--mut);font-size:.94rem;margin-bottom:20px}
  .card{border:1px solid var(--brd);border-radius:14px;padding:16px;margin-bottom:14px;background:rgba(255,255,255,.03)}
  .card h2{font-size:1rem;margin-bottom:4px;display:flex;align-items:center;gap:8px}
  .pill{font-size:.72rem;padding:3px 9px;border-radius:999px;border:1px solid var(--brd)}
  .pill.ok{background:rgba(52,211,153,.16);color:#c9ffe9;border-color:rgba(52,211,153,.4)}
  .pill.no{background:rgba(255,180,80,.12);color:#ffe4bd;border-color:rgba(255,180,80,.35)}
  .hint{color:var(--mut);font-size:.85rem;margin:6px 0 12px}
  .hint a{color:var(--em)}
  input{width:100%;padding:12px 13px;border-radius:11px;border:1px solid var(--brd);
    background:rgba(5,18,15,.6);color:var(--ink);font:inherit}
  input:focus{outline:none;border-color:var(--em);box-shadow:0 0 0 3px rgba(52,211,153,.18)}
  button{width:100%;margin-top:10px;padding:12px;border:0;border-radius:999px;cursor:pointer;
    font-weight:700;color:#04140f;background:linear-gradient(115deg,#b85c3a,#2dd4bf,#22d3ee)}
  .msg{margin-top:14px;padding:11px 13px;border-radius:11px;font-size:.9rem;border:1px solid var(--brd)}
  .ok{background:rgba(52,211,153,.14);color:#c9ffe9;border-color:rgba(52,211,153,.4)}
  .warn{background:rgba(255,180,80,.12);color:#ffe4bd;border-color:rgba(255,180,80,.35)}
  .info{background:rgba(255,255,255,.05);color:var(--mut)}
  .foot{margin-top:16px;font-size:.78rem;color:var(--mut)}
  code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
  <main class="box">
    <h1>Asistente «Luz» · Configuración</h1>
    <p class="sub">Gemini es el motor principal (gratis). Claude Haiku es el respaldo si Gemini no está disponible. Las claves se guardan en el servidor y nunca se muestran a los visitantes.</p>

    <div class="card">
      <h2>Motor principal · Google Gemini <span class="pill <?php echo $gSet?'ok':'no'; ?>"><?php echo $gSet?'Configurado ✓':'Pendiente'; ?></span></h2>
      <?php if (!$gSet): ?>
        <p class="hint">Crea una clave gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (empieza por <code>AIza…</code>).</p>
        <form method="post" autocomplete="off">
          <input name="gemini_key" type="password" placeholder="AIza..." required>
          <button type="submit">Activar Gemini</button>
        </form>
      <?php endif; ?>
    </div>

    <div class="card">
      <h2>Respaldo · Claude Haiku <span class="pill <?php echo $aSet?'ok':'no'; ?>"><?php echo $aSet?'Configurado ✓':'Pendiente'; ?></span></h2>
      <?php if (!$aSet): ?>
        <p class="hint">Crea una clave en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (empieza por <code>sk-ant-…</code>).</p>
        <form method="post" autocomplete="off">
          <input name="anthropic_key" type="password" placeholder="sk-ant-..." required>
          <button type="submit">Activar respaldo</button>
        </form>
      <?php endif; ?>
    </div>

    <?php if ($gSet && $aSet): ?>
      <div class="msg ok">✅ Todo configurado. El asistente usa Gemini y, si no está disponible, Claude Haiku. Puedes borrar <code>setup.php</code> del servidor.</div>
    <?php endif; ?>
    <?php if ($msg): ?><div class="msg <?php echo $tone; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
    <p class="foot">Casa Ombú · Las claves no se comparten con el navegador ni se registran en ningún sitio.</p>
  </main>
</body>
</html>
