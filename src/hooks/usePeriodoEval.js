// src/hooks/usePeriodoEval.js
// Dado el uid y el slot actual (nivel, seccion, asignatura),
// devuelve las próximas evaluaciones con clases restantes.

import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

function calcularClasesRestantes(col, periodoInicio, periodoFin, fechaEval) {
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const eval_ = new Date(fechaEval); eval_.setHours(23,59,59,0);
    const inicio = new Date(periodoInicio); inicio.setHours(0,0,0,0);
    const fin = new Date(periodoFin); fin.setHours(23,59,59,0);

    const desde = hoy > inicio ? hoy : inicio;
    if (desde > eval_ || desde > fin) return 0;
    const hasta = eval_ < fin ? eval_ : fin;

    const diaSemana = col + 1; // col 0=Lunes=JS1 ... col4=Viernes=JS5
    let count = 0;
    const cursor = new Date(desde);
    while (cursor <= hasta) {
      if (cursor.getDay() === diaSemana) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  } catch { return null; }
}

export function usePeriodoEval({ nivel, seccion, asignatura }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid || !asignatura || !nivel) { setEvaluaciones([]); setLoading(false); return; }

        const usnap = await getDoc(doc(db, "usuarios", uid));
        if (!usnap.exists()) { setEvaluaciones([]); setLoading(false); return; }

        const data = usnap.data() || {};
        const pc = data.periodoConfig || {};
        const { inicio, fin, evaluaciones: evals = [] } = pc;
        if (!inicio || !fin || !evals.length) { setEvaluaciones([]); setLoading(false); return; }

        const curso = (nivel + (seccion ? ` ${seccion}` : "")).trim();
        const cursoKey = `${curso}__${asignatura}`;

        // También buscar col de este curso en horario_flat
        const flat = Array.isArray(data.horario_flat) ? data.horario_flat : [];
        const bloqueDelCurso = flat.find(
          (c) => {
            const cCurso = (c.nivel + (c.seccion ? ` ${c.seccion}` : "")).trim();
            return cCurso === curso && c.asignatura === asignatura;
          }
        );
        const col = bloqueDelCurso ? Number(bloqueDelCurso.col) : null;

        const evalsDelCurso = evals
          .filter((e) => e.cursoKey === cursoKey && e.fecha)
          .map((e) => {
            const restantes = col !== null
              ? calcularClasesRestantes(col, inicio, fin, e.fecha)
              : null;
            return { ...e, clasesRestantes: restantes };
          })
          .filter((e) => {
            // Solo mostrar evaluaciones futuras o de hoy
            const evalDate = new Date(e.fecha); evalDate.setHours(23,59,59,0);
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            return evalDate >= hoy;
          })
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        if (alive) setEvaluaciones(evalsDelCurso);
      } catch (e) {
        console.warn("[usePeriodoEval]", e?.message);
        if (alive) setEvaluaciones([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [nivel, seccion, asignatura]);

  return { evaluaciones, loading };
}