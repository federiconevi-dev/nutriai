import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Home, Salad, Dumbbell, LineChartIcon, Bot, Settings, ChevronRight, ChevronLeft,
  Flame, Droplet, Send, RefreshCw, Plus, Check, X, Sparkles, Trash2, Info,
  PlayCircle, ShoppingCart, Activity, GlassWater, UtensilsCrossed
} from "lucide-react";

/* ============================================================
   DESIGN TOKENS — pastel rosa & blanco
   Rosa = protagonista (acción/energía), menta pastel = secundario
   (salud/proteína), durazno pastel = terciario (alertas suaves).
============================================================ */
const T = {
  bg: "#FEF7FA",
  surface: "#FFFFFF",
  surface2: "#FCEBF2",
  border: "#F4D7E3",
  text: "#3F2A35",
  dim: "#AD8C9B",
  amber: "#EA6E9C",   // rosa principal
  amberText: "#FFFFFF",
  teal: "#6FC6B6",    // menta pastel
  tealText: "#153B33",
  coral: "#F3A98A",   // durazno pastel
  shadow: "rgba(234,110,156,0.10)",
};

/* ============================================================
   NUTRITION MATH (real formulas, not AI-guessed)
============================================================ */
const ACTIVITY = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
};

function calcTargets(p) {
  if (!p) return null;
  const { sexo, edad, altura, peso, actividad, objetivo } = p;
  let bmr = 10 * Number(peso) + 6.25 * Number(altura) - 5 * Number(edad);
  bmr += sexo === "hombre" ? 5 : sexo === "mujer" ? -161 : -78;
  const tdee = bmr * (ACTIVITY[actividad] || 1.375);

  let kcal = tdee;
  if (objetivo === "perder_grasa") kcal = tdee - Math.min(500, tdee * 0.2);
  if (objetivo === "ganar_musculo") kcal = tdee + Math.min(350, tdee * 0.15);
  if (objetivo === "recomposicion") kcal = tdee - 150;

  kcal = Math.max(1200, Math.round(kcal));

  const proteinPerKg = objetivo === "ganar_musculo" || objetivo === "recomposicion" ? 2.0 : 1.8;
  const protein = Math.round(Number(peso) * proteinPerKg);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbsKcal = kcal - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(carbsKcal / 4));
  const water = Math.round((Number(peso) * 35) / 100) / 10;

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, water };
}

function bmi(peso, altura) {
  if (!peso || !altura) return null;
  const h = altura / 100;
  return (peso / (h * h)).toFixed(1);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function formatDateLong(dateStr) {
  // dateStr = "YYYY-MM-DD" (local, sin desfase de zona horaria)
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dia = DIAS[dt.getDay()];
  return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${d} de ${MESES[m - 1]}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function calcStreak(activeDates) {
  // activeDates: Set de "YYYY-MM-DD" con al menos un registro (comida, ejercicio, peso o check-in)
  let cursor = todayStr();
  if (!activeDates.has(cursor)) cursor = addDays(cursor, -1); // si hoy todavía no cargaste nada, arranca desde ayer
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/* ============================================================
   MET TABLE — para calcular calorías quemadas por actividad
   kcal = MET * peso(kg) * horas
============================================================ */
const MET_ACTIVITIES = [
  { name: "Caminar (ritmo suave)", met: 3.5 },
  { name: "Caminar rápido", met: 4.5 },
  { name: "Correr (8 km/h)", met: 8 },
  { name: "Correr (10 km/h)", met: 10 },
  { name: "Correr (12 km/h)", met: 12.5 },
  { name: "Ciclismo moderado", met: 6 },
  { name: "Ciclismo intenso", met: 10 },
  { name: "Spinning / ciclismo indoor", met: 8.5 },
  { name: "Pesas / musculación", met: 5 },
  { name: "Funcional / crossfit", met: 8 },
  { name: "Circuito de fuerza", met: 6 },
  { name: "HIIT", met: 8 },
  { name: "Natación", met: 7 },
  { name: "Remo (máquina)", met: 7 },
  { name: "Escalador / stairmaster", met: 9 },
  { name: "Elíptica", met: 5.5 },
  { name: "Yoga / movilidad", met: 2.5 },
  { name: "Pilates", met: 3 },
  { name: "Boxeo (saco)", met: 7.8 },
  { name: "Artes marciales", met: 10 },
  { name: "Fútbol", met: 7 },
  { name: "Básquet", met: 6.5 },
  { name: "Tenis", met: 7.3 },
  { name: "Pádel", met: 6 },
  { name: "Golf", met: 4.3 },
  { name: "Senderismo", met: 6 },
  { name: "Patín / rollers", met: 7 },
  { name: "Baile", met: 5 },
  { name: "Zumba", met: 6 },
  { name: "Otro (personalizado)", met: null },
];

function calcBurn(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes) return 0;
  return Math.round(met * weightKg * (minutes / 60));
}

/* ============================================================
   STORAGE HELPERS — localStorage real del navegador (esta app
   corre standalone, no dentro de un artifact de Claude.ai)
============================================================ */
async function storeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(`nutriai:${key}`);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function storeSet(key, value) {
  try {
    localStorage.setItem(`nutriai:${key}`, JSON.stringify(value));
  } catch (e) {
    console.error("storage error", e);
  }
}
async function storeDelete(key) {
  try {
    localStorage.removeItem(`nutriai:${key}`);
  } catch (e) {
    console.error("storage error", e);
  }
}

/* ============================================================
   AI SERVICE
============================================================ */
async function callClaude({ system, messages, maxTokens = 1000 }) {
  // Nunca llamamos a api.anthropic.com directo desde el navegador (expondría la API key).
  // Este endpoint es una Netlify Function que guarda la key del lado del servidor.
  const res = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || errBody?.error?.type || errBody?.error || errBody?.message || `Error del servidor (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return text;
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]); } catch { return null; } }
    return null;
  }
}

function normalizeFoodEstimate(obj) {
  if (!obj || typeof obj !== "object") return null;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; };
  return {
    name: obj.name || "Comida",
    kcal: num(obj.kcal),
    protein: num(obj.protein),
    carbs: num(obj.carbs),
    fat: num(obj.fat),
  };
}

function profileContext(profile, targets) {
  if (!profile) return "El usuario todavía no completó su perfil.";
  return `Perfil del usuario:
- ${profile.sexo}, ${profile.edad} años, ${profile.altura}cm, ${profile.peso}kg (objetivo: ${profile.pesoObjetivo}kg)
- Objetivo: ${profile.objetivo}
- Nivel de actividad: ${profile.actividad}
- Objetivo calórico diario: ${targets?.kcal} kcal | Proteína: ${targets?.protein}g | Carbos: ${targets?.carbs}g | Grasas: ${targets?.fat}g
- No le gusta: ${profile.noLeGusta || "sin datos"}
- Alergias/restricciones: ${profile.alergias || "ninguna"}
- Tipo de alimentación: ${profile.tipoAlimentacion || "sin restricciones"}
- Presupuesto: ${profile.presupuesto || "medio"}
- Tiempo para cocinar: ${profile.tiempoCocinar || "sin datos"}
- Entrena en: ${profile.dondeEntrena || "sin datos"}, equipamiento: ${profile.equipamiento || "sin datos"}
- Días de entrenamiento: ${profile.diasEntreno || "sin datos"}, nivel: ${profile.nivelEntreno || "sin datos"}
IMPORTANTE: sos un asistente orientativo, no un profesional de la salud. Si el usuario menciona una condición médica, embarazo, un trastorno alimentario o síntomas relevantes, recomendale consultar a un profesional en vez de darle un plan. Nunca prometas resultados exactos ni dés consejos médicos.`;
}

function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " técnica correcta ejercicio")}`;
}

/* Librería de videos de técnica incrustados (IDs reales verificados por búsqueda).
   Cubre los ejercicios más comunes que la IA suele generar. Si no hay match,
   se ofrece un buscador de YouTube como respaldo — nunca un video inventado. */
const EXERCISE_VIDEOS = [
  { keywords: ["sentadilla", "squat"], id: "MHd7Jfh05sw" },
  { keywords: ["press banca", "press de banca", "bench press"], id: "7aQY3u0Dk-Q" },
  { keywords: ["peso muerto", "deadlift"], id: "59KftU68hHQ" },
  { keywords: ["flexion", "flexiones", "push up", "push-up", "lagartija"], id: "5HL5WY0WVJQ" },
  { keywords: ["remo"], id: "5Gg2OPlCkuE" },
  { keywords: ["press militar", "press hombro", "press de hombro", "shoulder press", "overhead press"], id: "IbjAE_D9qi0" },
  { keywords: ["dominada", "pull up", "pull-up", "chin up"], id: "8mhDd9Ahl1M" },
  { keywords: ["plancha", "plank"], id: "d0atctiI7Vw" },
  { keywords: ["zancada", "lunge"], id: "kgSBts9RSH4" },
  { keywords: ["curl de biceps", "curl biceps", "curl de bíceps", "biceps curl", "curl bíceps"], id: "oHO6dV7aQbE" },
  { keywords: ["jumping jack"], id: "Q-emT6j2WHQ" },
  { keywords: ["burpee"], id: "zMLcD2OBm-Y" },
  { keywords: ["hip thrust", "empuje de cadera"], id: "LWj9YiMWJk0" },
  { keywords: ["fondos", "dips", "paralelas"], id: "xVvs6L2Tcbs" },
];

function findExerciseVideo(name) {
  const n = (name || "").toLowerCase();
  for (const ex of EXERCISE_VIDEOS) {
    if (ex.keywords.some((k) => n.includes(k))) return ex.id;
  }
  return null;
}

/* Estimación de MET por tipo de ejercicio de fuerza, para calcular
   calorías reales cuando se marca un ejercicio como completado. */
const EXERCISE_MET = [
  { keywords: ["burpee", "jumping jack", "mountain climber", "hiit", "salto", "battle rope"], met: 8 },
  { keywords: ["plancha", "plank"], met: 3.8 },
  { keywords: ["flexion", "flexiones", "push up", "push-up", "lagartija"], met: 4 },
  {
    keywords: [
      "sentadilla", "squat", "peso muerto", "deadlift", "zancada", "lunge", "hip thrust",
      "press", "remo", "dominada", "pull up", "curl", "fondos", "dips", "extension",
      "extensión", "jalón", "encogimiento", "empuje", "elevacion", "elevación",
    ],
    met: 5,
  },
];

function findExerciseMet(name) {
  const n = (name || "").toLowerCase();
  for (const ex of EXERCISE_MET) {
    if (ex.keywords.some((k) => n.includes(k))) return ex.met;
  }
  return 5; // musculación general (Compendio de Actividades Físicas)
}

function avgReps(repsStr) {
  const nums = String(repsStr || "").match(/\d+/g)?.map(Number) || [10];
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function estimateRoutineBurn(ex, weightKg) {
  const reps = avgReps(ex.reps);
  const setWorkSec = reps * 3; // ~3seg activos por repetición
  const rest = Number(ex.rest_sec) || 60;
  const totalSec = (Number(ex.sets) || 3) * (setWorkSec + rest);
  const minutes = totalSec / 60;
  const met = findExerciseMet(ex.name);
  return { minutes: Math.round(minutes * 10) / 10, kcal: calcBurn(met, weightKg, minutes) };
}

function compressImage(file, maxDim = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
      else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("No se pudo procesar la imagen")); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({
          base64: reader.result.split(",")[1],
          mediaType: "image/jpeg",
          previewUrl: canvas.toDataURL("image/jpeg", quality),
        });
        reader.onerror = () => reject(new Error("No se pudo leer la imagen comprimida"));
        reader.readAsDataURL(blob);
      }, "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen. Probá con otra foto."));
    img.src = url;
  });
}

