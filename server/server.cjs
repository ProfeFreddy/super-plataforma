// C:\Users\ADMIN-15\super-plataforma\server\server.cjs
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// ✅ Cargar env lo antes posible
require("dotenv").config();

// === OpenAI ===
const OpenAI = require("openai");

// ✅ Firebase Admin (UNA sola vez, sin duplicados)
const { db, admin } = require("./firebaseAdmin.cjs");
// Alias (db ya es Firestore):
const dbAdmin = db;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", true);

/* =========================
   AUTH MIDDLEWARE (ANTES)
========================= */
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) {
            return res.status(401).json({ ok: false, error: "missing_bearer_token" });
        }

        const decoded = await admin.auth().verifyIdToken(match[1]);
        req.user = { uid: decoded.uid };
        return next();
    } catch (e) {
        return res.status(401).json({
            ok: false,
            error: "invalid_token",
            message: e?.message || "invalid_token",
        });
    }
}

/* =========================
   DEV MODE (solo local)
   - Activa con: DEV_NOAUTH=true
========================= */
const DEV_NOAUTH = String(process.env.DEV_NOAUTH || "").toLowerCase() === "true";
const DEV_UID = process.env.DEV_UID || "testPlayer";

function requireAuthOrDev(req, res, next) {
    if (DEV_NOAUTH) {
        req.user = { uid: DEV_UID };
        return next();
    }
    return requireAuth(req, res, next);
}

/* =========================
   DIAGNÓSTICO DE ARRANQUE
========================= */
try {
    const apiDir = path.join(__dirname, "..", "api");
    const items = fs.existsSync(apiDir) ? fs.readdirSync(apiDir) : [];
    console.log("[API] __dirname:", __dirname);
    console.log("[API] Contenido de /api:", items);
    console.log("[API] DEV_NOAUTH:", DEV_NOAUTH, "DEV_UID:", DEV_UID);
    console.log("[API] OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ SET" : "⛔ MISSING");
} catch (e) {
    console.warn("[API] No se pudo listar /api:", e.message);
}

/* =========================
   HEALTH
========================= */
app.get("/", (_req, res) => res.status(200).json({ ok: true, root: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, healthz: true, ts: Date.now() }));
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, api_health: true, ts: Date.now() }));
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* =========================
   IA Carrera: test
========================= */
app.get("/api/ia-carrera/test", (_req, res) => {
    res.json({ ok: true, route: "/api/ia-carrera/test", ts: Date.now() });
});

/* =========================
   MINEDUC (lo tuyo)
========================= */
try {
    app.get("/api/mineduc", require("../api/mineduc.cjs"));
    console.log("[API] /api/mineduc montado correctamente.");
} catch (e) {
    console.warn("[API] mineduc no disponible:", e.message);
}

// Evitar 404 del favicon
app.get("/favicon.ico", (_req, res) => res.status(204).end());

/* =========================
   CORS preflight FLOW
========================= */
app.options("/flow/init", cors());
app.options("/api/flow/init", cors());
app.options("/flow/create", cors());
app.options("/api/flow/create", cors());
app.options(["/flow/init", "/api/flow/init", "/flow/create", "/api/flow/create"], cors(), (_req, res) =>
    res.sendStatus(204)
);

/* =========================
   FLOW: handler real o stub
========================= */
function tryRequire(paths) {
    for (const p of paths) {
        try {
            return require(p);
        } catch { }
    }
    return null;
}

const flowModule = tryRequire(["../api/flow.cjs", "../api/flow/index.cjs", "../api/flow.js", "../api/flow/index.js"]);

let flowHandler = null;

