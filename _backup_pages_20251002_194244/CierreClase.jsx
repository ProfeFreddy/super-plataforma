// src/pages/CierreClase.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { QRCodeCanvas } from "qrcode.react";
// ➕ NUEVO: navegación y lectura de state
import { useNavigate, useLocation } from "react-router-dom";

// 🔁 NUEVO: traemos el contexto de plan/usuario (para reemplazar useAuthX)
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";

// Fallback seguro por si el contexto no está listo
const PLAN_DEFAULTS = {
  user: null,
  plan: "FREE",
  caps: PLAN_CAPS.FREE,
  loading: false,
};

// Utilidad simple para mm:ss
const mmss = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const s = Math.max(0, Math.floor((ms % 60000) / 1000));
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(m)}:${pad(s)}`;
};

const Card = ({ children, style }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)",
      padding: 18,
      ...style,
    }}
  >
    {children}
  </div>
);

export default function CierreClase({
  // props opcionales para personalizar
  duracionMin = 10, // minutos del bloque de cierre
  horaActual = new Date(), // por si quieres inyectar hora
  unidad = "U1: Números y operaciones",
  objetivo = "Reconocer y aplicar propiedades de los números reales.",
  curso = "(sin curso)",
  asignatura = "(sin asignatura)",
  profesor = "Profesor/a",
  codigoSesion = "ABC123", // código corto para /participa
  onVolverInicio, // callback botón
}) {
  // ➕ NUEVO: router hooks
  const navigate = useNavigate();
  const location = useLocation();

  // 🔁 NUEVO: leemos PlanContext (reemplaza useAuthX roto en producción)
  const {
    user = PLAN_DEFAULTS.user,
    plan = PLAN_DEFAULTS.plan,
    caps = PLAN_DEFAULTS.caps,
    loading = PLAN_DEFAULTS.loading,
  } = useContext(PlanContext) || PLAN_DEFAULTS;

  // --------- Reloj y cuenta regresiva ----------
  const [now, setNow] = useState(() => new Date(horaActual));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fin = useMemo(
    () => new Date(now.getTime() + duracionMin * 60000),
    // recalculamos solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const restante = Math.max(0, fin.getTime() - now.getTime());

  // --------- Mini panel del profesor ----------
  const [pregunta, setPregunta] = useState("");
  const [opciones, setOpciones] = useState(["", "", "", ""]);
  const [correcta, setCorrecta] = useState(0);
  const publicar = () => {
    // Aquí iría tu integración (Firebase / API)
    console.log("Publicar ronda", { pregunta, opciones, correcta });
    alert("Ronda publicada (demo).");
  };
  const cerrarRonda = () => {
    console.log("Cerrar ronda");
    alert("Ronda cerrada (demo).");
  };

  // --------- Carrera en vivo (demo) ----------
  const [participantes, setParticipantes] = useState([
    { id: 1, nombre: "tomi", progreso: 10 },
    { id: 2, nombre: "antia", progreso: 23 },
    { id: 3, nombre: "maria", progreso: 18 },
  ]);
  const resetCarrera = () => {
    setParticipantes((arr) => arr.map((p) => ({ ...p, progreso: 0 })));
  };

  // --------- estilos rápidos ----------
  const page = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 18px 80px",
  };
  const title = (t) => ({
    fontWeight: 800,
    fontSize: 18,
    margin: "0 0 8px",
    color: "#17324d",
    ...(t === "center" && { textAlign: "center" }),
  });
  const label = { color: "#597088", fontSize: 14 };
  const grid = {
    display: "grid",
    gap: 16,
  };

  // ➕ NUEVO: ClaseVigente/ClaseActual con set seguro
  const [claseVigente, setClaseVigente] = useState(null);
  const [claseActual, setClaseActual] = useState(null);

  // ➕ NUEVO: helper set seguro (el “FIX COMÚN”)
  const mergeClase = (res) => {
    if (!res) return;
    setClaseActual((prev) => ({
      ...(prev || {}),
      unidad: res?.unidad ?? prev?.unidad ?? "(sin unidad)",
      objetivo: res?.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
      habilidades: Array.isArray(res?.habilidades)
        ? res.habilidades.join(", ")
        : res?.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
      asignatura:
        res?.asignatura ??
        prev?.asignatura ??
        "(sin asignatura)",
      nivel: res?.nivel ?? prev?.nivel ?? "",
      seccion: res?.seccion ?? prev?.seccion ?? "",
      curso:
        res?.curso ??
        prev?.curso ??
        (res?.nivel && res?.seccion
          ? `${res.nivel}${res.seccion}`
          : "(sin curso)"),
      profesor:
        res?.profesor ??
        prev?.profesor ??
        profesor ??
        "Profesor/a",
    }));
  };

  // ➕ NUEVO: leer primero de location.state (si venimos desde Inicio/Desarrollo)
  useEffect(() => {
    const st = location?.state || null;
    if (!st) return;

    // puede venir como { clase } o { ficha }
    if (st.clase) mergeClase(st.clase);
    if (st.ficha) {
      mergeClase({
        unidad: st.ficha.unidad,
        objetivo: st.ficha.objetivo,
        habilidades: st.ficha.habilidades,
        asignatura: st.ficha.asignatura,
        nivel: st.ficha.nivel,
        seccion: st.ficha.seccion,
        curso: st.ficha.curso,
        profesor: st.ficha.profesor,
      });
    }
    // badge simple
    setClaseVigente({
      fuente: st?.ficha ? "bridge" : "state",
      unidad: st?.ficha?.unidad || st?.clase?.unidad || null,
      objetivo: st?.ficha?.objetivo || st?.clase?.objetivo || null,
      habilidades:
        st?.ficha?.habilidades || st?.clase?.habilidades || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ➕ NUEVO: si no vino state, intenta bridge localStorage
  useEffect(() => {
    if (claseActual) return;
    try {
      const raw = localStorage.getItem("bridge:desarrolloClase");
      if (!raw) return;
      const data = JSON.parse(raw);
      const ficha = data?.ficha || null;
      if (ficha) {
        mergeClase({
          unidad: ficha.unidad,
          objetivo: ficha.objetivo,
          habilidades: ficha.habilidades,
          asignatura: ficha.asignatura,
          nivel: ficha.nivel,
          seccion: ficha.seccion,
          curso: ficha.curso,
          profesor: ficha.profesor,
        });
        setClaseVigente({
          fuente: "bridge",
          unidad: ficha.unidad,
          objetivo: ficha.objetivo,
          habilidades: ficha.habilidades,
        });
      }
    } catch (_) {}
  }, [claseActual]);

  // ➕ NUEVO: valores a mostrar (prioriza claseActual, luego props)
  const unidadShow = claseActual?.unidad ?? unidad;
  const objetivoShow = claseActual?.objetivo ?? objetivo;
  const cursoShow = claseActual?.curso ?? curso;
  const asignaturaShow = claseActual?.asignatura ?? asignatura;
  const profesorShow = claseActual?.profesor ?? profesor;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #e2f6ff 0%, #d3f0ff 120px, #eaf9ff 100%)",
      }}
    >
      <div style={page}>
        {/* ➕ NUEVO: Banner de clase vigente (si hay info) */}
        {claseVigente ? (
          <Card
            style={{
              background:
                "linear-gradient(180deg, #46b6e6 0%, #2aa5d6 100%)",
              color: "white",
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {claseVigente.fuente === "bridge"
                ? "Clase actual (desde Inicio)"
                : "Clase actual"}
            </div>
            {claseVigente.unidad && (
              <div style={{ marginTop: 6 }}>
                <b>Unidad:</b> {claseVigente.unidad}
              </div>
            )}
            {(claseVigente.objetivo ||
              claseVigente.habilidades) && (
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.95,
                  marginTop: 4,
                }}
              >
                {claseVigente.objetivo && (
                  <span>
                    <b>Objetivo:</b> {claseVigente.objetivo} ·{" "}
                  </span>
                )}
                {claseVigente.habilidades && (
                  <span>
                    <b>Habilidades:</b>{" "}
                    {claseVigente.habilidades}
                  </span>
                )}
              </div>
            )}
          </Card>
        ) : (
          // Tu banda original (se mantiene) — ahora solo si no hay clase vigente
          <Card
            style={{
              background:
                "linear-gradient(180deg, #46b6e6 0%, #2aa5d6 100%)",
              color: "white",
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Sin clase planificada
            </div>
          </Card>
        )}

        {/* Cabecera de 3 columnas */}
        <div
          style={{
            ...grid,
            gridTemplateColumns: "1fr 2fr 1fr",
            marginTop: 16,
          }}
        >
          {/* Tarjeta: Cierre / reloj */}
          <Card>
            <div style={{ ...title(), fontSize: 20 }}>Cierre</div>
            <div style={label}>
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {mmss(restante)}
              </div>
            </div>
          </Card>

          {/* Tarjeta: Unidad y objetivo */}
          <Card>
            <div
              style={{ ...title("center"), fontSize: 20 }}
            >
              Unidad
            </div>
            <div
              style={{
                fontWeight: 800,
                marginBottom: 8,
              }}
            >
              {unidadShow}
            </div>
            <div
              style={{ ...label, marginBottom: 8 }}
            >
              <strong>Objetivo:</strong>{" "}
              {objetivoShow}
            </div>
            <div style={label}>
              <strong>Curso:</strong>{" "}
              {cursoShow} &nbsp; | &nbsp;
              <strong>Asignatura:</strong>{" "}
              {asignaturaShow}
            </div>
          </Card>

          {/* Tarjeta: Profesor */}
          <Card>
            <div
              style={{
                ...title("center"),
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              {profesorShow}
            </div>
            <div
              style={{
                color: "#8aa2b6",
                textAlign: "center",
              }}
            >
              {asignaturaShow || "(sin asignatura)"}
            </div>
          </Card>
        </div>

        {/* Nube de palabras final */}
        <Card style={{ marginTop: 20 }}>
          <div
            style={{
              ...title("center"),
              fontSize: 20,
            }}
          >
            Nube de palabras final
          </div>

          <Card
            style={{
              background: "#f7fbff",
              border: "1px dashed #cfe8fb",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#47627a",
                marginBottom: 10,
              }}
            >
              Activa participación en vivo con QR y
              visualización instantánea. Disponible
              desde el plan <strong>PRO</strong>.
            </div>
            <button
              type="button"
              onClick={() =>
                alert("Funcionalidad PRO (demo).")
              }
              style={{
                background: "#5b8def",
                color: "#fff",
                fontWeight: 700,
                border: 0,
                borderRadius: 10,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Subir a PRO
            </button>
          </Card>
        </Card>

        {/* Únete a la carrera + QR */}
        <Card style={{ marginTop: 20 }}>
          <div
            style={{
              ...title("center"),
              fontSize: 20,
            }}
          >
            Únete a la carrera
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "200px 1fr",
              gap: 20,
              alignItems: "center",
            }}
          >
            <Card
              style={{ textAlign: "center" }}
            >
              <QRCodeCanvas
                value={`${window.location.origin}/participa?c=${codigoSesion}`}
                size={168}
                includeMargin
              />
            </Card>

            <div>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                Sesión: {codigoSesion}
              </div>
              <div style={label}>
                Abre <strong>/participa</strong>{" "}
                o escanea el QR. Link directo:
                <br />
                <code>
                  {window.location.origin}
                  /participa?c={codigoSesion}
                </code>
              </div>
            </div>
          </div>
        </Card>

        {/* Centro de juegos */}
        <Card style={{ marginTop: 20 }}>
          <div
            style={{
              ...title(),
              fontSize: 18,
            }}
          >
            Centro de Juegos
          </div>

          <div
            style={{
              ...grid,
              gridTemplateColumns:
                "1fr 1fr 1fr",
              marginTop: 12,
            }}
          >
            <Card>
              <div
                style={{
                  fontWeight: 800,
                }}
              >
                Carrera PRAGMA (en esta
                página)
              </div>
              <div
                style={{
                  ...label,
                  marginTop: 6,
                }}
              >
                Juego nativo de la
                plataforma. Publica rondas
                y muestra ranking.
              </div>
              <button
                type="button"
                onClick={() =>
                  alert("Ir a Carrera (demo).")
                }
                style={{
                  marginTop: 12,
                  background: "#17a2b8",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding:
                    "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ir a Carrera
              </button>
            </Card>

            <Card>
              <div
                style={{
                  fontWeight: 800,
                }}
              >
                Blooket (Premium)
              </div>
              <div
                style={{
                  ...label,
                  marginTop: 6,
                }}
              >
                Lanza sets y comparte PIN
                con tu clase. Requiere tu
                cuenta.
              </div>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    "https://www.blooket.com/",
                    "_blank"
                  )
                }
                style={{
                  marginTop: 12,
                  background: "#5865f2",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding:
                    "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Abrir
              </button>
            </Card>

            <Card>
              <div
                style={{
                  fontWeight: 800,
                }}
              >
                Deck.Toys (Premium)
              </div>
              <div
                style={{
                  ...label,
                  marginTop: 6,
                }}
              >
                Rutas y tableros
                interactivos. Requiere tu
                cuenta.
              </div>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    "https://deck.toys/",
                    "_blank"
                  )
                }
                style={{
                  marginTop: 12,
                  background: "#00b894",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding:
                    "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Abrir
              </button>
            </Card>
          </div>
        </Card>

        {/* Mini panel del profesor + Carrera en vivo */}
        <div
          style={{
            ...grid,
            gridTemplateColumns:
              "1fr 1fr",
            marginTop: 20,
          }}
        >
          {/* Mini panel */}
          <Card>
            <div
              style={{
                ...title(),
                fontSize: 18,
              }}
            >
              Mini panel del profesor
            </div>
            <div
              style={{
                ...label,
                marginBottom: 8,
              }}
            >
              Publica una pregunta
              (texto + 0–4 opciones).
              Si agregas opciones,
              selecciona cuál es la
              correcta.
            </div>

            <div
              style={{
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Pregunta
              </div>
              <input
                value={pregunta}
                onChange={(e) =>
                  setPregunta(
                    e.target.value
                  )
                }
                placeholder="Escribe la pregunta…"
                style={{
                  width: "100%",
                  border:
                    "1px solid #d7e6f5",
                  borderRadius: 10,
                  padding:
                    "10px 12px",
                  outline: "none",
                }}
              />
            </div>

            <div
              style={{
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Opciones (opcional)
            </div>
            {opciones.map(
              (op, idx) => (
                <label
                  key={idx}
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="radio"
                    name="correcta"
                    checked={
                      correcta ===
                      idx
                    }
                    onChange={() =>
                      setCorrecta(
                        idx
                      )
                    }
                  />
                  <input
                    value={op}
                    onChange={(
                      e
                    ) =>
                      setOpciones(
                        (
                          arr
                        ) =>
                          arr.map(
                            (
                              x,
                              i
                            ) =>
                              i ===
                              idx
                                ? e
                                    .target
                                    .value
                                : x
                          )
                      )
                    }
                    placeholder={`Opción ${
                      idx +
                      1
                    }`}
                    style={{
                      flex: 1,
                      border:
                        "1px solid #d7e6f5",
                      borderRadius: 10,
                      padding:
                        "10px 12px",
                      outline:
                        "none",
                    }}
                  />
                </label>
              )
            )}

            <div
              style={{
                display:
                  "flex",
                gap: 10,
                marginTop: 12,
              }}
            >
              <button
                type="button"
                onClick={
                  publicar
                }
                style={{
                  background:
                    "#1f9d55",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding:
                    "10px 14px",
                  fontWeight: 700,
                  cursor:
                    "pointer",
                }}
              >
                Publicar
                ronda
              </button>
              <button
                type="button"
                onClick={
                  cerrarRonda
                }
                style={{
                  background:
                    "#718096",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding:
                    "10px 14px",
                  fontWeight: 700,
                  cursor:
                    "pointer",
                }}
              >
                Cerrar
                ronda
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                ...label,
                fontStyle:
                  "italic",
              }}
            >
              Ronda
              INACTIVA
            </div>
          </Card>

          {/* Carrera en vivo */}
          <Card>
            <div
              style={{
                ...title(),
                fontSize: 18,
              }}
            >
              Carrera en
              vivo
            </div>
            <div
              style={{
                ...label,
                marginBottom: 12,
              }}
            >
              Avance =
              acierto (5
              pts) +
              bonus por
              rapidez
              (hasta
              +8).
              Participación
              abierta:
              pequeño
              avance.
            </div>

            <div
              style={{
                display:
                  "grid",
                gap: 10,
              }}
            >
              {participantes.map(
                (p) => (
                  <div
                    key={
                      p.id
                    }
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {
                        p.nombre
                      }
                    </div>
                    <div
                      style={{
                        height: 20,
                        background:
                          "#eaf3fb",
                        borderRadius: 999,
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            p.progreso
                          )}%`,
                          height:
                            "100%",
                          background:
                            "linear-gradient(90deg, #41c7af, #28b487)",
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        {/* Botonera inferior */}
        <div
          style={{
            display:
              "flex",
            gap: 12,
            marginTop: 16,
            justifyContent:
              "center",
          }}
        >
          <button
            type="button"
            onClick={
              resetCarrera
            }
            style={{
              background:
                "#edf2f7",
              color:
                "#1a202c",
              border: 0,
              borderRadius: 10,
              padding:
                "10px 14px",
              fontWeight: 700,
              cursor:
                "pointer",
            }}
          >
            Reset
            carrera
          </button>

          <button
            type="button"
            onClick={() => {
              // ✅ Prioriza callback si lo pasas
              if (onVolverInicio) {
                onVolverInicio();
                return;
              }
              // ✅ Navegación a InicioClase (router)
              try {
                navigate("/inicio");
              } catch {
                // fallback sin router
                window.location.href =
                  "/inicio";
              }
            }}
            style={{
              background:
                "#3182ce",
              color:
                "#fff",
              border: 0,
              borderRadius: 10,
              padding:
                "10px 14px",
              fontWeight: 700,
              cursor:
                "pointer",
            }}
          >
            Volver
            al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}


