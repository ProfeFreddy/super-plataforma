// src/components/EpicStarters.jsx
import React, { useState, useMemo } from "react";

const cardBase = {
  borderRadius: 12,
  padding: "0.9rem 1rem",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const smallMuted = {
  fontSize: 12,
  color: "#6b7280",
};

const ACTIVITIES = [
  {
    id: "one_minute_talk",
    emoji: "🎤",
    titleEs: "Charlas de 1 minuto",
    titleEn: "One-minute talks",
    shortEs: "Un estudiante habla 60 segundos sin parar sobre un tema.",
    shortEn: "A student talks for 60 seconds nonstop about a topic.",
    stepsEs: [
      "Pide voluntarios o elige a un estudiante.",
      "El tema puede ser elegido por el estudiante o por ti.",
      "Debe hablar 60 segundos sin detenerse.",
      "El resto escucha y al final puede hacer 1–2 preguntas rápidas.",
    ],
    stepsEn: [
      "Ask for volunteers or pick one student.",
      "The topic can be chosen by the student or by you.",
      "They must talk for 60 seconds without stopping.",
      "The class listens and then asks 1–2 quick questions.",
    ],
  },
  {
    id: "team_game",
    emoji: "🤝",
    titleEs: "Juego en equipo",
    titleEn: "Team game",
    shortEs:
      "Organiza equipos y gana quien logre más sonrisas en el grupo.",
    shortEn:
      "Create teams; the team that generates more smiles wins.",
    stepsEs: [
      "Divide la clase en 2–4 equipos pequeños.",
      "Plantea un reto corto (chiste sano, mini representación, meme explicado, etc.).",
      "Gana el equipo que logre que más compañeros sonrían o levanten el pulgar.",
      "Refuerza que aquí ganan también quienes no suelen destacar en otras actividades.",
    ],
    stepsEn: [
      "Split the class into 2–4 small teams.",
      "Give them a short challenge (clean joke, mini role-play, meme explained, etc.).",
      "The winning team is the one that makes more classmates smile or give a thumbs-up.",
      "Highlight that this is a chance for different students to shine.",
    ],
  },
  {
    id: "debate",
    emoji: "⚖️",
    titleEs: "Debate sobre temas originales",
    titleEn: "Debate on fun topics",
    shortEs:
      "Debate rápido sobre temas superficiales, pero con argumentos.",
    shortEn:
      "Fast debate on light topics, but with arguments.",
    stepsEs: [
      "Propón un tema superficial: dos cantantes, dos equipos, dos youtubers, etc.",
      "Divide la clase en dos bandos (a favor / en contra, equipo A / B).",
      "Cada bando tiene 1 minuto para preparar argumentos.",
      "Realiza un mini debate de 3–5 minutos exigiendo datos, ejemplos o razones claras.",
    ],
    stepsEn: [
      "Suggest a light topic: two singers, two teams, two streamers, etc.",
      "Split the class into two sides (for/against, team A/B).",
      "Give each side 1 minute to prepare arguments.",
      "Run a 3–5 minute mini-debate asking for data, examples or clear reasons.",
    ],
  },
  {
    id: "tweet",
    emoji: "🐦",
    titleEs: "Un tweet inteligente",
    titleEn: "A smart tweet",
    shortEs:
      "Muestra un tweet corto relacionado con la materia para comentarlo.",
    shortEn:
      "Show a short tweet related to the subject and discuss it.",
    stepsEs: [
      "Ten preparado un tweet (real o inventado) sobre el tema de la clase.",
      "Proyéctalo o léelo en voz alta.",
      "Pregunta: ¿qué idea principal transmite?, ¿están de acuerdo?, ¿qué agregarían?",
      "Conecta el tweet con el contenido de la clase de hoy.",
    ],
    stepsEn: [
      "Prepare a tweet (real or invented) about today's topic.",
      "Show it on screen or read it aloud.",
      "Ask: what is the main idea?, do you agree?, what would you add?",
      "Connect the tweet with today's lesson content.",
    ],
  },
  {
    id: "silence",
    emoji: "🤫",
    titleEs: "Inicio en completo silencio",
    titleEn: "Silent start",
    shortEs:
      "Los primeros minutos son de silencio absoluto y concentración.",
    shortEn:
      "First minutes in complete silence and focus.",
    stepsEs: [
      "Explica que los próximos minutos serán de silencio total.",
      "Pueden leer, organizar su cuaderno o simplemente respirar profundo.",
      "Usa el silencio para bajar la ansiedad y observar cómo llega el grupo.",
      "Al terminar, pide una palabra que describa cómo se sienten.",
    ],
    stepsEn: [
      "Explain that the next minutes will be total silence.",
      "Students may read, organize their notebook or just breathe.",
      "Use silence to lower anxiety and observe the group.",
      "At the end, ask for one word describing how they feel.",
    ],
  },
  {
    id: "meditation",
    emoji: "🧘",
    titleEs: "Meditación guiada",
    titleEn: "Guided meditation",
    shortEs:
      "Solo si te sientes cómodo. Una breve meditación para centrar la mente.",
    shortEn:
      "Only if you feel comfortable. A short meditation to focus the mind.",
    stepsEs: [
      "Pide a los estudiantes que se sienten cómodos y cierren los ojos.",
      "Guía 1–2 minutos de respiración profunda y relajación.",
      "Invita a visualizar un objetivo para la clase de hoy.",
      "Vuelve lentamente al aula y recoge impresiones.",
    ],
    stepsEn: [
      "Ask students to sit comfortably and close their eyes.",
      "Guide 1–2 minutes of deep breathing and relaxation.",
      "Invite them to visualise a goal for today's class.",
      "Slowly come back and collect a few comments.",
    ],
  },
  {
    id: "podcast",
    emoji: "🎧",
    titleEs: "Fragmento de podcast",
    titleEn: "Podcast snippet",
    shortEs:
      "Escuchan un breve fragmento para introducir un tema o generar debate.",
    shortEn:
      "Listen to a short snippet to introduce a topic or spark debate.",
    stepsEs: [
      "Elige un fragmento de 1–3 minutos de un podcast pertinente.",
      "Pídeles que anoten una idea clave o una pregunta mientras escuchan.",
      "Comenten rápidamente qué les llamó la atención.",
      "Conecta el audio con el contenido de la clase.",
    ],
    stepsEn: [
      "Choose a 1–3-minute clip from a relevant podcast.",
      "Ask them to write one key idea or one question while listening.",
      "Briefly discuss what caught their attention.",
      "Connect the audio with the lesson content.",
    ],
  },
  {
    id: "youtube",
    emoji: "🎬",
    titleEs: "Vídeo de YouTube",
    titleEn: "YouTube video",
    shortEs:
      "Un vídeo corto, creativo o divertido para enganchar al grupo.",
    shortEn:
      "A short, fun or creative video to hook the group.",
    stepsEs: [
      "Selecciona un vídeo breve (30–90 s) acorde a tu grupo.",
      "Muéstralo sin dar explicación previa.",
      "Pregunta: ¿qué tiene que ver con nuestra clase?, ¿qué mensaje deja?",
      "Relaciona el vídeo con el objetivo del día.",
    ],
    stepsEn: [
      "Pick a short video (30–90 s) appropriate for your group.",
      "Play it without prior explanation.",
      "Ask: what does this have to do with our class? what message does it bring?",
      "Connect it with today's objective.",
    ],
  },
  {
    id: "reading",
    emoji: "📖",
    titleEs: "Empieza leyendo",
    titleEn: "Start by reading",
    shortEs:
      "Lectura breve de un poema, cómic, artículo o mensaje significativo.",
    shortEn:
      "Short reading: a poem, comic, article or meaningful message.",
    stepsEs: [
      "Elige un texto breve (poema, fragmento de libro, cómic, artículo, etc.).",
      "Léelo tú o pide a un estudiante que lo lea.",
      "Pregúntales qué frase les llamó más la atención.",
      "Usa esa frase para enlazar con la materia de hoy.",
    ],
    stepsEn: [
      "Choose a short text (poem, book excerpt, comic, article, etc.).",
      "Read it yourself or ask a student to read.",
      "Ask which sentence stood out the most.",
      "Use that sentence to link with today's content.",
    ],
  },
  {
    id: "personal_story",
    emoji: "👨‍🏫",
    titleEs: "Cuenta una historia personal",
    titleEn: "Tell a personal story",
    shortEs:
      "Comparte una anécdota auténtica para humanizar la clase.",
    shortEn:
      "Share a real anecdote to humanise the lesson.",
    stepsEs: [
      "Piensa en una historia corta de tu vida (infancia, trabajo, fin de semana).",
      "Relaciónala con un valor, una decisión o un error del que aprendiste.",
      "Pídeles que extraigan una enseñanza de la historia.",
      "Conecta esa enseñanza con el objetivo de aprendizaje.",
    ],
    stepsEn: [
      "Think of a short story from your life (childhood, work, weekend).",
      "Link it to a value, a decision or a mistake you learned from.",
      "Ask them what lesson they can draw from it.",
      "Connect that lesson with today's learning goal.",
    ],
  },
  {
    id: "instagram",
    emoji: "📸",
    titleEs: "Imagen de Instagram",
    titleEn: "Instagram image",
    shortEs:
      "Usa una imagen poderosa o viral como disparador de conversación.",
    shortEn:
      "Use a powerful or viral image as a conversation trigger.",
    stepsEs: [
      "Busca una imagen que haya circulado mucho o que sea visualmente impactante.",
      "Proyéctala y deja unos segundos en silencio para observarla.",
      "Pide tres palabras que describan lo que ven o sienten.",
      "Lanza una pregunta que conecte la imagen con la realidad de los estudiantes.",
    ],
    stepsEn: [
      "Pick an image that went viral or is visually striking.",
      "Show it and give a few seconds of silence to observe.",
      "Ask for three words that describe what they see or feel.",
      "Ask one question connecting the image with their reality.",
    ],
  },
  {
    id: "collaborative_story",
    emoji: "✍️",
    titleEs: "Relato conjunto",
    titleEn: "Collaborative story",
    shortEs:
      "Construyen un relato pasando el turno de frase en frase.",
    shortEn:
      "Build a story passing the turn sentence by sentence.",
    stepsEs: [
      "Escribe una frase inicial en la pizarra (ej.: 'El verano me recuerda a…').",
      "Cada estudiante agrega una frase nueva, conectando con lo anterior.",
      "Puedes hacerlo oralmente o con hojas que van rotando.",
      "Al final, lean el relato completo en voz alta.",
    ],
    stepsEn: [
      "Write a starting sentence on the board (e.g. 'Summer reminds me of…').",
      "Each student adds one new sentence, connecting with the previous one.",
      "You can do it orally or with papers rotating around.",
      "At the end, read the full story aloud.",
    ],
  },
];

export default function EpicStarters({
  t,
  idioma = "es",
  isSpecialClass = false,
  asignatura,
  curso,
  unidad,
  objetivo,
}) {
  const [activeId, setActiveId] = useState("one_minute_talk");

  const active = useMemo(
    () => ACTIVITIES.find((a) => a.id === activeId) || ACTIVITIES[0],
    [activeId]
  );

  const subtitle = t(
    "Elige una dinámica poderosa para encender la clase antes de entrar al contenido formal.",
    "Choose a powerful opener to ignite the class before the formal content."
  );

  const contextLine =
    asignatura || curso || unidad || objetivo
      ? t(
          `Contexto sugerido: ${curso || ""} · ${asignatura || ""} · ${unidad || ""}`,
          `Suggested context: ${curso || ""} · ${asignatura || ""} · ${unidad || ""}`
        )
      : "";

  const steps = idioma === "en" ? active.stepsEn : active.stepsEs;
  const short = idioma === "en" ? active.shortEn : active.shortEs;
  const title = idioma === "en" ? active.titleEn : active.titleEs;

  return (
    <div
      style={{
        borderRadius: 16,
        padding: "1rem",
        background: "rgba(255,255,255,0.96)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
        marginBottom: "1rem",
      }}
    >
      {/* Encabezado */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.3rem",
              fontWeight: 800,
            }}
          >
            {isSpecialClass
              ? t(
                  "🔥 Inicio épico — Clase especial",
                  "🔥 Epic start — Special class"
                )
              : t(
                  "🔥 Inicio épico de la clase",
                  "🔥 Epic class opener"
                )}
          </h2>
          <div style={smallMuted}>{subtitle}</div>
          {contextLine && (
            <div
              style={{
                ...smallMuted,
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {contextLine}
            </div>
          )}
        </div>
      </div>

      {/* LAYOUT: tarjetas arriba en grid 4 columnas, detalle abajo ancho completo */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Grid de tarjetas — 4 columnas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {ACTIVITIES.map((act) => {
            const isActive = act.id === activeId;
            const actTitle = idioma === "en" ? act.titleEn : act.titleEs;
            const actShort = idioma === "en" ? act.shortEn : act.shortEs;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => setActiveId(act.id)}
                style={{
                  ...cardBase,
                  textAlign: "left",
                  outline: "none",
                  border: isActive
                    ? "2px solid #0ea5e9"
                    : cardBase.border,
                  boxShadow: isActive
                    ? "0 14px 30px rgba(14,165,233,0.35)"
                    : cardBase.boxShadow,
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 2 }}>
                  {act.emoji}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    marginBottom: 2,
                  }}
                >
                  {actTitle}
                </div>
                <div style={{ ...smallMuted, fontSize: 11 }}>
                  {actShort}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detalle de la actividad seleccionada — ancho completo */}
        <div
          style={{
            borderRadius: 12,
            padding: "0.9rem 1rem",
            border: "1px solid #e5e7eb",
            background: "linear-gradient(135deg,#ecfeff,#eff6ff,#fdf2ff)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 26 }}>{active.emoji}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
              <div style={{ ...smallMuted, fontSize: 12 }}>{short}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 6,
              marginBottom: 4,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {t("Pasos sugeridos", "Suggested steps")}
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.05rem",
              fontSize: 13,
              color: "#111827",
            }}
          >
            {steps.map((st, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                {st}
              </li>
            ))}
          </ol>

          <div style={{ ...smallMuted, marginTop: 8 }}>
            {t(
              "Puedes adaptar el tiempo (3–10 minutos) según la energía del grupo.",
              "You can adapt the time (3–10 minutes) depending on the group's energy."
            )}
          </div>
        </div>
      </div>
    </div>
  );
}