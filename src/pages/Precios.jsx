import React, { useMemo, useState } from "react";

/**
 * Página de precios (autocontenida) para pegar en src/pages/Precios.jsx
 * - Toggle mensual/anual
 * - Conversión de moneda local (aprox.)
 * - Tabla de features por plan (FREE / PRO / PREMIUM)
 * - Calculadora para colegios (por docente o por estudiante) con mínimos/tier
 * - Botones de acción a /registro y /pago
 *
 * Nota: Los valores en moneda local son referenciales. Cobro en USD.
 */
export default function Precios() {
  // ======= Estado UI =======
  const [period, setPeriod] = useState("monthly"); // 'monthly' | 'yearly'
  const [currency, setCurrency] = useState("USD");
  const [instMode, setInstMode] = useState("docentes"); // 'docentes' | 'estudiantes'
  const [teachers, setTeachers] = useState(30);
  const [students, setStudents] = useState(600);

  // ======= FX aprox. (no en tiempo real) =======
  const FX = {
    USD: 1,
    CLP: 950, // pesos chilenos
    PEN: 3.8, // soles peruanos
    MXN: 17, // pesos mexicanos
    ARS: 980, // pesos argentinos (referencial)
    COP: 4000, // pesos colombianos
  };
  const LOCALE = {
    USD: "en-US",
    CLP: "es-CL",
    PEN: "es-PE",
    MXN: "es-MX",
    ARS: "es-AR",
    COP: "es-CO",
  };
  const fmtMoney = (usd) => {
    const rate = FX[currency] || 1;
    const value = usd * rate;
    let minFrac = 0;
    // Monedas con decimales visibles
    if (["USD", "PEN", "MXN", "ARS"].includes(currency)) minFrac = 2;
    return new Intl.NumberFormat(LOCALE[currency] || "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: minFrac,
    }).format(value);
  };

  // ======= Definición de planes =======
  const plans = [
    {
      id: "free",
      name: "FREE",
      tagline: "Para comenzar a probar en sala",
      priceUSD: { monthly: 0, yearly: 0 },
      ctaLabel: "Comenzar gratis",
      ctaHref: "/registro",
      popular: false,
      features: [
        "1 curso activo, 2 clases/semana",
        "Participación con QR (hasta 30 respuestas/sesión)",
        "Nube de palabras básica",
        "Asistencia básica (presente/ausente)",
        "Planificación ligada a OA/habilidades (limitada)",
      ],
      limits: [
        "Sin analíticas históricas",
        "Sin exportación CSV/Sheets",
      ],
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "Para docentes activos en varias clases",
      priceUSD: { monthly: 9, yearly: 84 }, // ~2 meses gratis
      ctaLabel: "Suscribirme PRO",
      ctaHref: "/pago?plan=PRO",
      popular: true,
      features: [
        "Cursos y clases ilimitados",
        "Participación y nube de palabras ilimitadas",
        "Asistencia completa + exportación CSV/Sheets",
        "Segmentos de clase con temporizador y avance",
        "Evidencias de clase (Desarrollo/Cierre)",
      ],
      limits: ["Soporte en 48 h"],
    },
    {
      id: "premium",
      name: "PREMIUM",
      tagline: "Para quienes quieren analíticas y plantillas",
      priceUSD: { monthly: 14, yearly: 132 },
      ctaLabel: "Ir a PREMIUM",
      ctaHref: "/pago?plan=PREMIUM",
      popular: false,
      features: [
        "Todo PRO",
        "Analíticas: asistencia, participación por estudiante",
        "Banco personal de actividades/planes reutilizables",
        "Compartir plantillas entre colegas",
        "Soporte prioritario (24 h)",
      ],
      limits: [],
    },
  ];

  const displayPrice = (p) => {
    const usd = p.priceUSD[period];
    if (usd === 0) return "Gratis";
    const suffix = period === "monthly" ? "/mes" : "/año";
    return `${fmtMoney(usd)} ${suffix}`;
  };

  // ======= Institucional =======
  const unitTeacherUSD = (n) => (n >= 100 ? 80 : n >= 50 ? 90 : n >= 20 ? 100 : 120);
  const calcTeacherTotalUSD = (n) => Math.max(1500, unitTeacherUSD(n) * n);
  const unitStudentUSD = (n) => (n >= 1000 ? 1.5 : n >= 500 ? 2.0 : 2.5); // min 200 recomendado
  const calcStudentTotalUSD = (n) => Math.max(1500, unitStudentUSD(n) * n);
  const schoolTotalUSD =
    instMode === "docentes" ? calcTeacherTotalUSD(teachers) : calcStudentTotalUSD(students);

  const schoolBreakdown = useMemo(() => {
    if (instMode === "docentes") {
      const u = unitTeacherUSD(teachers);
      return `${teachers} docentes × ${fmtMoney(u)} = ${fmtMoney(u * teachers)} (mínimo anual ${fmtMoney(1500)})`;
    } else {
      const u = unitStudentUSD(students);
      return `${students} estudiantes × ${fmtMoney(u)} = ${fmtMoney(u * students)} (mínimo anual ${fmtMoney(1500)})`;
    }
  }, [instMode, teachers, students, currency]);

  // ======= UI helpers =======
  const pill = (active) =>
    `px-3 py-1 rounded-full text-sm font-semibold ${
      active ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-tr from-sky-700 to-cyan-400 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Hero */}
        <header className="text-center text-white">
          <h1 className="text-3xl sm:text-4xl font-extrabold">Precios simples y transparentes</h1>
          <p className="mt-2 opacity-90">
            Planifica según el currículo, toma asistencia y activa a tus estudiantes con QR.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs bg-white/15 backdrop-blur px-3 py-1 rounded-full">
            <span>Incluye asistencia</span>
            <span className="opacity-70">·</span>
            <span>Segmentos de clase</span>
            <span className="opacity-70">·</span>
            <span>Nube de palabras</span>
          </div>
        </header>

        {/* Controles globales */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="bg-white rounded-xl shadow p-1 flex items-center gap-1">
            <button
              className={pill(period === "monthly")}
              onClick={() => setPeriod("monthly")}
            >
              Mensual
            </button>
            <button
              className={pill(period === "yearly")}
              onClick={() => setPeriod("yearly")}
              title="2 meses gratis en anual"
            >
              Anual <span className="ml-1 text-[10px] font-normal">(ahorra)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow px-3 py-2 flex items-center gap-2">
            <span className="text-sm text-slate-600">Moneda:</span>
            <select
              className="text-sm border rounded px-2 py-1"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {Object.keys(FX).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tarjetas de planes */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-2xl shadow-lg border ${
                p.popular ? "border-sky-500 ring-2 ring-sky-300" : "border-slate-200"
              }`}
            >
              {p.popular && (
                <div className="text-center text-xs font-bold text-white bg-sky-600 rounded-t-2xl py-1">
                  Más elegido
                </div>
              )}
              <div className="p-6">
                <h3 className="text-xl font-extrabold">{p.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{p.tagline}</p>

                <div className="mt-5">
                  <div className="text-3xl font-extrabold">{displayPrice(p)}</div>
                  {p.priceUSD.yearly > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      Equivalente a {fmtMoney(p.priceUSD.monthly)} /mes al pagar anual.
                    </div>
                  )}
                </div>

                <ul className="mt-5 space-y-2">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-sky-600">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {p.limits?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-slate-500">
                    {p.limits.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <a
                  href={p.ctaHref}
                  className={`mt-6 inline-flex w-full justify-center rounded-lg px-4 py-2 font-semibold shadow hover:opacity-95 transition ${
                    p.id === "free"
                      ? "bg-slate-900 text-white"
                      : "bg-sky-600 text-white"
                  }`}
                >
                  {p.ctaLabel}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Institucional */}
        <section className="mt-12 bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">Plan para colegios</h2>
              <p className="text-slate-600 text-sm mt-1">
                Licencia anual con panel de administración, reportes de asistencia/participación y onboarding.
              </p>
            </div>

            <div className="bg-slate-100 rounded-xl p-1 inline-flex">
              <button
                className={pill(instMode === "docentes")}
                onClick={() => setInstMode("docentes")}
              >
                Por docente
              </button>
              <button
                className={pill(instMode === "estudiantes")}
                onClick={() => setInstMode("estudiantes")}
              >
                Por estudiante
              </button>
            </div>
          </div>

          {instMode === "docentes" ? (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Número de docentes</label>
                <input
                  type="range"
                  min={5}
                  max={200}
                  step={1}
                  value={teachers}
                  onChange={(e) => setTeachers(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm mt-1">
                  <span>5</span>
                  <span className="font-semibold">{teachers}</span>
                  <span>200</span>
                </div>

                <div className="mt-4 text-sm text-slate-700">
                  <div>{schoolBreakdown}</div>
                  <div className="mt-1 font-extrabold text-lg">Total anual: {fmtMoney(schoolTotalUSD)}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Tiers: 120 → 100 (20+), 90 (50+), 80 (100+). Mínimo por colegio: {fmtMoney(1500)}.
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-sm text-slate-600">Desde</div>
                <div className="text-2xl font-extrabold">{fmtMoney(80)} /docente/año</div>
                <a
                  href="/pago?plan=INSTITUCIONAL"
                  className="mt-4 inline-flex w-full justify-center rounded-lg px-4 py-2 font-semibold shadow bg-sky-600 text-white hover:opacity-95"
                >
                  Solicitar demo / cotización
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Número de estudiantes</label>
                <input
                  type="range"
                  min={200}
                  max={3000}
                  step={10}
                  value={students}
                  onChange={(e) => setStudents(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm mt-1">
                  <span>200</span>
                  <span className="font-semibold">{students}</span>
                  <span>3000</span>
                </div>

                <div className="mt-4 text-sm text-slate-700">
                  <div>{schoolBreakdown}</div>
                  <div className="mt-1 font-extrabold text-lg">Total anual: {fmtMoney(schoolTotalUSD)}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Tiers: 2.5 (200–499), 2.0 (500–999), 1.5 (1000+). Mínimo por colegio: {fmtMoney(1500)}.
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-sm text-slate-600">Desde</div>
                <div className="text-2xl font-extrabold">{fmtMoney(1.5)} /estudiante/año</div>
                <a
                  href="/pago?plan=INSTITUCIONAL"
                  className="mt-4 inline-flex w-full justify-center rounded-lg px-4 py-2 font-semibold shadow bg-sky-600 text-white hover:opacity-95"
                >
                  Solicitar demo / cotización
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Comparador breve */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-5">
            <h3 className="font-bold">Apps de engagement</h3>
            <p className="text-sm text-slate-600 mt-1">Kahoot, Socrative…</p>
            <div className="mt-3 text-lg font-extrabold">~ {fmtMoney(30)}–{fmtMoney(120)} /año</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-5">
            <h3 className="font-bold">Lecciones interactivas</h3>
            <p className="text-sm text-slate-600 mt-1">Nearpod, Pear Deck…</p>
            <div className="mt-3 text-lg font-extrabold">~ {fmtMoney(80)}–{fmtMoney(200)} /año</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-5">
            <h3 className="font-bold">Esta plataforma</h3>
            <p className="text-sm text-slate-600 mt-1">Planificación + asistencia + participación</p>
            <div className="mt-3 text-lg font-extrabold">PRO {fmtMoney(9)} /mes · PREMIUM {fmtMoney(14)} /mes</div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10 bg-white rounded-2xl shadow border border-slate-200 p-6">
          <h3 className="text-xl font-extrabold">Preguntas frecuentes</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <details className="group">
              <summary className="cursor-pointer font-semibold">¿Los precios incluyen impuestos?</summary>
              <div className="mt-1 text-slate-600">
                Los valores mostrados no incluyen impuestos locales (IVA/IGV, etc.). En cobros internacionales se factura en USD.
              </div>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-semibold">¿Puedo cambiar de plan cuando quiera?</summary>
              <div className="mt-1 text-slate-600">Sí, puedes subir/bajar de plan en cualquier momento. El cambio se prorratea al siguiente ciclo.</div>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-semibold">¿Qué incluye el plan institucional?</summary>
              <div className="mt-1 text-slate-600">
                Accesos para el equipo docente, panel administrador por colegio, reportes de asistencia/participación, onboarding y soporte a coordinadores.
              </div>
            </details>
          </div>
        </section>

        <footer className="text-center text-white/90 text-sm mt-10">
          Valores referenciales en {currency}. Cobro en USD. Puedes comenzar gratis y actualizar cuando quieras.
        </footer>
      </div>
    </div>
  );
}