if (flowModule) {
    flowHandler = typeof flowModule === "function" ? flowModule : flowModule.init || flowModule.default || null;

    if (typeof flowHandler !== "function") {
        console.warn("[API] flowModule cargado pero no expone función init/default; usaré stub.");
        flowHandler = async (req, res) => {
            res.json({
                ok: true,
                stub: true,
                reason: "flow module sin función exportada",
                received: req.body ?? null,
                ts: Date.now(),
            });
        };
    } else {
        console.log("[API] /flow handler REAL detectado.");
    }
} else {
    console.warn("[API] No se encontró módulo de Flow (api/flow.*); usaré stub.");
    flowHandler = async (req, res) => {
        res.json({
            ok: true,
            stub: true,
            reason: "sin módulo api/flow.*",
            received: req.body ?? null,
            ts: Date.now(),
        });
    };
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const FLOW_PATHS = ["/flow/init", "/api/flow/init", "/flow/create", "/api/flow/create"];
for (const p of FLOW_PATHS) app.post(p, wrap(flowHandler));
console.log("[API] Rutas FLOW montadas:", FLOW_PATHS.join(", "));

app.all("/flow", (req, res) => {
    console.warn("[API] Ruta /flow no encontrada:", req.method, req.path);
    res.status(404).json({
        error: true,
        msg: "ruta no encontrada",
        method: req.method,
        path: req.path,
        valid: FLOW_PATHS,
    });
});
app.all("/api/flow", (req, res) => {
    console.warn("[API] Ruta /api/flow no encontrada:", req.method, req.path);
    res.status(404).json({
        error: true,
        msg: "ruta no encontrada",
        method: req.method,
        path: req.path,
        valid: FLOW_PATHS,
    });
});

/* =========================
   IA Carrera: genera quiz (POST)
   - Devuelve ambos formatos: pregunta/opciones y question/answers
========================= */
app.post("/api/ia-carrera/genera", async (req, res) => {
    try {
        const body = req.body || {};
        const contexto = body.contexto;
        const idioma = body.idioma || "es";

        if (!contexto || typeof contexto !== "string") {
            return res.status(400).json({ error: "Falta 'contexto' en el body (texto de la clase)." });
        }

        const prompt = `
Eres un asistente experto en educación secundaria.
A partir del siguiente CONTEXTO de clase, genera UNA sola pregunta de alternativa múltiple,
con 4 opciones y marca cuál es la correcta.

CONTEXTO:
${contexto}

Devuelve SOLO un JSON con esta forma exacta:

{
  "pregunta": "texto de la pregunta en ${idioma}",
  "opciones": [
    "opción 1",
    "opción 2",
    "opción 3",
    "opción 4"
  ],
  "correctIndex": 0
}
`.trim();

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Devuelves SIEMPRE un JSON válido. Nada de explicaciones fuera del JSON.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.3,
        });

        const text = completion.choices?.[0]?.message?.content || "";
        let parsed;

        try {
            parsed = JSON.parse(text);
        } catch {
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("No se pudo parsear JSON devuelto por la IA");
            parsed = JSON.parse(match[0]);
        }

        if (!parsed || typeof parsed.pregunta !== "string" || !Array.isArray(parsed.opciones) || parsed.opciones.length < 2) {
            throw new Error("JSON devuelto por la IA no tiene el formato esperado");
        }

        const opciones = parsed.opciones.slice(0, 4).map((s) => String(s || "").trim());
        while (opciones.length < 4) opciones.push("");

        let correctIndex = Number(parsed.correctIndex ?? 0);
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;

        return res.json({
            pregunta: parsed.pregunta,
            opciones,
            correctIndex,
            question: parsed.pregunta,
            answers: opciones,
            source: "openai",
        });
    } catch (err) {
        console.error("Error en /api/ia-carrera/genera", err?.message || err);

        const msg = String(err?.message || "").toLowerCase();
        const isQuota =
            err?.status === 429 || err?.statusCode === 429 || msg.includes("quota") || msg.includes("rate limit");

        if (isQuota) {
            console.warn("[IA-CARRERA] Sin cuota, devolviendo pregunta de fallback.");
            const pregunta =
                "¿Cuál de las siguientes propiedades permite cambiar el orden de los sumandos sin alterar el resultado?";
            const opciones = [
                "Propiedad asociativa",
                "Propiedad conmutativa",
                "Propiedad distributiva",
                "Propiedad del elemento neutro",
            ];
            return res.status(200).json({
                pregunta,
                opciones,
                correctIndex: 1,
                question: pregunta,
                answers: opciones,
                fallback: true,
                reason: "quota_exceeded",
                source: "fallback",
            });
        }

        return res.status(500).json({
            error: "Error generando pregunta con IA",
            message: err?.message || "Error desconocido",
        });
    }
});

