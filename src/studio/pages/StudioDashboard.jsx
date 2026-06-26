// JavaScript source code
import React from "react";
import { useNavigate } from "react-router-dom";

export default function StudioDashboard() {
    const nav = useNavigate();

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>GINCANA STUDIO</h1>
            <p style={styles.subtitle}>
                Motor de creación educativa — Nivel profesional
            </p>

            <div style={styles.grid}>
                <button style={styles.card} onClick={() => nav("/studio/banco")}>
                    📚 Banco de Preguntas
                </button>

                <button style={styles.card} onClick={() => nav("/studio/editor")}>
                    ✍️ Editor de Pregunta
                </button>

                <button style={styles.card} onClick={() => nav("/studio/ia")}>
                    🤖 Generador IA
                </button>

                <button style={styles.card} onClick={() => nav("/studio/export")}>
                    📤 Exportador JSON
                </button>

                <button style={styles.card} onClick={() => nav("/studio/stats")}>
                    📊 Estadísticas
                </button>

                <button
                    style={styles.card}
                    onClick={() => nav("/studio/importar")}
                >
                    📥 Importar JSON
                </button>

            </div>
        </div>
    );
}

const styles = {
    container: {
        padding: 30,
        fontFamily: "system-ui",
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
    },
    title: {
        fontSize: 32,
        marginBottom: 5,
    },
    subtitle: {
        opacity: 0.7,
        marginBottom: 30,
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 20,
    },
    card: {
        padding: 20,
        borderRadius: 12,
        border: "1px solid #334155",
        background: "#111827",
        color: "white",
        fontSize: 16,
        cursor: "pointer",
        textAlign: "left",
    },
};