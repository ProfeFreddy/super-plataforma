import React, { useState } from "react";
import { guardarPreguntasImportadas } from "../services/bancoStorage";

export default function ImportadorJson() {
    const [cantidad, setCantidad] = useState(0);
    const [archivoNombre, setArchivoNombre] = useState("");
    const [nivel, setNivel] = useState("");
    const [asignatura, setAsignatura] = useState("");
    const [preguntas, setPreguntas] = useState([]);
    const [convertidas, setConvertidas] = useState([]);

    const cargarArchivo = (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        setArchivoNombre(archivo.name);
        setConvertidas([]);

        const reader = new FileReader();

        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);

                if (data.preguntas) {
                    setCantidad(data.preguntas.length);
                    setNivel(data.nivel || "");
                    setAsignatura(data.asignatura || "");
                    setPreguntas(data.preguntas);
                } else {
                    alert("JSON válido pero sin arreglo preguntas");
                }
            } catch (err) {
                console.error(err);
                alert("Error leyendo JSON");
            }
        };

        reader.readAsText(archivo);
    };

    const normalizarNivel = (txt) =>
        (txt || "").replace("do Medio", "° Medio").replace("ro Medio", "° Medio");

    const codigoAsignatura = (txt) => {
        if ((txt || "").toLowerCase().includes("matem")) return "MAT";
        if ((txt || "").toLowerCase().includes("leng")) return "LEN";
        if ((txt || "").toLowerCase().includes("hist")) return "HIS";
        if ((txt || "").toLowerCase().includes("cien")) return "CIE";
        if ((txt || "").toLowerCase().includes("paes")) return "PAES";
        if ((txt || "").toLowerCase().includes("simce")) return "SIMCE";
        return "GEN";
    };

    const convertirAlBancoMaestro = () => {
        const cod = codigoAsignatura(asignatura);
        const nivelFinal = normalizarNivel(nivel);

        const nuevas = preguntas.map((p, index) => ({
            id: `${cod}-${String(index + 1).padStart(5, "0")}`,
            asignatura: asignatura || "Sin asignatura",
            nivel: nivelFinal || "Sin nivel",
            oa: "",
            tema: "",
            dificultad: "Intermedio",
            pregunta: p.pregunta || "",
            alternativas: p.alternativas || [],
            correcta: Number.isInteger(p.correcta) ? p.correcta : 0,
            explicacion: p.explicacion || "",
            estado: "aprobada",
            fuente: archivoNombre || "archivo_json",
            vecesUsada: 0,
            vecesFallada: 0,
            viralidad: 0,
        }));

        setConvertidas(nuevas);
    };

    const guardarEnBancoMaestro = () => {
        if (convertidas.length === 0) {
            alert("Primero convierte las preguntas.");
            return;
        }

        guardarPreguntasImportadas(convertidas);
        alert(`✅ ${convertidas.length} preguntas guardadas en el Banco Maestro temporal.`);
    };

    return (
        <div style={styles.page}>
            <h1>📥 Importador JSON</h1>

            <input type="file" accept=".json" onChange={cargarArchivo} />

            <div style={{ marginTop: 20 }}>
                <p><b>Archivo:</b> {archivoNombre}</p>
                <p><b>Asignatura:</b> {asignatura}</p>
                <p><b>Nivel:</b> {nivel}</p>
                <p><b>Preguntas encontradas:</b> {cantidad}</p>
            </div>

            {preguntas.length > 0 && (
                <button style={styles.btn} onClick={convertirAlBancoMaestro}>
                    🚀 Convertir al Banco Maestro
                </button>
            )}

            <hr style={{ margin: "30px 0" }} />

            <h2>Vista previa del JSON original</h2>

            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>#</th>
                        <th style={styles.th}>Pregunta</th>
                        <th style={styles.th}>Correcta</th>
                    </tr>
                </thead>

                <tbody>
                    {preguntas.slice(0, 10).map((p, index) => (
                        <tr key={index}>
                            <td style={styles.td}>{p.estacion}</td>
                            <td style={styles.td}>{p.pregunta}</td>
                            <td style={styles.td}>{p.correcta}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {convertidas.length > 0 && (
                <>
                    <hr style={{ margin: "30px 0" }} />

                    <h2>✅ Preguntas convertidas al formato universal</h2>
                    <p>Total convertidas: {convertidas.length}</p>

                    <button style={styles.btn} onClick={guardarEnBancoMaestro}>
                        💾 Guardar en Banco Maestro temporal
                    </button>

                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>ID</th>
                                <th style={styles.th}>Asignatura</th>
                                <th style={styles.th}>Nivel</th>
                                <th style={styles.th}>Pregunta</th>
                                <th style={styles.th}>Correcta</th>
                                <th style={styles.th}>Fuente</th>
                            </tr>
                        </thead>

                        <tbody>
                            {convertidas.slice(0, 10).map((q) => (
                                <tr key={q.id}>
                                    <td style={styles.td}>{q.id}</td>
                                    <td style={styles.td}>{q.asignatura}</td>
                                    <td style={styles.td}>{q.nivel}</td>
                                    <td style={styles.td}>{q.pregunta}</td>
                                    <td style={styles.td}>{q.correcta}</td>
                                    <td style={styles.td}>{q.fuente}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}

const styles = {
    page: {
        padding: 30,
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
        fontFamily: "system-ui",
    },
    btn: {
        marginTop: 15,
        padding: "12px 18px",
        borderRadius: 10,
        border: "none",
        background: "#22c55e",
        color: "#052e16",
        fontWeight: "bold",
        cursor: "pointer",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    th: {
        textAlign: "left",
        padding: 10,
        borderBottom: "1px solid #334155",
    },
    td: {
        padding: 10,
        borderTop: "1px solid #334155",
    },
};