/* =========================
   QUESTIONS (Unity) - GET /api/questions
   ✅ IA REAL + fallback
   ✅ Devuelve ambos formatos:
   - Unity: question/answers/correctIndex
   - ES: pregunta/opciones/correctIndex
========================= */
app.get("/api/questions", async (req, res) => {
    try {
        const stationId = Number(req.query.stationId ?? req.query.station ?? 1);
        const attempt = Number(req.query.attempt ?? 1);
        const player = String(req.query.player ?? "0");
        const idioma = String(req.query.lang ?? "es").toLowerCase(); // es | en

        // Si no hay API key, devolvemos fallback directo
        if (!process.env.OPENAI_API_KEY) {
            const q = `Pregunta fallback (sin OPENAI_API_KEY) estación ${stationId}`;
            const ops = ["Opción A", "Opción B", "Opción C", "Opción D"];
            return res.json({
                stationId,
                attempt,
                player,
                question: q,
                answers: ops,
                pregunta: q,
                opciones: ops,
                correctIndex: 0,
                source: "fallback_no_key",
            });
        }

        const prompt = `
Eres un generador de preguntas para un juego educativo tipo gincana.
Genera UNA pregunta de alternativa múltiple para la estación ${stationId}.
Intento ${attempt} (si attempt > 1, sube un poco la dificultad o cambia el enfoque).

Reglas:
- Idioma: ${idioma === "en" ? "Inglés" : "Español"}.
- 4 opciones EXACTAS.
- 1 sola correcta.
- Opciones cortas y claras.
- NO incluyas letras "A) B)". Solo texto.

Devuelve SOLO JSON válido con esta forma EXACTA:
{
  "question": "texto",
  "answers": ["op1","op2","op3","op4"],
  "correctIndex": 0
}
`.trim();

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Devuelve SIEMPRE SOLO JSON válido. Sin texto extra." },
                { role: "user", content: prompt },
            ],
            temperature: 0.4,
        });

        const raw = completion.choices?.[0]?.message?.content ?? "";
        let parsed;

        try {
            parsed = JSON.parse(raw);
        } catch {
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("No se pudo extraer JSON de la respuesta IA");
            parsed = JSON.parse(match[0]);
        }

        const question = String(parsed?.question ?? "").trim();
        const answers = Array.isArray(parsed?.answers) ? parsed.answers.map((x) => String(x ?? "").trim()) : [];
        let correctIndex = Number(parsed?.correctIndex ?? 0);

        if (!question || answers.length !== 4) {
            throw new Error("IA devolvió formato inválido (question vacío o answers != 4)");
        }
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;

        return res.json({
            stationId,
            attempt,
            player,

            // Unity
            question,
            answers,
            correctIndex,

            // ES compatible
            pregunta: question,
            opciones: answers,

            source: "openai",
        });
    } catch (err) {
        console.error("[/api/questions] Error IA:", err?.message || err);

        const pregunta =
            "¿Cuál de las siguientes propiedades permite cambiar el orden de los sumandos sin alterar el resultado?";
        const opciones = ["Asociativa", "Conmutativa", "Distributiva", "Elemento neutro"];

        return res.status(200).json({
            stationId: Number(req.query.stationId ?? req.query.station ?? 1),
            attempt: Number(req.query.attempt ?? 1),
            player: String(req.query.player ?? "0"),

            question: pregunta,
            answers: opciones,
            pregunta,
            opciones,
            correctIndex: 1,

            source: "fallback_error",
            reason: String(err?.message || "unknown"),
        });
    }
});

/* =====================
   STORE CATALOG (MVP)
===================== */
const STORE_ITEMS = {
    vida_1: { priceCoins: 50, priceGems: 0, type: "lives", value: 1 },
    salud_25: { priceCoins: 80, priceGems: 0, type: "health", value: 25 },
    sabiduria: { priceCoins: 0, priceGems: 2, type: "buff_wisdom", value: 1 },
    pista: { priceCoins: 30, priceGems: 0, type: "hint", value: 1 },
};