/* ============================================================
   UI PRIMITIVES
============================================================ */
function Card({ children, style, ...rest }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, boxShadow: `0 4px 16px ${T.shadow}`, ...style }} {...rest}>
      {children}
    </div>
  );
}

function Ring({ value, max, color, label, unit }) {
  const pct = Math.min(1, value / Math.max(max, 1));
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke={T.surface2} strokeWidth="9" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - pct * c} transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset .5s" }} />
        <text x="52" y="49" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="18" fill={T.text} fontWeight="600">
          {Math.round(value)}
        </text>
        <text x="52" y="65" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="10" fill={T.dim}>
          /{Math.round(max)}{unit}
        </text>
      </svg>
      <span style={{ fontSize: 12, color: T.dim, letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style }) {
  const base = {
    border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: 8, transition: "transform .15s",
    minHeight: 44,
  };
  const variants = {
    primary: { background: T.amber, color: T.amberText },
    ghost: { background: T.surface2, color: T.text },
    outline: { background: "transparent", color: T.text, border: `1px solid ${T.border}` },
    mint: { background: T.teal, color: T.tealText },
  };
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: T.dim }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10,
  padding: "12px 12px", color: T.text, fontSize: 15, outline: "none", minHeight: 44,
  width: "100%", maxWidth: "100%", boxSizing: "border-box",
};

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 99, fontSize: 13, cursor: "pointer",
      border: `1px solid ${active ? T.amber : T.border}`,
      background: active ? "rgba(234,110,156,0.14)" : "transparent",
      color: active ? T.amber : T.dim, fontWeight: 500,
    }}>
      {children}
    </button>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", padding: "3px 8px", borderRadius: 6, background: T.surface2, color }}>
      {children}
    </span>
  );
}

