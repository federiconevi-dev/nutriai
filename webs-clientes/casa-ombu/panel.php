<?php
// panel.php — mini CRM del dueño: ve todas las reservas y consultas de la web.
// La primera vez pide crear una contraseña; se guarda (cifrada) fuera de public_html.
session_start();
$PASS_OUT = __DIR__ . '/../casaombu_panel.php';
$PASS_IN  = __DIR__ . '/datos/casaombu_panel.php';
$DATA_OUT = __DIR__ . '/../casaombu_reservas.jsonl';
$DATA_IN  = __DIR__ . '/datos/casaombu_reservas.jsonl';

$hash = is_file($PASS_OUT) ? @include $PASS_OUT : (is_file($PASS_IN) ? @include $PASS_IN : '');
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $p = (string) ($_POST['pass'] ?? '');
  if (!$hash) {
    if (strlen($p) < 8) { $msg = 'Usá al menos 8 caracteres.'; }
    else {
      $c = "<?php return '" . password_hash($p, PASSWORD_DEFAULT) . "';\n";
      if (@file_put_contents($PASS_OUT, $c) === false) { @mkdir(__DIR__ . '/datos', 0750, true); @file_put_contents($PASS_IN, $c); }
      $_SESSION['ombu'] = true; header('Location: panel.php'); exit;
    }
  } elseif (password_verify($p, $hash)) { session_regenerate_id(true); $_SESSION['ombu'] = true; header('Location: panel.php'); exit; }
  else { sleep(1); $msg = 'Contraseña incorrecta.'; }
}
if (isset($_GET['salir'])) { session_destroy(); header('Location: panel.php'); exit; }

$in = !empty($_SESSION['ombu']);
$rows = [];
if ($in) {
  $f = is_file($DATA_OUT) ? $DATA_OUT : $DATA_IN;
  if (is_file($f)) foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) { $r = json_decode($l, true); if ($r) $rows[] = $r; }
  $rows = array_reverse($rows);
}
function e($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
$hoy = date('Y-m-d');
$prox = array_filter($rows, fn($r) => ($r['dia'] ?? '') >= $hoy);
?><!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Panel · Casa Ombú</title>
<style>
*{box-sizing:border-box;margin:0}body{font-family:system-ui,sans-serif;background:#f4efe6;color:#1a1a1a;padding:24px}
.box{max-width:1000px;margin:auto}h1{font-family:Georgia,serif;font-weight:400;margin-bottom:4px}.mut{color:#6b6b6b;font-size:.9rem}
.kpis{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}.kpi{background:#fff;border-radius:14px;padding:14px 18px;min-width:150px}.kpi b{font-size:1.6rem;display:block}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;font-size:.9rem}th,td{padding:10px;text-align:left;border-bottom:1px solid #eee}th{background:#e8dfd0}
a.wa{color:#1f7a4d;font-weight:600}form.login{max-width:340px;margin:12vh auto;background:#fff;padding:28px;border-radius:18px}
input{width:100%;padding:12px;border:1px solid #ccc;border-radius:10px;margin:12px 0;font:inherit}button{width:100%;padding:12px;border:0;border-radius:99px;background:#b85c3a;color:#fff;font-weight:600;cursor:pointer}
.wrap{overflow-x:auto}.err{color:#a33;font-size:.9rem}
</style></head><body>
<?php if (!$in): ?>
<form class="login" method="post"><h1>Casa Ombú</h1>
<p class="mut"><?= $hash ? 'Ingresá tu contraseña del panel.' : 'Primera vez: creá la contraseña del panel.' ?></p>
<input type="password" name="pass" required autofocus><button><?= $hash ? 'Entrar' : 'Crear y entrar' ?></button>
<?php if ($msg): ?><p class="err"><?= e($msg) ?></p><?php endif; ?></form>
<?php else: ?>
<div class="box"><h1>Panel de reservas</h1><p class="mut">Todo lo que llega desde la web. <a href="?salir">Salir</a></p>
<div class="kpis"><div class="kpi"><b><?= count($rows) ?></b>contactos totales</div><div class="kpi"><b><?= count($prox) ?></b>turnos próximos</div></div>
<div class="wrap"><table><tr><th>Turno</th><th>Servicio</th><th>Nombre</th><th>Teléfono</th><th>Nota</th><th>Recibido</th></tr>
<?php foreach ($rows as $r): $tel = preg_replace('/\D/', '', $r['telefono'] ?? ''); ?>
<tr><td><?= e(($r['dia'] ?? '') . ' ' . ($r['hora'] ?? '')) ?></td><td><?= e($r['servicio'] ?? '') ?></td><td><?= e($r['nombre'] ?? '') ?></td>
<td><a class="wa" href="https://wa.me/<?= e($tel) ?>" target="_blank" rel="noopener"><?= e($r['telefono'] ?? '') ?></a></td><td><?= e($r['nota'] ?? '') ?></td>
<td class="mut"><?= e(substr($r['fecha_registro'] ?? '', 0, 16)) ?></td></tr>
<?php endforeach; if (!$rows): ?><tr><td colspan="6" class="mut">Todavía no hay reservas.</td></tr><?php endif; ?>
</table></div></div>
<?php endif; ?></body></html>