// Helpers
function nowMs() {
    return Date.now();
}
function playerRef(uid) {
    return dbAdmin.collection("players").doc(uid);
}

// Crea jugador si no existe (por si entra por primera vez)
async function ensurePlayer(uid) {
    const ref = playerRef(uid);
    await dbAdmin.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            tx.set(ref, {
                coins: 0,
                gems: 0,
                lives: 3,
                health: 100,
                currentStation: 1,
                inventory: {},
                buffs: {},
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
}

/* =====================
   GET PLAYER STATE
===================== */
app.get("/api/player/me", requireAuthOrDev, async (req, res) => {
    await ensurePlayer(req.user.uid);
    const snap = await playerRef(req.user.uid).get();
    res.json({ ok: true, uid: req.user.uid, player: snap.data() });
});

/* =====================
   DEV ONLY: GRANT COINS/GEMS
   POST /api/dev/grant { coins, gems }
===================== */
app.post("/api/dev/grant", async (req, res) => {
    try {
        const devNoAuth = String(process.env.DEV_NOAUTH || "").toLowerCase() === "true";
        const devUid = process.env.DEV_UID || "testPlayer";
        if (!devNoAuth) return res.status(403).json({ ok: false, error: "dev_only" });

        const { coins = 0, gems = 0 } = req.body || {};
        const addCoins = Number(coins) || 0;
        const addGems = Number(gems) || 0;

        const ref = dbAdmin.collection("players").doc(devUid);

        await dbAdmin.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                tx.set(ref, {
                    coins: 0,
                    gems: 0,
                    lives: 3,
                    health: 100,
                    currentStation: 1,
                    inventory: {},
                    buffs: {},
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            tx.update(ref, {
                coins: admin.firestore.FieldValue.increment(addCoins),
                gems: admin.firestore.FieldValue.increment(addGems),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        return res.json({ ok: true, uid: devUid, added: { coins: addCoins, gems: addGems } });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e?.message || "dev_grant_error" });
    }
});

/* =====================
   BUY ITEM (coins+gems)
   POST /api/store/buy { itemId, qty }
===================== */
app.post("/api/store/buy", requireAuthOrDev, async (req, res) => {
    const uid = req.user.uid;
    const { itemId, qty } = req.body || {};

    const item = STORE_ITEMS[itemId];
    const n = Number(qty ?? 1);

    if (!item) return res.status(400).json({ ok: false, error: "unknown_item" });
    if (!Number.isInteger(n) || n <= 0 || n > 99) return res.status(400).json({ ok: false, error: "bad_qty" });

    await ensurePlayer(uid);
    const ref = playerRef(uid);

    try {
        const result = await dbAdmin.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const p = snap.data() || {};

            const costCoins = item.priceCoins * n;
            const costGems = item.priceGems * n;

            if ((p.coins ?? 0) < costCoins) throw new Error("not_enough_coins");
            if ((p.gems ?? 0) < costGems) throw new Error("not_enough_gems");

            const inv = { ...(p.inventory || {}) };
            inv[itemId] = (inv[itemId] || 0) + n;

            tx.update(ref, {
                coins: (p.coins ?? 0) - costCoins,
                gems: (p.gems ?? 0) - costGems,
                inventory: inv,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                coins: (p.coins ?? 0) - costCoins,
                gems: (p.gems ?? 0) - costGems,
                inventory: inv,
            };
        });

        return res.json({ ok: true, itemId, qty: n, player: result });
    } catch (e) {
        return res.status(400).json({ ok: false, error: e?.message || "tx_error" });
    }
});

/* =====================
   USE ITEM
   POST /api/game/use-item { itemId, qty }
===================== */
app.post("/api/game/use-item", requireAuthOrDev, async (req, res) => {
    const uid = req.user.uid;
    const { itemId, qty } = req.body || {};
    const item = STORE_ITEMS[itemId];
    const n = Number(qty ?? 1);

    if (!item) return res.status(400).json({ ok: false, error: "unknown_item" });
    if (!Number.isInteger(n) || n <= 0 || n > 99) return res.status(400).json({ ok: false, error: "bad_qty" });

    await ensurePlayer(uid);
    const ref = playerRef(uid);

    try {
        const result = await dbAdmin.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const p = snap.data() || {};
            const inv = { ...(p.inventory || {}) };

            if ((inv[itemId] || 0) < n) throw new Error("not_in_inventory");

            inv[itemId] = inv[itemId] - n;
            if (inv[itemId] <= 0) delete inv[itemId];

            const updates = {
                inventory: inv,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (item.type === "lives") updates.lives = (p.lives ?? 0) + item.value * n;
            if (item.type === "health") updates.health = Math.min(100, (p.health ?? 100) + item.value * n);

            if (String(item.type).startsWith("buff_") || item.type === "hint") {
                const buffs = { ...(p.buffs || {}) };
                buffs[itemId] = (buffs[itemId] || 0) + n;
                updates.buffs = buffs;
            }

            tx.update(ref, updates);

            return {
                coins: p.coins ?? 0,
                gems: p.gems ?? 0,
                lives: updates.lives ?? (p.lives ?? 0),
                health: updates.health ?? (p.health ?? 100),
                currentStation: p.currentStation ?? 1,
                inventory: inv,
                buffs: updates.buffs ?? (p.buffs || {}),
            };
        });

        return res.json({ ok: true, used: { itemId, qty: n }, player: result });
    } catch (e) {
        return res.status(400).json({ ok: false, error: e?.message || "tx_error" });
    }
});

/* =====================
   STATION LOCK (multiplayer)
===================== */
function lockRef(stationId) {
    return dbAdmin.collection("stationLocks").doc(String(stationId));
}

app.post("/api/station/lock", requireAuthOrDev, async (req, res) => {
    const uid = req.user.uid;
    const { stationId, ttlSec } = req.body || {};
    const ttl = Math.max(10, Math.min(180, Number(ttlSec ?? 60)));

    if (!stationId) return res.status(400).json({ ok: false, error: "missing_stationId" });

    const ref = lockRef(stationId);
    const now = nowMs();
    const expires = now + ttl * 1000;

    const out = await dbAdmin.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists ? snap.data() : null;

        const isExpired = !cur || !cur.expiresAtMs || cur.expiresAtMs <= now;
        const isMine = cur && cur.lockedBy === uid;

        if (!snap.exists || isExpired || isMine) {
            tx.set(ref, { lockedBy: uid, lockedAtMs: now, expiresAtMs: expires }, { merge: true });
            return { status: "locked", stationId, lockedBy: uid, expiresAtMs: expires };
        }

        return { status: "busy", stationId, lockedBy: cur.lockedBy, expiresAtMs: cur.expiresAtMs };
    });

    return res.json({ ok: true, ...out });
});

app.post("/api/station/release", requireAuthOrDev, async (req, res) => {
    const uid = req.user.uid;
    const { stationId } = req.body || {};

    if (!stationId) return res.status(400).json({ ok: false, error: "missing_stationId" });

    const ref = lockRef(stationId);

    try {
        await dbAdmin.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return;
            const cur = snap.data();
            if (cur.lockedBy !== uid) throw new Error("not_lock_owner");
            tx.delete(ref);
        });

        return res.json({ ok: true, stationId, released: true });
    } catch (e) {
        return res.status(400).json({ ok: false, error: e?.message || "tx_error" });
    }
});

/* =========================
   ERROR HANDLER (AL FINAL)
========================= */
app.use((err, _req, res, _next) => {
    console.error("[API] Error:", err);
    res.status(err.status || err.statusCode || 500).json({
        error: true,
        message: err.message || "Internal Server Error",
    });
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 8080; // Cloud Run espera 8080
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
    console.log("✅ API escuchando en", `${HOST}:${PORT}`, "PORT env=", process.env.PORT);
});