/* ============================================================
   ONBOARDING
============================================================ */
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    sexo: "mujer", edad: "", altura: "", peso: "", pesoObjetivo: "",
    actividad: "moderado", objetivo: "perder_grasa",
    tipoAlimentacion: "", noLeGusta: "", alergias: "", presupuesto: "medio",
    comidasPorDia: "4", tiempoCocinar: "30 min",
    dondeEntrena: "casa", equipamiento: "peso corporal", diasEntreno: "3",
    duracionEntreno: "45 min", nivelEntreno: "principiante",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const steps = [
    {
      title: "Empecemos por lo básico",
      sub: "Estos datos sirven para calcular tu gasto calórico real.",
      body: (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Sexo">
            <select style={inputStyle} value={f.sexo} onChange={(e) => set("sexo", e.target.value)}>
              <option value="mujer">Mujer</option><option value="hombre">Hombre</option><option value="otro">Otro</option>
            </select>
          </Field>
          <Field label="Edad"><input style={inputStyle} type="number" value={f.edad} onChange={(e) => set("edad", e.target.value)} /></Field>
          <Field label="Altura (cm)"><input style={inputStyle} type="number" value={f.altura} onChange={(e) => set("altura", e.target.value)} /></Field>
          <Field label="Peso actual (kg)"><input style={inputStyle} type="number" value={f.peso} onChange={(e) => set("peso", e.target.value)} /></Field>
          <Field label="Peso objetivo (kg)"><input style={inputStyle} type="number" value={f.pesoObjetivo} onChange={(e) => set("pesoObjetivo", e.target.value)} /></Field>
          <Field label="Nivel de actividad">
            <select style={inputStyle} value={f.actividad} onChange={(e) => set("actividad", e.target.value)}>
              <option value="sedentario">Sedentario</option><option value="ligero">Ligero (1-3 días)</option>
              <option value="moderado">Moderado (3-5 días)</option><option value="activo">Activo (6-7 días)</option>
              <option value="muy_activo">Muy activo / físico</option>
            </select>
          </Field>
        </div>
      ),
    },
    {
      title: "¿Cuál es tu objetivo?",
      sub: "Sin objetivos extremos — vamos por algo sostenible.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[["perder_grasa", "Perder grasa"], ["ganar_musculo", "Ganar músculo"], ["mantener", "Mantener peso"], ["recomposicion", "Recomposición corporal"]].map(([v, l]) => (
            <div key={v} onClick={() => set("objetivo", v)} style={{
              padding: 14, borderRadius: 12, cursor: "pointer",
              border: `1px solid ${f.objetivo === v ? T.amber : T.border}`,
              background: f.objetivo === v ? "rgba(234,110,156,0.10)" : T.surface2,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 500 }}>{l}</span>
              {f.objetivo === v && <Check size={16} color={T.amber} />}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Tu alimentación",
      sub: "Para que la IA nunca te recomiende algo que no comés.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Tipo de alimentación (ej: omnívoro, vegetariano, vegano, keto)">
            <input style={inputStyle} value={f.tipoAlimentacion} onChange={(e) => set("tipoAlimentacion", e.target.value)} placeholder="omnívoro" />
          </Field>
          <Field label="Alimentos que no te gustan">
            <input style={inputStyle} value={f.noLeGusta} onChange={(e) => set("noLeGusta", e.target.value)} placeholder="pescado, berenjena..." />
          </Field>
          <Field label="Alergias / intolerancias">
            <input style={inputStyle} value={f.alergias} onChange={(e) => set("alergias", e.target.value)} placeholder="ninguna" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Presupuesto">
              <select style={inputStyle} value={f.presupuesto} onChange={(e) => set("presupuesto", e.target.value)}>
                <option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option>
              </select>
            </Field>
            <Field label="Tiempo para cocinar"><input style={inputStyle} value={f.tiempoCocinar} onChange={(e) => set("tiempoCocinar", e.target.value)} /></Field>
          </div>
        </div>
      ),
    },
    {
      title: "Tu entrenamiento",
      sub: "La rutina se adapta a lo que realmente tenés disponible.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Dónde entrenás">
            <select style={inputStyle} value={f.dondeEntrena} onChange={(e) => set("dondeEntrena", e.target.value)}>
              <option value="casa">Casa</option><option value="gimnasio">Gimnasio</option><option value="exterior">Exterior</option>
            </select>
          </Field>
          <Field label="Equipamiento disponible">
            <input style={inputStyle} value={f.equipamiento} onChange={(e) => set("equipamiento", e.target.value)} placeholder="peso corporal, mancuernas..." />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Días por semana"><input style={inputStyle} type="number" value={f.diasEntreno} onChange={(e) => set("diasEntreno", e.target.value)} /></Field>
            <Field label="Duración"><input style={inputStyle} value={f.duracionEntreno} onChange={(e) => set("duracionEntreno", e.target.value)} /></Field>
          </div>
          <Field label="Nivel">
            <select style={inputStyle} value={f.nivelEntreno} onChange={(e) => set("nivelEntreno", e.target.value)}>
              <option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
            </select>
          </Field>
        </div>
      ),
    },
  ];

  const canNext = () => (step === 0 ? f.edad && f.altura && f.peso && f.pesoObjetivo : true);

  return (
    <div style={{ minHeight: "100vh", background: "#EAE3E7", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: T.bg, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxShadow: "0 0 40px rgba(0,0,0,0.08)", overflowX: "hidden", boxSizing: "border-box" }}>
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
            {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= step ? T.amber : T.surface2 }} />)}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.5 }}>{steps[step].title}</h1>
          <p style={{ color: T.dim, fontSize: 14, marginBottom: 22 }}>{steps[step].sub}</p>
          <Card>{steps[step].body}</Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ChevronLeft size={16} /> Atrás</Button>
            {step < steps.length - 1
              ? <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>Siguiente <ChevronRight size={16} /></Button>
              : <Button onClick={() => onDone(f)}>Generar mi plan <Sparkles size={16} /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD — ahora con datos reales de food log, agua y ejercicio
============================================================ */
function Dashboard({ profile, targets, weightLogs, streak, foodLog, exerciseLog, waterLog, addWater, checkin, setCheckin, goTo }) {
  const [tip, setTip] = useState(null);
  const [loadingTip, setLoadingTip] = useState(false);
  const today = todayStr();

  const todayFood = useMemo(() => foodLog.filter((f) => f.date === today), [foodLog, today]);
  const kcalConsumed = todayFood.reduce((s, f) => s + (f.kcal || 0), 0);
  const proteinConsumed = todayFood.reduce((s, f) => s + (f.protein || 0), 0);
  const todayWaterMl = useMemo(() => waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0), [waterLog, today]);
  const todayBurn = useMemo(() => exerciseLog.filter((e) => e.date === today).reduce((s, e) => s + (e.kcal || 0), 0), [exerciseLog, today]);

  const loadTip = useCallback(async () => {
    const cached = await storeGet(`tip:${today}`, null);
    if (cached) { setTip(cached); return; }
    setLoadingTip(true);
    try {
      const text = await callClaude({
        system: profileContext(profile, targets) + "\nDame UN consejo corto (máximo 2 frases) y accionable para hoy, en español rioplatense, cercano pero profesional. Sin emojis excesivos, sin listas.",
        messages: [{ role: "user", content: "Dame el consejo del día." }],
        maxTokens: 150,
      });
      setTip(text);
      await storeSet(`tip:${today}`, text);
    } catch {
      setTip("No pude generar tu consejo de hoy — probá de nuevo en un rato.");
    }
    setLoadingTip(false);
  }, [profile, targets, today]);

  useEffect(() => { loadTip(); }, [loadTip]);

  const lastWeight = weightLogs.length ? weightLogs[weightLogs.length - 1].weight : profile.peso;
  const imc = bmi(lastWeight, profile.altura);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Hola 👋</h1>
        <p style={{ color: T.text, fontSize: 14, margin: "4px 0 0", fontWeight: 600 }}>{formatDateLong(today)}</p>
        <p style={{ color: T.dim, fontSize: 13, margin: "2px 0 0" }}>
          {streak > 0 ? `🔥 ${streak} días consecutivos de seguimiento` : "Empezá tu racha registrando hoy"}
        </p>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
          <Ring value={kcalConsumed} max={targets.kcal} color={T.amber} label="Calorías" unit="k" />
          <Ring value={proteinConsumed} max={targets.protein} color={T.teal} label="Proteína" unit="g" />
          <Ring value={todayWaterMl / 1000} max={targets.water} color={T.coral} label="Agua" unit="L" />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
          <Button variant="mint" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => addWater(250)}><GlassWater size={14} /> +250ml</Button>
          <Button variant="mint" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => addWater(500)}><GlassWater size={14} /> +500ml</Button>
          <Button variant="outline" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => goTo("nutrition")}><UtensilsCrossed size={14} /> Registrar comida</Button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <div style={{ color: T.dim, fontSize: 12 }}>Peso actual</div>
          <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 24, fontWeight: 600 }}>{lastWeight} kg</div>
          <div style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>Objetivo: {profile.pesoObjetivo} kg</div>
        </Card>
        <Card>
          <div style={{ color: T.dim, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Flame size={13} color={T.coral} /> Quemadas hoy</div>
          <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 24, fontWeight: 600 }}>{todayBurn} kcal</div>
          <div style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>IMC orientativo: {imc}</div>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Sparkles size={16} color={T.amber} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Consejo de tu IA</span>
        </div>
        <p style={{ margin: 0, color: T.text, fontSize: 14, lineHeight: 1.5, opacity: loadingTip ? 0.5 : 1 }}>
          {loadingTip ? "Pensando..." : tip}
        </p>
      </Card>

      <Card>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Check-in rápido de hoy</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["energía", "hambre", "sueño", "ánimo"].map((k) => (
            <div key={k} style={{ flex: "1 1 100px" }}>
              <div style={{ fontSize: 11, color: T.dim, marginBottom: 4, textTransform: "capitalize" }}>{k}</div>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3].map((v) => (
                  <button key={v} onClick={() => setCheckin((p) => ({ ...p, [k]: v }))} style={{
                    flex: 1, height: 26, borderRadius: 6, cursor: "pointer",
                    border: `1px solid ${T.border}`,
                    background: checkin?.[k] === v ? T.teal : T.surface2,
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   NUTRIAI CHAT
============================================================ */
function AIChat({ profile, targets, messages, setMessages }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await callClaude({
        system: profileContext(profile, targets) + "\nSos NutriAI, un asistente de nutrición y entrenamiento cercano y directo. Respuestas cortas (máximo 4-5 líneas), en español rioplatense, sin relleno.",
        messages: next.slice(-10),
        maxTokens: 500,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Uh, tuve un problema para responder. Probá de nuevo." }]);
    }
    setLoading(false);
  };

  const suggestions = ["¿Qué puedo cenar?", "Tengo pollo y arroz, ¿qué hago?", "¿Cuánta proteína necesito?", "Hoy no entrené, ¿cambio algo?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <Bot size={20} color={T.amber} /> NutriAI
      </h1>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {suggestions.map((s) => <Chip key={s} onClick={() => send(s)}>{s}</Chip>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div style={{
              background: m.role === "user" ? T.amber : T.surface2,
              color: m.role === "user" ? T.amberText : T.text,
              padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ color: T.dim, fontSize: 13 }}>NutriAI está escribiendo...</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Preguntale algo a NutriAI..." value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} />
        <Button onClick={() => send(input)} disabled={loading}><Send size={16} /></Button>
      </div>
    </div>
  );
}

/* ============================================================
   RECIPE GENERATOR
============================================================ */
function Recipes({ profile, targets, foodLog, addFood, removeFood }) {
  const [ingredients, setIngredients] = useState("");
  const [filters, setFilters] = useState([]);
  const [maxKcal, setMaxKcal] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logged, setLogged] = useState({}); // index -> {id, slot}
  const [pickingSlot, setPickingSlot] = useState(null);
  const toggleFilter = (f) => setFilters((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  const today = todayStr();
  const todayFood = foodLog.filter((f) => f.date === today);
  const consumedKcal = todayFood.reduce((s, f) => s + (f.kcal || 0), 0);
  const remainingKcal = Math.max(0, targets.kcal - consumedKcal);

  const generate = async () => {
    if (!ingredients.trim()) return;
    setLoading(true);
    try {
      const cap = maxKcal || remainingKcal;
      const text = await callClaude({
        system: profileContext(profile, targets) + `\nEl usuario ya consumió ${consumedKcal} kcal hoy. Le quedan aproximadamente ${remainingKcal} kcal disponibles para el resto del día. Generá exactamente 3 recetas usando principalmente los ingredientes que te den, y que CADA porción quepa dentro de ${cap} kcal — no lo superes, para que no se pase de su objetivo diario. Filtros pedidos: ${filters.join(", ") || "ninguno"}.
Respondé SOLO con JSON válido, sin texto extra, con este formato exacto:
{"recipes":[{"name":"","time_min":0,"difficulty":"fácil|media|difícil","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"servings":0,"ingredients":["cantidad + ingrediente"],"steps":["paso corto"]}]}`,
        messages: [{ role: "user", content: `Tengo estos ingredientes: ${ingredients}` }],
        maxTokens: 1200,
      });
      setRecipes(parseJSON(text)?.recipes || []);
      setLogged({});
    } catch { setRecipes([]); }
    setLoading(false);
  };

  const markEaten = (i, r, slot) => {
    const id = Date.now();
    addFood({ id, date: today, slot, name: r.name, kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g });
    setLogged((p) => ({ ...p, [i]: { id, slot } }));
    setPickingSlot(null);
  };
  const unmark = (i) => {
    if (logged[i]) removeFood(logged[i].id);
    setLogged((p) => { const n = { ...p }; delete n[i]; return n; });
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>¿Qué tenés en tu cocina?</h1>
      <p style={{ color: T.dim, fontSize: 13, marginBottom: 10 }}>Escribí tus ingredientes y generamos recetas reales con tu perfil en cuenta.</p>
      <div style={{ display: "inline-block", background: T.surface2, padding: "6px 12px", borderRadius: 99, fontSize: 12, color: T.amber, fontWeight: 600, marginBottom: 12 }}>
        Te quedan ~{remainingKcal} kcal disponibles hoy
      </div>
      <Card style={{ marginBottom: 16 }}>
        <textarea style={{ ...inputStyle, width: "100%", minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
          placeholder="Pollo, arroz, tomate, huevo, cebolla y queso..." value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          {["Alta proteína", "Bajo en calorías", "Vegetariano", "Rápido", "Económico", "Sin gluten"].map((f) => (
            <Chip key={f} active={filters.includes(f)} onClick={() => toggleFilter(f)}>{f}</Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input style={{ ...inputStyle, width: 140 }} type="number" placeholder={`Máx kcal (def. ${remainingKcal})`} value={maxKcal} onChange={(e) => setMaxKcal(e.target.value)} />
          <Button onClick={generate} disabled={loading}>{loading ? "Generando..." : "Generar recetas"} <Sparkles size={16} /></Button>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
        {recipes.map((r, i) => (
          <Card key={i}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{r.name}</div>
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: T.dim, marginBottom: 10 }}>
              <span>⏱ {r.time_min} min</span><span>· {r.difficulty}</span><span>· {r.servings} porciones</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <Tag color={T.amber}>{r.kcal} kcal</Tag><Tag color={T.teal}>{r.protein_g}g prot</Tag>
              <Tag color={T.dim}>{r.carbs_g}g carb</Tag><Tag color={T.dim}>{r.fat_g}g grasa</Tag>
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 4, fontWeight: 600 }}>Ingredientes</div>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>{(r.ingredients || []).map((ing, j) => <li key={j}>{ing}</li>)}</ul>
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 4, fontWeight: 600 }}>Preparación</div>
            <ol style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>{(r.steps || []).map((s, j) => <li key={j}>{s}</li>)}</ol>

            {logged[i] ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: T.surface2, borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}><Check size={13} style={{ verticalAlign: -2 }} /> Registrada en {logged[i].slot}</span>
                <button onClick={() => unmark(i)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, fontSize: 12 }}>Quitar</button>
              </div>
            ) : pickingSlot === i ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"].map((s) => (
                  <Chip key={s} onClick={() => markEaten(i, r, s)}>{s}</Chip>
                ))}
              </div>
            ) : (
              <Button variant="mint" style={{ width: "100%", justifyContent: "center", fontSize: 12 }} onClick={() => setPickingSlot(i)}>
                <UtensilsCrossed size={14} /> Ya la comí — registrar
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   MEAL PLAN
============================================================ */
function MealPlan({ profile, targets, plan, setPlan, foodLog, addFood, removeFood }) {
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(null);
  const [logged, setLogged] = useState({}); // slot -> entryId

  const today = todayStr();
  const todayFood = foodLog.filter((f) => f.date === today);
  const consumedKcal = todayFood.reduce((s, f) => s + (f.kcal || 0), 0);
  const consumedProtein = todayFood.reduce((s, f) => s + (f.protein || 0), 0);
  const remainingKcal = Math.max(0, targets.kcal - consumedKcal);
  const remainingProtein = Math.max(0, targets.protein - consumedProtein);

  const generateDay = async () => {
    setLoading(true);
    try {
      const text = await callClaude({
        system: profileContext(profile, targets) + `\nEl usuario ya consumió ${consumedKcal} kcal y ${consumedProtein}g de proteína hoy. Le quedan ${remainingKcal} kcal y ${remainingProtein}g de proteína disponibles. Generá un plan de comidas para lo que resta del día (Desayuno, Almuerzo, Merienda y Cena, salteando las que ya haya pasado si tiene sentido) cuya suma NO supere ${remainingKcal} kcal totales. Respondé SOLO JSON:
{"meals":[{"slot":"Desayuno","name":"","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"items":["item con cantidad"]}]}`,
        messages: [{ role: "user", content: "Generá mi plan de hoy." }],
        maxTokens: 900,
      });
      const parsed = parseJSON(text);
      if (parsed?.meals) setPlan(parsed.meals);
      setLogged({});
    } catch { /* noop */ }
    setLoading(false);
  };

  const replaceMeal = async (slot) => {
    setReplacing(slot);
    try {
      const text = await callClaude({
        system: profileContext(profile, targets) + `\nEl usuario ya consumió ${consumedKcal} kcal hoy y le quedan ${remainingKcal} kcal disponibles en total contando esta comida. Generá UNA alternativa para "${slot}" nutricionalmente similar a la actual (mismo rango de kcal/macros aprox) que quepa dentro de ese remanente. Respondé SOLO JSON:
{"slot":"${slot}","name":"","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"items":["item con cantidad"]}`,
        messages: [{ role: "user", content: `Reemplazar ${slot}` }],
        maxTokens: 300,
      });
      const parsed = parseJSON(text);
      if (parsed) setPlan((p) => p.map((m) => (m.slot === slot ? parsed : m)));
    } catch { /* noop */ }
    setReplacing(null);
  };

  const markEaten = (m) => {
    const id = Date.now();
    addFood({ id, date: today, slot: m.slot, name: m.name, kcal: m.kcal, protein: m.protein_g, carbs: m.carbs_g, fat: m.fat_g });
    setLogged((p) => ({ ...p, [m.slot]: id }));
  };
  const unmark = (slot) => {
    if (logged[slot]) removeFood(logged[slot]);
    setLogged((p) => { const n = { ...p }; delete n[slot]; return n; });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mi plan de alimentación</h1>
          <p style={{ color: T.dim, fontSize: 13, margin: "4px 0 0" }}>Objetivo diario: {targets.kcal} kcal · {targets.protein}g proteína</p>
        </div>
        <Button onClick={generateDay} disabled={loading}>{loading ? "Generando..." : plan.length ? "Regenerar día" : "Generar plan de hoy"} <RefreshCw size={15} /></Button>
      </div>
      <div style={{ display: "inline-block", background: T.surface2, padding: "6px 12px", borderRadius: 99, fontSize: 12, color: T.amber, fontWeight: 600, margin: "8px 0 16px" }}>
        Te quedan ~{remainingKcal} kcal disponibles hoy
      </div>
      {plan.length === 0 && !loading && (
        <Card style={{ textAlign: "center", padding: 32, color: T.dim }}>Todavía no generaste tu plan de hoy. Tocá "Generar plan de hoy".</Card>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {plan.map((m) => (
          <Card key={m.slot}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.6 }}>{m.slot}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{m.name}</div>
              </div>
              <Button variant="ghost" onClick={() => replaceMeal(m.slot)} disabled={replacing === m.slot} style={{ padding: "6px 10px", fontSize: 12 }}>
                {replacing === m.slot ? "..." : <><RefreshCw size={13} /> Reemplazar</>}
              </Button>
            </div>
            <div style={{ display: "flex", gap: 8, margin: "8px 0", flexWrap: "wrap" }}>
              <Tag color={T.amber}>{m.kcal} kcal</Tag><Tag color={T.teal}>{m.protein_g}g prot</Tag>
              <Tag color={T.dim}>{m.carbs_g}g carb</Tag><Tag color={T.dim}>{m.fat_g}g grasa</Tag>
            </div>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: T.dim }}>{(m.items || []).map((it, j) => <li key={j}>{it}</li>)}</ul>

            {logged[m.slot] ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: T.surface2, borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}><Check size={13} style={{ verticalAlign: -2 }} /> Ya la registraste como consumida</span>
                <button onClick={() => unmark(m.slot)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, fontSize: 12 }}>Quitar</button>
              </div>
            ) : (
              <Button variant="mint" style={{ width: "100%", justifyContent: "center", fontSize: 12 }} onClick={() => markEaten(m)}>
                <UtensilsCrossed size={14} /> Ya la comí — registrar
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   FOOD TRACKER — registro real de comidas, alimenta el dashboard
============================================================ */
function FoodTracker({ profile, targets, foodLog, addFood, removeFood }) {
  const [mode, setMode] = useState("texto"); // "texto" | "foto"
  const [slot, setSlot] = useState("Desayuno");
  const [desc, setDesc] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [justAdded, setJustAdded] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef(null);
  const today = todayStr();
  const todayItems = foodLog.filter((f) => f.date === today);

  const estimateWithAI = async () => {
    if (!desc.trim()) return;
    setLoading(true); setError(null); setJustAdded(false);
    try {
      const text = await callClaude({
        system: "Sos un nutricionista. Estimá los valores nutricionales de una comida descrita por el usuario, en base a porciones habituales. Respondé SOLO JSON, sin texto extra: {\"name\":\"\",\"kcal\":0,\"protein\":0,\"carbs\":0,\"fat\":0}",
        messages: [{ role: "user", content: desc }],
        maxTokens: 200,
      });
      const parsed = normalizeFoodEstimate(parseJSON(text));
      if (parsed) setEstimate(parsed);
      else setError(`No pude interpretar la respuesta de la IA. Lo que devolvió: "${(text || "(vacío)").slice(0, 250)}"`);
    } catch (e) {
      setError(e.message || "Hubo un problema al conectar con la IA. Probá de nuevo.");
    }
    setLoading(false);
  };

  const onPhotoSelected = async (file) => {
    if (!file) return;
    setError(null); setJustAdded(false); setPhotoLoading(true);
    try {
      const { base64, mediaType, previewUrl } = await compressImage(file);
      setPhotoPreview(previewUrl);
      setPhotoMediaType(mediaType);
      setPhotoBase64(base64);
      setEstimate(null);
    } catch (e) {
      setError(e.message || "No se pudo procesar la foto. Probá con otra imagen.");
    }
    setPhotoLoading(false);
  };

  const estimateFromPhoto = async () => {
    if (!photoBase64) return;
    setLoading(true); setError(null); setJustAdded(false);
    try {
      const text = await callClaude({
        system: "Sos un nutricionista analizando una foto de un plato de comida. Identificá los alimentos y estimá una porción aproximada. IMPORTANTE: esto es una estimación visual, nunca una medición exacta — respondé con valores razonables aunque no puedas ver cantidades exactas. Respondé SOLO JSON, sin texto extra: {\"name\":\"\",\"kcal\":0,\"protein\":0,\"carbs\":0,\"fat\":0}",
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: photoMediaType, data: photoBase64 } },
            { type: "text", text: "Estimá las calorías y macros de esta comida." },
          ],
        }],
        maxTokens: 250,
      });
      const parsed = normalizeFoodEstimate(parseJSON(text));
      if (parsed) setEstimate(parsed);
      else setError(`No pude interpretar la respuesta de la IA sobre la foto. Lo que devolvió: "${(text || "(vacío)").slice(0, 250)}"`);
    } catch (e) {
      setError(e.message || "Hubo un problema al analizar la foto. Probá de nuevo.");
    }
    setLoading(false);
  };

  const confirmAdd = () => {
    if (!estimate) return;
    addFood({ id: Date.now(), date: today, slot, ...estimate });
    setDesc(""); setEstimate(null); setPhotoPreview(null); setPhotoBase64(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 3000);
  };

  const discardEstimate = () => {
    setEstimate(null); setPhotoPreview(null); setPhotoBase64(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalToday = todayItems.reduce((s, f) => s + (f.kcal || 0), 0);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Registrar comida</h1>
      <p style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>Describí lo que comiste o subí una foto — la IA estima kcal y macros, vos confirmás.</p>

      {justAdded && (
        <div style={{ background: "rgba(111,198,182,0.15)", border: `1px solid ${T.teal}`, color: T.teal, borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Check size={15} /> Comida registrada — ya suma a tu total de hoy
        </div>
      )}
      {error && (
        <div style={{ background: "rgba(243,169,138,0.15)", border: `1px solid ${T.coral}`, color: "#B5502F", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"].map((s) => (
            <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{s}</Chip>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Chip active={mode === "texto"} onClick={() => { setMode("texto"); setError(null); }}>✏️ Describir</Chip>
          <Chip active={mode === "foto"} onClick={() => { setMode("foto"); setError(null); }}>📷 Foto</Chip>
        </div>

        {mode === "texto" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Ej: 200g de pollo a la plancha con arroz y ensalada"
              value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && estimateWithAI()} />
            <Button onClick={estimateWithAI} disabled={loading || !desc.trim()}>{loading ? "..." : "Estimar"} <Sparkles size={15} /></Button>
          </div>
        ) : (
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
              onChange={(e) => onPhotoSelected(e.target.files?.[0])}
              style={{ fontSize: 13, color: T.dim, marginBottom: 10 }} />
            {photoLoading && <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>Procesando imagen...</div>}
            {photoPreview && (
              <div style={{ marginBottom: 10 }}>
                <img src={photoPreview} alt="Foto de la comida" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} />
                <Button onClick={estimateFromPhoto} disabled={loading}>{loading ? "Analizando..." : "Estimar calorías de la foto"} <Sparkles size={15} /></Button>
              </div>
            )}
            <p style={{ fontSize: 11, color: T.dim, margin: 0 }}>
              La estimación por foto es aproximada — la IA no puede medir el peso exacto de la porción. Revisá y ajustá antes de confirmar.
            </p>
          </div>
        )}

        {estimate && (
          <div style={{ marginTop: 14, padding: 12, background: T.surface2, borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{estimate.name}</div>
            {mode === "foto" && <div style={{ fontSize: 11, color: T.coral, marginBottom: 8 }}>Estimación aproximada por foto — ajustá si hace falta</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10, marginTop: mode === "texto" ? 8 : 0 }}>
              {[["kcal", "kcal"], ["protein", "prot g"], ["carbs", "carb g"], ["fat", "grasa g"]].map(([k, l]) => (
                <Field key={k} label={l}>
                  <input style={inputStyle} type="number" value={estimate[k]} onChange={(e) => setEstimate((p) => ({ ...p, [k]: Number(e.target.value) }))} />
                </Field>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={confirmAdd}><Check size={15} /> Agregar a {slot}</Button>
              <Button variant="ghost" onClick={discardEstimate}><X size={15} /> Descartar</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Hoy registraste</span>
          <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: T.amber }}>{totalToday} / {targets.kcal} kcal</span>
        </div>
        {["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"].map((s) => {
          const items = todayItems.filter((f) => f.slot === s);
          if (!items.length) return null;
          return (
            <div key={s} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{s}</div>
              {items.map((it) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13 }}>{it.name} <span style={{ color: T.dim }}>· {it.kcal} kcal</span></span>
                  <button onClick={() => removeFood(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          );
        })}
        {todayItems.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>Todavía no registraste nada hoy.</div>}
      </Card>
    </div>
  );
}

/* ============================================================
   LISTA DE COMPRAS — generada desde el plan de comidas
============================================================ */
function ShoppingList({ profile, plan, list, setList }) {
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState("");

  const generate = async () => {
    setLoading(true);
    try {
      const itemsText = plan.length ? plan.flatMap((m) => m.items || []).join(", ") : "una semana estándar según el perfil";
      const text = await callClaude({
        system: "Organizá una lista de compras a partir de estos ingredientes, agrupada por categoría (Frutas, Verduras, Carnes, Pescados, Lácteos, Huevos, Cereales, Legumbres, Otros). Respondé SOLO JSON: {\"items\":[{\"category\":\"\",\"name\":\"\"}]}",
        messages: [{ role: "user", content: `Ingredientes: ${itemsText}` }],
        maxTokens: 700,
      });
      const parsed = parseJSON(text);
      if (parsed?.items) {
        setList(parsed.items.map((it, i) => ({ id: Date.now() + i, category: it.category, name: it.name, checked: false })));
      }
    } catch { /* noop */ }
    setLoading(false);
  };

  const toggle = (id) => setList((p) => p.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)));
  const remove = (id) => setList((p) => p.filter((it) => it.id !== id));
  const addManual = () => {
    if (!manualItem.trim()) return;
    setList((p) => [...p, { id: Date.now(), category: "Otros", name: manualItem, checked: false }]);
    setManualItem("");
  };

  const categories = [...new Set(list.map((it) => it.category))];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Lista de compras</h1>
        <Button onClick={generate} disabled={loading}>{loading ? "Generando..." : "Generar desde mi plan"} <ShoppingCart size={15} /></Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Agregar producto manual..." value={manualItem}
            onChange={(e) => setManualItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManual()} />
          <Button variant="ghost" onClick={addManual}><Plus size={15} /></Button>
        </div>
      </Card>

      {list.length === 0 && !loading && <Card style={{ textAlign: "center", padding: 32, color: T.dim }}>Generá tu lista desde el plan de comidas o agregá productos manualmente.</Card>}

      {categories.map((cat) => (
        <Card key={cat} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: T.amber }}>{cat}</div>
          {list.filter((it) => it.category === cat).map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <button onClick={() => toggle(it.id)} style={{
                width: 20, height: 20, borderRadius: 6, border: `1px solid ${T.border}`, cursor: "pointer",
                background: it.checked ? T.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{it.checked && <Check size={13} color={T.tealText} />}</button>
              <span style={{ fontSize: 14, textDecoration: it.checked ? "line-through" : "none", color: it.checked ? T.dim : T.text, flex: 1 }}>{it.name}</span>
              <button onClick={() => remove(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={14} /></button>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   WORKOUTS — rutina con video de técnica + registro de actividad
============================================================ */
function ExerciseVideo({ name }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoId = findExerciseVideo(name);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
        color: T.amber, background: "none", border: "none", cursor: "pointer", padding: "4px 0", minHeight: 32,
      }}>
        <PlayCircle size={14} /> {open ? "Ocultar video" : "Ver video de técnica"}
      </button>
      {open && (
        <div>
          {videoId && !failed ? (
            <div style={{ marginTop: 8, borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", background: "#000" }}>
              <iframe
                width="100%" height="100%"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0`}
                title={`Técnica: ${name}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onError={() => setFailed(true)}
                style={{ display: "block" }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 8, padding: 10, background: T.surface2, borderRadius: 10, fontSize: 12, color: T.dim }}>
              Todavía no tengo un video propio para "{name}".
            </div>
          )}
          <a href={youtubeSearchUrl(name)} target="_blank" rel="noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12,
            color: T.amber, textDecoration: "none", fontWeight: 600,
          }}>
            {videoId ? "¿No carga? Abrilo directo en YouTube" : "Buscarlo en YouTube"} <ChevronRight size={13} />
          </a>
        </div>
      )}
    </div>
  );
}

function WorkoutRoutine({ profile, targets, workout, setWorkout, addExercise, removeExercise }) {
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    setLoading(true);
    try {
      const text = await callClaude({
        system: profileContext(profile, targets) + `\nGenerá UNA rutina de entrenamiento para hoy, coherente con el equipamiento y nivel del usuario. Respondé SOLO JSON:
{"title":"","exercises":[{"name":"","sets":0,"reps":"8-12","rest_sec":60,"muscles":""}]}`,
        messages: [{ role: "user", content: "Generá mi entrenamiento de hoy." }],
        maxTokens: 700,
      });
      const parsed = parseJSON(text);
      if (parsed) setWorkout({ ...parsed, completed: {}, date: todayStr() });
    } catch { /* noop */ }
    setLoading(false);
  };

  const toggleDone = (ex) => {
    const current = workout.completed?.[ex.name];
    if (current) {
      removeExercise(current);
      setWorkout((w) => ({ ...w, completed: { ...(w.completed || {}), [ex.name]: null } }));
    } else {
      const est = estimateRoutineBurn(ex, Number(profile.peso));
      const id = Date.now() + Math.random();
      addExercise({ id, date: todayStr(), activity: ex.name, minutes: est.minutes, kcal: est.kcal });
      setWorkout((w) => ({ ...w, completed: { ...(w.completed || {}), [ex.name]: id } }));
    }
  };

  const doneCount = workout ? Object.values(workout.completed || {}).filter(Boolean).length : 0;
  const totalEx = workout?.exercises?.length || 0;
  const totalBurn = workout ? (workout.exercises || []).reduce((s, ex) => (workout.completed?.[ex.name] ? s + estimateRoutineBurn(ex, Number(profile.peso)).kcal : s), 0) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mi entrenamiento</h1>
        <Button onClick={generate} disabled={loading}>{loading ? "Generando..." : "Generar rutina de hoy"} <Dumbbell size={15} /></Button>
      </div>

      {!workout && !loading && (
        <Card style={{ textAlign: "center", padding: 32, color: T.dim }}>
          Generá tu rutina según tu equipamiento ({profile.equipamiento}) y nivel ({profile.nivelEntreno}).
        </Card>
      )}

      {workout && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{workout.title}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {totalEx > 0 && <Tag color={doneCount === totalEx ? T.teal : T.dim}>{doneCount}/{totalEx} hechos</Tag>}
              {totalBurn > 0 && <Tag color={T.coral}>🔥 {totalBurn} kcal</Tag>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(workout.exercises || []).map((ex, i) => {
              const done = !!workout.completed?.[ex.name];
              const est = estimateRoutineBurn(ex, Number(profile.peso));
              return (
                <div key={i} style={{ padding: 12, background: T.surface2, borderRadius: 12, opacity: done ? 0.7 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, textDecoration: done ? "line-through" : "none" }}>{ex.name}</div>
                      <div style={{ fontSize: 12, color: T.dim }}>{ex.sets} x {ex.reps} · descanso {ex.rest_sec}s · {ex.muscles}</div>
                      <div style={{ fontSize: 11, color: T.coral, marginTop: 2 }}>~{est.kcal} kcal si lo completás</div>
                    </div>
                    <button onClick={() => toggleDone(ex)} style={{
                      border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", minHeight: 40, minWidth: 40,
                      background: done ? T.teal : T.surface, color: done ? T.tealText : T.dim,
                    }}><Check size={15} /></button>
                  </div>
                  <ExerciseVideo name={ex.name} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function ActivityLog({ profile, exerciseLog, addExercise, removeExercise }) {
  const [activity, setActivity] = useState(MET_ACTIVITIES[0].name);
  const [customMet, setCustomMet] = useState("");
  const [minutes, setMinutes] = useState("30");
  const today = todayStr();
  const todayItems = exerciseLog.filter((e) => e.date === today);
  const totalBurn = todayItems.reduce((s, e) => s + e.kcal, 0);

  const selected = MET_ACTIVITIES.find((a) => a.name === activity);
  const met = selected?.met ?? Number(customMet);
  const preview = calcBurn(met, Number(profile.peso), Number(minutes));

  const add = () => {
    if (!met || !minutes) return;
    addExercise({ id: Date.now(), date: today, activity, minutes: Number(minutes), kcal: preview });
    setMinutes("30");
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Registrar actividad</h1>
      <p style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>Calculamos las calorías quemadas según tu peso, la actividad y el tiempo (fórmula MET real).</p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Actividad">
            <select style={inputStyle} value={activity} onChange={(e) => setActivity(e.target.value)}>
              {MET_ACTIVITIES.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Minutos">
            <input style={inputStyle} type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        </div>
        {selected?.met === null && (
          <Field label="MET personalizado (intensidad — ej: 4 suave, 8 intenso)">
            <input style={inputStyle} type="number" value={customMet} onChange={(e) => setCustomMet(e.target.value)} />
          </Field>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <div style={{ fontSize: 13, color: T.dim }}>
            Estimado: <span style={{ color: T.amber, fontWeight: 700, fontFamily: "ui-monospace,monospace" }}>{preview} kcal</span>
          </div>
          <Button onClick={add}><Plus size={15} /> Registrar</Button>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Actividad de hoy</span>
          <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: T.coral }}><Flame size={13} style={{ verticalAlign: -2 }} /> {totalBurn} kcal</span>
        </div>
        {todayItems.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>Todavía no registraste actividad hoy.</div>}
        {todayItems.map((e) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13 }}>{e.activity} <span style={{ color: T.dim }}>· {e.minutes} min · {e.kcal} kcal</span></span>
            <button onClick={() => removeExercise(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><Trash2 size={14} /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   CALENDARIO — navegación mensual + resumen del día seleccionado
============================================================ */
function CalendarView({ profile, targets, foodLog, exerciseLog, weightLogs, checkins }) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => { const [y, m] = today.split("-"); return { y: Number(y), m: Number(m) - 1 }; });
  const [selected, setSelected] = useState(today);

  const activeSet = useMemo(() => {
    const s = new Set();
    foodLog.forEach((f) => s.add(f.date));
    exerciseLog.forEach((e) => s.add(e.date));
    weightLogs.forEach((w) => s.add(w.date));
    Object.keys(checkins || {}).forEach((d) => s.add(d));
    return s;
  }, [foodLog, exerciseLog, weightLogs, checkins]);

  const firstOfMonth = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=domingo

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateOf = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const changeMonth = (delta) => {
    let m = cursor.m + delta, y = cursor.y;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCursor({ y, m });
  };

  const selFood = foodLog.filter((f) => f.date === selected);
  const selKcal = selFood.reduce((s, f) => s + (f.kcal || 0), 0);
  const selProtein = selFood.reduce((s, f) => s + (f.protein || 0), 0);
  const selBurn = exerciseLog.filter((e) => e.date === selected).reduce((s, e) => s + (e.kcal || 0), 0);
  const selWeight = weightLogs.find((w) => w.date === selected);
  const selCheckin = checkins?.[selected];

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button onClick={() => changeMonth(-1)} style={{ background: T.surface2, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", minHeight: 36, minWidth: 36 }}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 15, textTransform: "capitalize" }}>{MESES[cursor.m]} {cursor.y}</span>
          <button onClick={() => changeMonth(1)} style={{ background: T.surface2, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", minHeight: 36, minWidth: 36 }}><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, color: T.dim, fontWeight: 600 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = dateOf(d);
            const active = activeSet.has(ds);
            const isToday = ds === today;
            const isSelected = ds === selected;
            return (
              <button key={i} onClick={() => setSelected(ds)} style={{
                aspectRatio: "1", borderRadius: 10, border: isToday ? `1.5px solid ${T.amber}` : "1px solid transparent",
                background: isSelected ? T.amber : "transparent", color: isSelected ? T.amberText : T.text,
                cursor: "pointer", fontSize: 13, fontWeight: isToday ? 700 : 500, position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              }}>
                {d}
                {active && <span style={{ width: 4, height: 4, borderRadius: 99, background: isSelected ? T.amberText : T.teal }} />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{formatDateLong(selected)}</div>
        {selFood.length === 0 && !selWeight && selBurn === 0 && !selCheckin ? (
          <div style={{ color: T.dim, fontSize: 13 }}>Sin registros ese día.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Tag color={T.amber}>{selKcal} / {targets.kcal} kcal</Tag>
              <Tag color={T.teal}>{selProtein}g prot</Tag>
              {selBurn > 0 && <Tag color={T.coral}>🔥 {selBurn} kcal quemadas</Tag>}
              {selWeight && <Tag color={T.dim}>⚖ {selWeight.weight} kg</Tag>}
            </div>
            {selFood.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: T.dim, fontWeight: 600, marginBottom: 4 }}>Comidas registradas</div>
                {selFood.map((f) => (
                  <div key={f.id} style={{ fontSize: 13, padding: "4px 0", color: T.text }}>
                    {f.slot ? <span style={{ color: T.dim }}>{f.slot}: </span> : null}{f.name} <span style={{ color: T.dim }}>· {f.kcal} kcal</span>
                  </div>
                ))}
              </div>
            )}
            {selCheckin && (
              <div style={{ fontSize: 12, color: T.dim }}>
                Check-in: {Object.entries(selCheckin).map(([k, v]) => `${k} ${v}/3`).join(" · ")}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   PROGRESS
============================================================ */
function Progress({ profile, targets, weightLogs, setWeightLogs, streak, foodLog, exerciseLog, checkins }) {
  const [tab, setTab] = useState("peso");
  const [newWeight, setNewWeight] = useState("");
  const addWeight = () => {
    if (!newWeight) return;
    const entry = { date: todayStr(), weight: Number(newWeight) };
    const next = [...weightLogs.filter((w) => w.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
    setWeightLogs(next);
    setNewWeight("");
  };
  const chartData = weightLogs.map((w) => ({ date: w.date.slice(5), peso: w.weight }));

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Mi progreso</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Chip active={tab === "peso"} onClick={() => setTab("peso")}>Peso</Chip>
        <Chip active={tab === "calendario"} onClick={() => setTab("calendario")}>Calendario</Chip>
      </div>

      {tab === "peso" ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Evolución del peso</span>
              <span style={{ fontSize: 13, color: T.dim }}>🔥 {streak} días de racha</span>
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke={T.dim} fontSize={11} />
                  <YAxis stroke={T.dim} fontSize={11} domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="peso" stroke={T.amber} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: T.dim, fontSize: 13, padding: "20px 0", textAlign: "center" }}>Registrá al menos 2 pesajes para ver tu gráfico.</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="Peso de hoy (kg)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
              <Button onClick={addWeight}><Plus size={16} /> Registrar</Button>
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Historial</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...weightLogs].reverse().slice(0, 10).map((w) => (
                <div key={w.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.dim, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span>{w.date}</span><span style={{ color: T.text, fontFamily: "ui-monospace,monospace" }}>{w.weight} kg</span>
                </div>
              ))}
              {weightLogs.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>Sin registros todavía.</div>}
            </div>
          </Card>
        </>
      ) : (
        <CalendarView profile={profile} targets={targets} foodLog={foodLog} exerciseLog={exerciseLog} weightLogs={weightLogs} checkins={checkins} />
      )}
    </div>
  );
}

/* ============================================================
   SETTINGS
============================================================ */
function SettingsView({ profile, onReset }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px" }}>Ajustes</h1>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Tu perfil</div>
        <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.7 }}>
          {profile.sexo}, {profile.edad} años · {profile.altura}cm · {profile.peso}kg → {profile.pesoObjetivo}kg<br />
          Objetivo: {profile.objetivo} · Actividad: {profile.actividad}
        </div>
      </Card>
      <Card style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={16} color={T.dim} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: T.dim, lineHeight: 1.6 }}>
          Esta app da recomendaciones orientativas generadas por IA. No reemplaza a un médico, nutricionista
          ni entrenador certificado. Ante condiciones médicas, embarazo o síntomas relevantes, consultá con un profesional.
        </p>
      </Card>
      <Button variant="outline" onClick={onReset} style={{ color: T.coral, borderColor: T.coral }}><Trash2 size={15} /> Borrar todos mis datos</Button>
    </div>
  );
}

/* ============================================================
   NAV
============================================================ */
const NAV = [
  { id: "dashboard", label: "Inicio", icon: Home },
  { id: "nutrition", label: "Nutrición", icon: Salad },
  { id: "workouts", label: "Entreno", icon: Dumbbell },
  { id: "progress", label: "Progreso", icon: LineChartIcon },
  { id: "ai", label: "IA", icon: Bot },
];

/* ============================================================
   APP ROOT
============================================================ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("dashboard");
  const [weightLogs, setWeightLogsState] = useState([]);
  const [foodLog, setFoodLogState] = useState([]);
  const [exerciseLog, setExerciseLogState] = useState([]);
  const [waterLog, setWaterLogState] = useState([]);
  const [chatMessages, setChatMessagesState] = useState([]);
  const [mealPlan, setMealPlanState] = useState([]);
  const [workout, setWorkoutState] = useState(null);
  const [shoppingList, setShoppingListState] = useState([]);
  const [checkins, setCheckins] = useState({});
  const [nutritionTab, setNutritionTab] = useState("recipes");
  const [workoutTab, setWorkoutTab] = useState("routine");

  useEffect(() => {
    (async () => {
      setProfile(await storeGet("profile", null));
      setWeightLogsState(await storeGet("weightLogs", []));
      setFoodLogState(await storeGet("foodLog", []));
      const rawExercise = await storeGet("exerciseLog", []);
      setExerciseLogState(rawExercise.filter((e) => !(e.kcal === 0 && !e.minutes))); // limpia registros viejos rotos (0 kcal / 0 min)
      setWaterLogState(await storeGet("waterLog", []));
      setChatMessagesState(await storeGet("chatMessages", []));
      setMealPlanState(await storeGet("mealPlan", []));
      setWorkoutState(await storeGet("workout", null));
      setShoppingListState(await storeGet("shoppingList", []));
      setCheckins(await storeGet("checkins", {}));
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) storeSet("weightLogs", weightLogs); }, [weightLogs, ready]);
  useEffect(() => { if (ready) storeSet("foodLog", foodLog); }, [foodLog, ready]);
  useEffect(() => { if (ready) storeSet("exerciseLog", exerciseLog); }, [exerciseLog, ready]);
  useEffect(() => { if (ready) storeSet("waterLog", waterLog); }, [waterLog, ready]);
  useEffect(() => { if (ready) storeSet("chatMessages", chatMessages); }, [chatMessages, ready]);
  useEffect(() => { if (ready) storeSet("mealPlan", mealPlan); }, [mealPlan, ready]);
  useEffect(() => { if (ready) storeSet("workout", workout); }, [workout, ready]);
  useEffect(() => { if (ready) storeSet("shoppingList", shoppingList); }, [shoppingList, ready]);
  useEffect(() => { if (ready) storeSet("checkins", checkins); }, [checkins, ready]);

  const targets = calcTargets(profile);

  const activeDates = useMemo(() => {
    const s = new Set();
    foodLog.forEach((f) => s.add(f.date));
    exerciseLog.forEach((e) => s.add(e.date));
    weightLogs.forEach((w) => s.add(w.date));
    Object.keys(checkins).forEach((d) => s.add(d));
    return s;
  }, [foodLog, exerciseLog, weightLogs, checkins]);
  const streak = calcStreak(activeDates);

  const today = todayStr();
  const setTodayCheckin = (updater) => {
    setCheckins((prev) => {
      const current = prev[today] || {};
      const nextVal = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [today]: nextVal };
    });
  };

  const finishOnboarding = async (f) => { setProfile(f); await storeSet("profile", f); };

  const addFood = (entry) => setFoodLogState((p) => [...p, entry]);
  const removeFood = (id) => setFoodLogState((p) => p.filter((f) => f.id !== id));
  const addWater = (ml) => setWaterLogState((p) => [...p, { date: todayStr(), ml }]);
  const addExercise = (entry) => setExerciseLogState((p) => [...p, entry]);
  const removeExercise = (id) => setExerciseLogState((p) => p.filter((e) => e.id !== id));

  const resetAll = async () => {
    if (!confirm("¿Borrar todos tus datos? Esto no se puede deshacer.")) return;
    for (const k of ["profile", "weightLogs", "foodLog", "exerciseLog", "waterLog", "chatMessages", "mealPlan", "workout", "shoppingList", "checkins"]) {
      await storeDelete(k);
    }
    setProfile(null); setWeightLogsState([]); setFoodLogState([]); setExerciseLogState([]);
    setWaterLogState([]); setChatMessagesState([]); setMealPlanState([]); setWorkoutState(null); setShoppingListState([]); setCheckins({});
  };

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#EAE3E7", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: T.bg, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Cargando...
      </div>
    </div>
  );
  if (!profile) return <Onboarding onDone={finishOnboarding} />;

  return (
    <div style={{ minHeight: "100vh", background: "#EAE3E7", display: "flex", justifyContent: "center" }}>
      <div style={{
        width: "100%", maxWidth: 430, minHeight: "100vh", background: T.bg, color: T.text,
        fontFamily: "ui-sans-serif, system-ui, sans-serif", position: "relative",
        boxShadow: "0 0 40px rgba(0,0,0,0.08)", overflowX: "hidden",
      }}>
        <div style={{ padding: "20px 16px 90px", width: "100%" }}>
          {view === "dashboard" && (
            <Dashboard profile={profile} targets={targets} weightLogs={weightLogs} streak={streak}
              foodLog={foodLog} exerciseLog={exerciseLog} waterLog={waterLog} addWater={addWater}
              checkin={checkins[today] || {}} setCheckin={setTodayCheckin} goTo={setView} />
          )}
          {view === "nutrition" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <Chip active={nutritionTab === "recipes"} onClick={() => setNutritionTab("recipes")}>Recetas</Chip>
                <Chip active={nutritionTab === "plan"} onClick={() => setNutritionTab("plan")}>Plan de comidas</Chip>
                <Chip active={nutritionTab === "log"} onClick={() => setNutritionTab("log")}>Registrar comida</Chip>
                <Chip active={nutritionTab === "shopping"} onClick={() => setNutritionTab("shopping")}>Lista de compras</Chip>
              </div>
              {nutritionTab === "recipes" && <Recipes profile={profile} targets={targets} foodLog={foodLog} addFood={addFood} removeFood={removeFood} />}
              {nutritionTab === "plan" && <MealPlan profile={profile} targets={targets} plan={mealPlan} setPlan={setMealPlanState} foodLog={foodLog} addFood={addFood} removeFood={removeFood} />}
              {nutritionTab === "log" && <FoodTracker profile={profile} targets={targets} foodLog={foodLog} addFood={addFood} removeFood={removeFood} />}
              {nutritionTab === "shopping" && <ShoppingList profile={profile} plan={mealPlan} list={shoppingList} setList={setShoppingListState} />}
            </div>
          )}
          {view === "workouts" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <Chip active={workoutTab === "routine"} onClick={() => setWorkoutTab("routine")}>Rutina</Chip>
                <Chip active={workoutTab === "log"} onClick={() => setWorkoutTab("log")}>Registrar actividad</Chip>
              </div>
              {workoutTab === "routine"
                ? <WorkoutRoutine profile={profile} targets={targets} workout={workout} setWorkout={setWorkoutState} addExercise={addExercise} removeExercise={removeExercise} />
                : <ActivityLog profile={profile} exerciseLog={exerciseLog} addExercise={addExercise} removeExercise={removeExercise} />}
            </div>
          )}
          {view === "progress" && (
            <Progress profile={profile} targets={targets} weightLogs={weightLogs} setWeightLogs={setWeightLogsState}
              streak={streak} foodLog={foodLog} exerciseLog={exerciseLog} checkins={checkins} />
          )}
          {view === "ai" && <AIChat profile={profile} targets={targets} messages={chatMessages} setMessages={setChatMessagesState} />}
          {view === "settings" && <SettingsView profile={profile} onReset={resetAll} />}
        </div>

        <div style={{
          position: "sticky", bottom: 0, left: 0, right: 0, zIndex: 10,
          padding: "0 10px calc(env(safe-area-inset-bottom, 10px) + 10px)",
          background: `linear-gradient(to top, ${T.bg} 60%, transparent)`,
          pointerEvents: "none",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-around", alignItems: "center",
            background: T.surface, borderRadius: 22, padding: "8px 6px",
            boxShadow: "0 8px 24px rgba(63,42,53,0.14)", border: `1px solid ${T.border}`,
            pointerEvents: "auto",
          }}>
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button key={n.id} onClick={() => setView(n.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  fontSize: 10, fontWeight: 700, padding: "6px 4px", flex: 1,
                }}>
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 30, borderRadius: 14,
                    background: active ? T.amber : "transparent", transition: "background .2s",
                  }}>
                    <Icon size={19} color={active ? T.amberText : T.dim} />
                  </span>
                  <span style={{ color: active ? T.amber : T.dim }}>{n.label}</span>
                </button>
              );
            })}
            <button onClick={() => setView("settings")} style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              fontSize: 10, fontWeight: 700, padding: "6px 4px", flex: 1,
            }}>
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 38, height: 30, borderRadius: 14,
                background: view === "settings" ? T.amber : "transparent", transition: "background .2s",
              }}>
                <Settings size={19} color={view === "settings" ? T.amberText : T.dim} />
              </span>
              <span style={{ color: view === "settings" ? T.amber : T.dim }}>Ajustes</span>
            </button>
          </div>
      </div>
      </div>

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }
        input, select, textarea { font-size: 16px !important; }
        button { touch-action: manipulation; }
        input:focus, select:focus, textarea:focus { border-color: ${T.amber} !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
      `}</style>
    </div>
  );
}
