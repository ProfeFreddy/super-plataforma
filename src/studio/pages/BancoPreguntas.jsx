import React, { useState } from "react";
import bancoMaestro from "../data/bancoMaestro";
import { obtenerPreguntasImportadas } from "../services/bancoStorage";

export default function BancoPreguntas() {
    const [seleccionada, setSeleccionada] = useState(null);
    const preguntasImportadas = obtenerPreguntasImportadas();
    const preguntasTotales = [...bancoMaestro, ...preguntasImportadas];

    return (
        <div style={styles.page}>
            <h1>📚 Banco Maestro de Preguntas</h1>
            <p style={styles.subtitle}>
                Total de preguntas cargadas: {preguntasTotales.length}

            </p>

            <div style={styles.filters}>
                <select style={styles.input}>
                    <option>Todas las asignaturas</option>
                    <option>Matemática</option>
                    <option>Lenguaje</option>
                    <option>Historia</option>
                    <option>Ciencias</option>
                </select>

                <select style={styles.input}>
                    <option>Todos los niveles</option>
                    <option>7° Básico</option>
                    <option>8° Básico</option>
                    <option>1° Medio</option>
                    <option>2° Medio</option>
                    <option>3° Medio</option>
                    <option>4° Medio</option>
                </select>

                <input
                    placeholder="Buscar pregunta..."
                    style={{ ...styles.input, minWidth: 300 }}
                />
            </div>

            <div style={styles.tableBox}>
                <table style={styles.table}>
                    <thead>
                        <tr style={styles.headRow}>
                            <th style={styles.th}>ID</th>
                            <th style={styles.th}>Asignatura</th>
                            <th style={styles.th}>Nivel</th>
                            <th style={styles.th}>OA</th>
                            <th style={styles.th}>Pregunta</th>
                            <th style={styles.th}>Dificultad</th>
                            <th style={styles.th}>Correcta</th>
                            <th style={styles.th}>Fuente</th>
                            <th style={styles.th}>Estado</th>
                        </tr>
                    </thead>

                    <tbody>
                        {preguntasTotales.map((q) => (
                            <tr
                                key={q.id}
                                style={styles.row}
                                onClick={() => setSeleccionada(q)}
                            >
                                <td style={styles.td}>{q.id}</td>
                                <td style={styles.td}>{q.asignatura}</td>
                                <td style={styles.td}>{q.nivel}</td>
                                <td style={styles.td}>{q.oa}</td>
                                <td style={styles.td}>{q.pregunta}</td>
                                <td style={styles.td}>{q.dificultad}</td>
                                <td style={styles.td}>{q.correcta}</td>
                                <td style={styles.td}>{q.fuente}</td>
                                <td style={styles.td}>{q.estado}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {seleccionada && (
                <div style={styles.overlay} onClick={() => setSeleccionada(null)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.close} onClick={() => setSeleccionada(null)}>
                            ✖
                        </button>

                        <h2>{seleccionada.id}</h2>

                        <p><b>Asignatura:</b> {seleccionada.asignatura}</p>
                        <p><b>Nivel:</b> {seleccionada.nivel}</p>
                        <p><b>OA:</b> {seleccionada.oa}</p>
                        <p><b>Dificultad:</b> {seleccionada.dificultad}</p>

                        <hr />

                        <h3>Pregunta</h3>
                        <p>{seleccionada.pregunta}</p>

                        <h3>Alternativas</h3>
                        <ol type="A">
                            {seleccionada.alternativas?.map((alt, i) => (
                                <li
                                    key={i}
                                    style={{
                                        marginBottom: 8,
                                        color: i === seleccionada.correcta ? "#22c55e" : "white",
                                        fontWeight: i === seleccionada.correcta ? "bold" : "normal",
                                    }}
                                >
                                    {alt}
                                </li>
                            ))}
                        </ol>

                        <h3>Retroalimentación</h3>
                        <p>{seleccionada.explicacion || "Sin explicación registrada todavía."}</p>

                        <p><b>Fuente:</b> {seleccionada.fuente}</p>
                        <p><b>Estado:</b> {seleccionada.estado}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: 30,
        fontFamily: "system-ui",
    },
    subtitle: {
        color: "#94a3b8",
    },
    filters: {
        display: "flex",
        gap: 10,
        marginTop: 20,
        flexWrap: "wrap",
    },
    input: {
        padding: 10,
        borderRadius: 8,
        border: "1px solid #334155",
    },
    tableBox: {
        marginTop: 30,
        border: "1px solid #334155",
        borderRadius: 12,
        overflow: "auto",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    headRow: {
        background: "#1e293b",
    },
    th: {
        padding: 12,
        textAlign: "left",
    },
    row: {
        borderTop: "1px solid #334155",
        cursor: "pointer",
    },
    td: {
        padding: 12,
    },
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
    },
    modal: {
        width: "90%",
        maxWidth: 700,
        background: "#1e293b",
        border: "1px solid #475569",
        borderRadius: 16,
        padding: 25,
        color: "white",
        position: "relative",
    },
    close: {
        position: "absolute",
        top: 15,
        right: 15,
        background: "#ef4444",
        color: "white",
        border: "none",
        borderRadius: 8,
        padding: "6px 10px",
        cursor: "pointer",
    },
};