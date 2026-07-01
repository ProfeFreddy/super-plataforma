import React from "react";

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  boxShadow: "0 18px 45px rgba(15,23,42,.12)",
};

export default function AutoClassShowcase() {
  return (
    <section style={{ ...card, padding: 26, marginTop: 18 }}>
      <div style={{ color: "#0891b2", fontWeight: 900, marginBottom: 10 }}>
        La diferencia PragmaProfe
      </div>

      <h2 style={{ fontSize: "clamp(28px,4vw,48px)", lineHeight: 1.05, margin: 0 }}>
        Llegas al aula. Abres el computador. La clase correcta ya está lista.
      </h2>

      <p style={{ fontSize: 18, color: "#475569", maxWidth: 850, lineHeight: 1.55 }}>
        PragmaProfe reconoce el día, la hora, el curso, la asignatura, la unidad
        y el objetivo curricular para iniciar la clase que corresponde sin buscar
        archivos, enlaces ni recursos dispersos.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 22,
        }}
      >
        <ClassBox
          time="08:00"
          course="2° Medio B"
          subject="Matemática"
          objective="OA04 · Función cuadrática"
          action="Clase preparada"
        />

        <ClassBox
          time="09:50"
          course="1° Medio B"
          subject="Geometría"
          objective="OA07 · Homotecia y valor de k"
          action="Cambio automático"
        />

        <ClassBox
          time="11:30"
          course="4° Medio"
          subject="Modelamiento"
          objective="Funciones trigonométricas y periódicas"
          action="Recursos listos"
        />
      </div>
    </section>
  );
}

function ClassBox({ time, course, subject, objective, action }) {
  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 18,
        padding: 18,
        background: "linear-gradient(180deg,#f8fafc,#eff6ff)",
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>{time}</div>
      <div style={{ fontWeight: 900, marginTop: 8 }}>{course}</div>
      <div style={{ color: "#0369a1", fontWeight: 800 }}>{subject}</div>
      <div style={{ color: "#475569", marginTop: 8 }}>{objective}</div>
      <div
        style={{
          marginTop: 14,
          display: "inline-flex",
          padding: "7px 12px",
          borderRadius: 999,
          background: "#dcfce7",
          color: "#166534",
          fontWeight: 900,
        }}
      >
        ✅ {action}
      </div>
    </div>
  );
}