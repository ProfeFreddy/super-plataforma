/**
 * seed-curriculo.js
 * Carga el currículo MINEDUC actualizado en Firestore (colección "curriculo")
 *
 * Uso:
 *   node tools-seed/seed-curriculo.js
 *
 * Requiere:
 *   - Firebase Admin SDK configurado (serviceAccountKey.json en raíz del proyecto)
 *   - npm install firebase-admin (si no está instalado)
 */

const admin = require("firebase-admin");
const path = require("path");

// ── Inicializar Firebase Admin ──────────────────────────────────────────────
const serviceAccount = require(path.join(__dirname, "../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pragma-2c5d1-default-rtdb.firebaseio.com",
});

const db = admin.firestore();

// ── Datos curriculares MINEDUC (Bases Curriculares 2019-2024) ───────────────
// Estructura: cada entrada = un documento en colección "curriculo"
// ID del documento: {ASIG}-{GRADO}-{UNIDAD}  ej: MAT-7B-U1

const CURRICULO = [

  // ══════════════════════════════════════════════════════════════
  // MATEMÁTICA — 7° Básico a 4° Medio
  // ══════════════════════════════════════════════════════════════
  {
    id: "MAT-7B-U1", asignaturaId: "matematica", grado: "7B", nivel: "7° básico",
    titulo: "Números y operaciones",
    objetivos: [
      "Representar y operar con números enteros, fracciones y decimales en contextos cotidianos.",
      "Aplicar propiedades de las operaciones para resolver problemas.",
      "Calcular potencias y raíces cuadradas con números naturales.",
    ],
    habilidades: ["Resolver problemas", "Representar", "Argumentar y comunicar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "MAT-7B-U2", asignaturaId: "matematica", grado: "7B", nivel: "7° básico",
    titulo: "Álgebra y funciones",
    objetivos: [
      "Usar variables y expresiones algebraicas para representar situaciones.",
      "Resolver ecuaciones de primer grado con una incógnita.",
      "Identificar y representar relaciones de proporcionalidad directa e inversa.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Representar"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "MAT-7B-U3", asignaturaId: "matematica", grado: "7B", nivel: "7° básico",
    titulo: "Geometría",
    objetivos: [
      "Calcular perímetros y áreas de figuras planas.",
      "Identificar y clasificar triángulos y cuadriláteros según sus propiedades.",
      "Construir figuras geométricas con instrumentos.",
    ],
    habilidades: ["Representar", "Argumentar y comunicar", "Modelar"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "MAT-7B-U4", asignaturaId: "matematica", grado: "7B", nivel: "7° básico",
    titulo: "Estadística y probabilidad",
    objetivos: [
      "Recolectar, organizar y representar datos en tablas y gráficos.",
      "Calcular medidas de tendencia central: media, mediana y moda.",
      "Determinar la probabilidad de eventos simples.",
    ],
    habilidades: ["Resolver problemas", "Representar", "Argumentar y comunicar"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "MAT-8B-U1", asignaturaId: "matematica", grado: "8B", nivel: "8° básico",
    titulo: "Números racionales e irracionales",
    objetivos: [
      "Operar con números racionales y representarlos en la recta numérica.",
      "Reconocer números irracionales y su representación decimal.",
      "Aplicar el teorema de Pitágoras en problemas geométricos.",
    ],
    habilidades: ["Resolver problemas", "Representar", "Modelar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "MAT-8B-U2", asignaturaId: "matematica", grado: "8B", nivel: "8° básico",
    titulo: "Álgebra",
    objetivos: [
      "Factorizar expresiones algebraicas usando productos notables.",
      "Resolver sistemas de ecuaciones lineales con dos incógnitas.",
      "Interpretar soluciones en contextos reales.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Argumentar y comunicar"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "MAT-8B-U3", asignaturaId: "matematica", grado: "8B", nivel: "8° básico",
    titulo: "Geometría analítica",
    objetivos: [
      "Usar el plano cartesiano para representar figuras y relaciones.",
      "Calcular distancia entre dos puntos y punto medio.",
      "Transformar figuras en el plano: traslaciones, rotaciones, reflexiones.",
    ],
    habilidades: ["Representar", "Modelar", "Resolver problemas"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "MAT-8B-U4", asignaturaId: "matematica", grado: "8B", nivel: "8° básico",
    titulo: "Estadística y probabilidad",
    objetivos: [
      "Construir e interpretar histogramas y gráficos de caja.",
      "Calcular varianza y desviación estándar de conjuntos de datos.",
      "Aplicar reglas de probabilidad en situaciones cotidianas.",
    ],
    habilidades: ["Resolver problemas", "Representar", "Argumentar y comunicar"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "MAT-1M-U1", asignaturaId: "matematica", grado: "1M", nivel: "1° medio",
    titulo: "Números reales y potencias",
    objetivos: [
      "Operar con números reales incluyendo potencias y radicales.",
      "Simplificar expresiones con potencias de exponente entero y fraccionario.",
      "Resolver problemas aplicando propiedades de los números reales.",
    ],
    habilidades: ["Resolver problemas", "Representar", "Modelar"],
    oas: ["OA1", "OA2"],
  },
  {
    id: "MAT-1M-U2", asignaturaId: "matematica", grado: "1M", nivel: "1° medio",
    titulo: "Álgebra y funciones",
    objetivos: [
      "Factorizar polinomios usando técnicas algebraicas.",
      "Operar con fracciones algebraicas.",
      "Resolver ecuaciones e inecuaciones de primer y segundo grado.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Argumentar y comunicar"],
    oas: ["OA3", "OA4", "OA5"],
  },
  {
    id: "MAT-1M-U3", asignaturaId: "matematica", grado: "1M", nivel: "1° medio",
    titulo: "Funciones",
    objetivos: [
      "Identificar y representar funciones lineales y cuadráticas.",
      "Interpretar dominio, recorrido, ceros y comportamiento de funciones.",
      "Modelar situaciones reales con funciones.",
    ],
    habilidades: ["Modelar", "Representar", "Resolver problemas"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "MAT-1M-U4", asignaturaId: "matematica", grado: "1M", nivel: "1° medio",
    titulo: "Geometría",
    objetivos: [
      "Aplicar razones trigonométricas en triángulos rectángulos.",
      "Resolver problemas de medición usando trigonometría.",
      "Calcular áreas y volúmenes de sólidos geométricos.",
    ],
    habilidades: ["Resolver problemas", "Modelar", "Representar"],
    oas: ["OA8", "OA9"],
  },
  {
    id: "MAT-1M-U5", asignaturaId: "matematica", grado: "1M", nivel: "1° medio",
    titulo: "Probabilidad y estadística",
    objetivos: [
      "Calcular probabilidades usando técnicas de conteo.",
      "Construir e interpretar distribuciones de frecuencia.",
      "Aplicar medidas de dispersión para analizar conjuntos de datos.",
    ],
    habilidades: ["Resolver problemas", "Representar", "Argumentar y comunicar"],
    oas: ["OA10", "OA11"],
  },

  {
    id: "MAT-2M-U1", asignaturaId: "matematica", grado: "2M", nivel: "2° medio",
    titulo: "Álgebra y funciones avanzadas",
    objetivos: [
      "Analizar funciones exponenciales y logarítmicas.",
      "Resolver ecuaciones exponenciales y logarítmicas.",
      "Modelar fenómenos de crecimiento y decrecimiento.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Representar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "MAT-2M-U2", asignaturaId: "matematica", grado: "2M", nivel: "2° medio",
    titulo: "Trigonometría",
    objetivos: [
      "Aplicar las razones trigonométricas en el círculo unitario.",
      "Resolver triángulos usando la ley de senos y cosenos.",
      "Modelar fenómenos periódicos con funciones trigonométricas.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Representar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "MAT-2M-U3", asignaturaId: "matematica", grado: "2M", nivel: "2° medio",
    titulo: "Geometría analítica",
    objetivos: [
      "Representar y analizar cónicas: circunferencia, parábola, elipse.",
      "Resolver problemas geométricos usando coordenadas.",
      "Aplicar transformaciones en el plano cartesiano.",
    ],
    habilidades: ["Representar", "Resolver problemas", "Modelar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "MAT-2M-U4", asignaturaId: "matematica", grado: "2M", nivel: "2° medio",
    titulo: "Estadística inferencial",
    objetivos: [
      "Aplicar conceptos de distribución normal.",
      "Interpretar datos estadísticos en contextos reales.",
      "Evaluar críticamente información estadística de medios de comunicación.",
    ],
    habilidades: ["Resolver problemas", "Argumentar y comunicar", "Representar"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "MAT-3M-U1", asignaturaId: "matematica", grado: "3M", nivel: "3° medio",
    titulo: "Cálculo diferencial",
    objetivos: [
      "Comprender el concepto de límite y continuidad de funciones.",
      "Calcular derivadas usando reglas de derivación.",
      "Aplicar la derivada para analizar el comportamiento de funciones.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Argumentar y comunicar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "MAT-3M-U2", asignaturaId: "matematica", grado: "3M", nivel: "3° medio",
    titulo: "Cálculo integral",
    objetivos: [
      "Calcular integrales indefinidas y definidas.",
      "Aplicar el teorema fundamental del cálculo.",
      "Calcular áreas bajo curvas usando integrales.",
    ],
    habilidades: ["Resolver problemas", "Modelar", "Representar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "MAT-3M-U3", asignaturaId: "matematica", grado: "3M", nivel: "3° medio",
    titulo: "Probabilidad y estadística avanzada",
    objetivos: [
      "Aplicar distribuciones de probabilidad discretas y continuas.",
      "Realizar inferencias estadísticas básicas.",
      "Interpretar resultados estadísticos en contextos científicos y sociales.",
    ],
    habilidades: ["Resolver problemas", "Argumentar y comunicar", "Representar"],
    oas: ["OA6", "OA7"],
  },

  {
    id: "MAT-4M-U1", asignaturaId: "matematica", grado: "4M", nivel: "4° medio",
    titulo: "Álgebra lineal básica",
    objetivos: [
      "Operar con vectores y matrices.",
      "Resolver sistemas de ecuaciones usando matrices.",
      "Aplicar transformaciones lineales en el plano.",
    ],
    habilidades: ["Modelar", "Resolver problemas", "Representar"],
    oas: ["OA1", "OA2"],
  },
  {
    id: "MAT-4M-U2", asignaturaId: "matematica", grado: "4M", nivel: "4° medio",
    titulo: "Números complejos",
    objetivos: [
      "Operar con números complejos en forma rectangular y polar.",
      "Representar números complejos en el plano de Argand.",
      "Resolver ecuaciones con soluciones complejas.",
    ],
    habilidades: ["Representar", "Resolver problemas", "Modelar"],
    oas: ["OA3", "OA4"],
  },
  {
    id: "MAT-4M-U3", asignaturaId: "matematica", grado: "4M", nivel: "4° medio",
    titulo: "Modelación matemática",
    objetivos: [
      "Construir modelos matemáticos para fenómenos reales.",
      "Evaluar la pertinencia y limitaciones de los modelos.",
      "Comunicar resultados de modelaciones de manera precisa.",
    ],
    habilidades: ["Modelar", "Argumentar y comunicar", "Resolver problemas"],
    oas: ["OA5", "OA6"],
  },

  // ══════════════════════════════════════════════════════════════
  // LENGUAJE Y COMUNICACIÓN — 7° Básico a 4° Medio
  // ══════════════════════════════════════════════════════════════
  {
    id: "LEN-7B-U1", asignaturaId: "lenguaje", grado: "7B", nivel: "7° básico",
    titulo: "Lectura y comprensión de textos narrativos",
    objetivos: [
      "Leer y comprender novelas y cuentos identificando elementos narrativos.",
      "Analizar personajes, narrador y ambiente en textos literarios.",
      "Relacionar textos literarios con contextos históricos y culturales.",
    ],
    habilidades: ["Comunicación oral", "Lectura", "Escritura"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "LEN-7B-U2", asignaturaId: "lenguaje", grado: "7B", nivel: "7° básico",
    titulo: "Escritura y producción textual",
    objetivos: [
      "Escribir textos narrativos y descriptivos con coherencia y cohesión.",
      "Aplicar normas ortográficas y gramaticales en la escritura.",
      "Revisar y editar textos propios usando criterios dados.",
    ],
    habilidades: ["Escritura", "Comunicación oral", "Manejo de la lengua"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "LEN-7B-U3", asignaturaId: "lenguaje", grado: "7B", nivel: "7° básico",
    titulo: "Comunicación oral y medios",
    objetivos: [
      "Participar en debates y exposiciones orales argumentadas.",
      "Analizar críticamente mensajes de medios de comunicación.",
      "Evaluar la confiabilidad y propósito de fuentes de información.",
    ],
    habilidades: ["Comunicación oral", "Lectura", "Investigación"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "LEN-7B-U4", asignaturaId: "lenguaje", grado: "7B", nivel: "7° básico",
    titulo: "Textos no literarios e investigación",
    objetivos: [
      "Leer y comprender textos informativos, expositivos y argumentativos.",
      "Extraer información relevante y sintetizarla.",
      "Producir textos no literarios con propósito comunicativo claro.",
    ],
    habilidades: ["Lectura", "Escritura", "Investigación"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "LEN-8B-U1", asignaturaId: "lenguaje", grado: "8B", nivel: "8° básico",
    titulo: "Literatura y sociedad",
    objetivos: [
      "Analizar obras literarias en relación con su contexto sociocultural.",
      "Identificar recursos literarios y su efecto en el lector.",
      "Comparar visiones de mundo en diferentes textos literarios.",
    ],
    habilidades: ["Lectura", "Comunicación oral", "Escritura"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "LEN-8B-U2", asignaturaId: "lenguaje", grado: "8B", nivel: "8° básico",
    titulo: "Escritura argumentativa",
    objetivos: [
      "Escribir ensayos y textos argumentativos con tesis clara.",
      "Usar evidencias y contraargumentos para defender una postura.",
      "Aplicar conectores y marcadores discursivos adecuados.",
    ],
    habilidades: ["Escritura", "Comunicación oral", "Manejo de la lengua"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "LEN-8B-U3", asignaturaId: "lenguaje", grado: "8B", nivel: "8° básico",
    titulo: "Oralidad y comunicación digital",
    objetivos: [
      "Producir discursos orales formales e informales con propósito claro.",
      "Evaluar críticamente contenidos digitales y redes sociales.",
      "Reconocer estrategias de persuasión en publicidad y medios.",
    ],
    habilidades: ["Comunicación oral", "Lectura", "Investigación"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "LEN-8B-U4", asignaturaId: "lenguaje", grado: "8B", nivel: "8° básico",
    titulo: "Investigación y textos académicos",
    objetivos: [
      "Planificar y ejecutar proyectos de investigación.",
      "Citar fuentes correctamente usando normas bibliográficas.",
      "Presentar resultados de investigación en formato oral y escrito.",
    ],
    habilidades: ["Investigación", "Escritura", "Comunicación oral"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "LEN-1M-U1", asignaturaId: "lenguaje", grado: "1M", nivel: "1° medio",
    titulo: "Literatura hispanoamericana",
    objetivos: [
      "Leer obras representativas de la literatura hispanoamericana.",
      "Analizar características del realismo mágico y otras corrientes.",
      "Interpretar textos considerando contexto histórico y cultural.",
    ],
    habilidades: ["Lectura", "Escritura", "Comunicación oral"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "LEN-1M-U2", asignaturaId: "lenguaje", grado: "1M", nivel: "1° medio",
    titulo: "Escritura creativa y géneros",
    objetivos: [
      "Producir textos de distintos géneros literarios con intención estética.",
      "Aplicar recursos retóricos y estilísticos en la escritura.",
      "Revisar y reescribir textos propios incorporando retroalimentación.",
    ],
    habilidades: ["Escritura", "Lectura", "Comunicación oral"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "LEN-1M-U3", asignaturaId: "lenguaje", grado: "1M", nivel: "1° medio",
    titulo: "Argumentación y debate",
    objetivos: [
      "Participar en debates académicos con argumentos fundamentados.",
      "Analizar textos argumentativos identificando falacias y sesgos.",
      "Escribir ensayos argumentativos con estructura clara.",
    ],
    habilidades: ["Comunicación oral", "Escritura", "Lectura"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "LEN-1M-U4", asignaturaId: "lenguaje", grado: "1M", nivel: "1° medio",
    titulo: "Medios, lenguaje e identidad",
    objetivos: [
      "Analizar la construcción de identidades en medios y redes sociales.",
      "Evaluar críticamente el discurso mediático y publicitario.",
      "Producir contenido digital responsable y con propósito comunicativo.",
    ],
    habilidades: ["Lectura", "Comunicación oral", "Investigación"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "LEN-2M-U1", asignaturaId: "lenguaje", grado: "2M", nivel: "2° medio",
    titulo: "Literatura universal",
    objetivos: [
      "Leer y analizar obras de la literatura universal de distintas épocas.",
      "Comparar visiones de mundo en textos de culturas diferentes.",
      "Interpretar simbolismos y temas universales en la literatura.",
    ],
    habilidades: ["Lectura", "Escritura", "Comunicación oral"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "LEN-2M-U2", asignaturaId: "lenguaje", grado: "2M", nivel: "2° medio",
    titulo: "Escritura académica",
    objetivos: [
      "Producir textos académicos con rigor argumentativo.",
      "Integrar fuentes bibliográficas de manera ética y pertinente.",
      "Aplicar normas de presentación de trabajos académicos.",
    ],
    habilidades: ["Escritura", "Investigación", "Manejo de la lengua"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "LEN-2M-U3", asignaturaId: "lenguaje", grado: "2M", nivel: "2° medio",
    titulo: "Oralidad formal e informal",
    objetivos: [
      "Adaptar el registro lingüístico a distintos contextos comunicativos.",
      "Analizar el uso del lenguaje en discursos políticos y sociales.",
      "Producir presentaciones orales formales con apoyo audiovisual.",
    ],
    habilidades: ["Comunicación oral", "Lectura", "Escritura"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "LEN-2M-U4", asignaturaId: "lenguaje", grado: "2M", nivel: "2° medio",
    titulo: "Investigación y divulgación",
    objetivos: [
      "Realizar investigaciones sobre temas literarios o lingüísticos.",
      "Comunicar resultados de investigación en formatos variados.",
      "Evaluar la calidad y relevancia de fuentes de información.",
    ],
    habilidades: ["Investigación", "Escritura", "Comunicación oral"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "LEN-3M-U1", asignaturaId: "lenguaje", grado: "3M", nivel: "3° medio",
    titulo: "Literatura chilena e identidad",
    objetivos: [
      "Leer obras fundamentales de la literatura chilena.",
      "Analizar la relación entre literatura e identidad nacional.",
      "Interpretar referencias históricas y sociales en textos literarios chilenos.",
    ],
    habilidades: ["Lectura", "Escritura", "Comunicación oral"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "LEN-3M-U2", asignaturaId: "lenguaje", grado: "3M", nivel: "3° medio",
    titulo: "Escritura para audiencias diversas",
    objetivos: [
      "Producir textos adaptados a audiencias y propósitos específicos.",
      "Usar estrategias retóricas para persuadir y convencer.",
      "Editar textos propios considerando coherencia, cohesión y estilo.",
    ],
    habilidades: ["Escritura", "Comunicación oral", "Manejo de la lengua"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "LEN-3M-U3", asignaturaId: "lenguaje", grado: "3M", nivel: "3° medio",
    titulo: "Pensamiento crítico y medios",
    objetivos: [
      "Analizar críticamente el discurso político, mediático y publicitario.",
      "Identificar mecanismos de manipulación y desinformación.",
      "Producir textos que tomen postura fundamentada sobre temas contingentes.",
    ],
    habilidades: ["Lectura", "Comunicación oral", "Investigación"],
    oas: ["OA6", "OA7"],
  },

  {
    id: "LEN-4M-U1", asignaturaId: "lenguaje", grado: "4M", nivel: "4° medio",
    titulo: "Literatura y pensamiento contemporáneo",
    objetivos: [
      "Analizar obras literarias contemporáneas en su contexto global.",
      "Relacionar textos literarios con debates filosóficos y éticos actuales.",
      "Producir reseñas y ensayos críticos sobre obras literarias.",
    ],
    habilidades: ["Lectura", "Escritura", "Comunicación oral"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "LEN-4M-U2", asignaturaId: "lenguaje", grado: "4M", nivel: "4° medio",
    titulo: "Proyecto de escritura extendida",
    objetivos: [
      "Desarrollar un proyecto de escritura de largo aliento con autonomía.",
      "Incorporar retroalimentación de pares y docente en el proceso.",
      "Presentar y defender el proyecto escrito ante una audiencia.",
    ],
    habilidades: ["Escritura", "Comunicación oral", "Investigación"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "LEN-4M-U3", asignaturaId: "lenguaje", grado: "4M", nivel: "4° medio",
    titulo: "Comunicación profesional y ciudadana",
    objetivos: [
      "Producir textos útiles para contextos laborales y ciudadanos.",
      "Comprender y redactar documentos formales: cartas, informes, solicitudes.",
      "Participar efectivamente en instancias cívicas de comunicación.",
    ],
    habilidades: ["Escritura", "Comunicación oral", "Manejo de la lengua"],
    oas: ["OA6", "OA7"],
  },

  // ══════════════════════════════════════════════════════════════
  // HISTORIA, GEOGRAFÍA Y CIENCIAS SOCIALES — 7° Básico a 4° Medio
  // ══════════════════════════════════════════════════════════════
  {
    id: "HIS-7B-U1", asignaturaId: "historia", grado: "7B", nivel: "7° básico",
    titulo: "La prehistoria y el surgimiento de las civilizaciones",
    objetivos: [
      "Explicar el proceso de hominización y las etapas de la prehistoria.",
      "Caracterizar las primeras civilizaciones: Mesopotamia, Egipto, India y China.",
      "Analizar el origen de la escritura y su impacto en la historia.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "HIS-7B-U2", asignaturaId: "historia", grado: "7B", nivel: "7° básico",
    titulo: "El mundo clásico: Grecia y Roma",
    objetivos: [
      "Caracterizar la civilización griega y sus aportes a la cultura occidental.",
      "Analizar la organización política y social de Roma.",
      "Identificar el legado cultural del mundo clásico en la actualidad.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Análisis y trabajo con fuentes", "Pensamiento crítico"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "HIS-7B-U3", asignaturaId: "historia", grado: "7B", nivel: "7° básico",
    titulo: "La Edad Media",
    objetivos: [
      "Explicar la organización feudal y la sociedad medieval europea.",
      "Analizar el papel de la Iglesia Católica en la Edad Media.",
      "Caracterizar las civilizaciones islámica y bizantina.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "HIS-7B-U4", asignaturaId: "historia", grado: "7B", nivel: "7° básico",
    titulo: "Civilizaciones precolombinas y el encuentro de dos mundos",
    objetivos: [
      "Caracterizar las principales civilizaciones americanas: Maya, Azteca e Inca.",
      "Analizar el proceso de conquista española de América.",
      "Evaluar el impacto del encuentro entre culturas americanas y europeas.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Pensamiento crítico", "Análisis y trabajo con fuentes"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "HIS-8B-U1", asignaturaId: "historia", grado: "8B", nivel: "8° básico",
    titulo: "El mundo moderno: Renacimiento y Reforma",
    objetivos: [
      "Caracterizar el Renacimiento y el humanismo como cambios culturales.",
      "Analizar la Reforma Protestante y sus consecuencias religiosas.",
      "Explicar el desarrollo del pensamiento científico moderno.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "HIS-8B-U2", asignaturaId: "historia", grado: "8B", nivel: "8° básico",
    titulo: "Ilustración, Revolución y Liberalismo",
    objetivos: [
      "Explicar los principios de la Ilustración y su impacto político.",
      "Analizar las revoluciones americana y francesa.",
      "Relacionar el liberalismo político y económico del siglo XIX.",
    ],
    habilidades: ["Pensamiento crítico", "Análisis y trabajo con fuentes", "Pensamiento temporal y espacial"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "HIS-8B-U3", asignaturaId: "historia", grado: "8B", nivel: "8° básico",
    titulo: "Independencias americanas y formación de naciones",
    objetivos: [
      "Analizar el proceso de independencia de América Latina.",
      "Caracterizar la formación de los Estados nacionales latinoamericanos.",
      "Evaluar los desafíos de los nuevos Estados en el siglo XIX.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "HIS-8B-U4", asignaturaId: "historia", grado: "8B", nivel: "8° básico",
    titulo: "Imperialismo, industrialización y el mundo contemporáneo",
    objetivos: [
      "Explicar el imperialismo europeo y sus consecuencias globales.",
      "Analizar la Revolución Industrial y sus efectos sociales.",
      "Relacionar estos procesos con los conflictos del siglo XX.",
    ],
    habilidades: ["Pensamiento crítico", "Pensamiento temporal y espacial", "Análisis y trabajo con fuentes"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "HIS-1M-U1", asignaturaId: "historia", grado: "1M", nivel: "1° medio",
    titulo: "El mundo en el siglo XX: guerras y totalitarismos",
    objetivos: [
      "Analizar las causas y consecuencias de la Primera y Segunda Guerra Mundial.",
      "Caracterizar los regímenes totalitarios del siglo XX.",
      "Evaluar el impacto del Holocausto en la conciencia moral de la humanidad.",
    ],
    habilidades: ["Pensamiento crítico", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "HIS-1M-U2", asignaturaId: "historia", grado: "1M", nivel: "1° medio",
    titulo: "Guerra Fría y descolonización",
    objetivos: [
      "Explicar la Guerra Fría y la bipolaridad mundial.",
      "Analizar el proceso de descolonización en Asia y África.",
      "Evaluar el impacto de la Guerra Fría en América Latina.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Pensamiento crítico", "Análisis y trabajo con fuentes"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "HIS-1M-U3", asignaturaId: "historia", grado: "1M", nivel: "1° medio",
    titulo: "El mundo actual: globalización y desafíos",
    objetivos: [
      "Caracterizar el proceso de globalización y sus dimensiones.",
      "Analizar los principales desafíos del mundo contemporáneo.",
      "Evaluar el rol de los organismos internacionales en la gobernanza global.",
    ],
    habilidades: ["Pensamiento crítico", "Comunicación", "Análisis y trabajo con fuentes"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "HIS-1M-U4", asignaturaId: "historia", grado: "1M", nivel: "1° medio",
    titulo: "Geografía: territorio, recursos y sustentabilidad",
    objetivos: [
      "Analizar la distribución de recursos naturales en el mundo.",
      "Evaluar el impacto ambiental de las actividades humanas.",
      "Proponer soluciones sustentables a problemas ambientales.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Pensamiento crítico", "Comunicación"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "HIS-2M-U1", asignaturaId: "historia", grado: "2M", nivel: "2° medio",
    titulo: "Historia de Chile: colonia y formación republicana",
    objetivos: [
      "Analizar la sociedad colonial chilena y sus características.",
      "Explicar el proceso de independencia de Chile.",
      "Caracterizar la formación del Estado chileno en el siglo XIX.",
    ],
    habilidades: ["Pensamiento temporal y espacial", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "HIS-2M-U2", asignaturaId: "historia", grado: "2M", nivel: "2° medio",
    titulo: "Chile en el siglo XIX: expansión y conflictos",
    objetivos: [
      "Analizar la Guerra del Pacífico y sus consecuencias para Chile.",
      "Caracterizar la cuestión social y los conflictos del período parlamentario.",
      "Evaluar el desarrollo económico de Chile en el siglo XIX.",
    ],
    habilidades: ["Análisis y trabajo con fuentes", "Pensamiento crítico", "Comunicación"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "HIS-2M-U3", asignaturaId: "historia", grado: "2M", nivel: "2° medio",
    titulo: "Chile en el siglo XX: crisis, democratización y dictadura",
    objetivos: [
      "Analizar la crisis del parlamentarismo y el surgimiento del Estado desarrollista.",
      "Examinar el período de la Unidad Popular y el golpe de 1973.",
      "Evaluar la dictadura militar y sus consecuencias en derechos humanos.",
    ],
    habilidades: ["Pensamiento crítico", "Análisis y trabajo con fuentes", "Comunicación"],
    oas: ["OA6", "OA7", "OA8"],
  },
  {
    id: "HIS-2M-U4", asignaturaId: "historia", grado: "2M", nivel: "2° medio",
    titulo: "Chile democrático: transición y desafíos actuales",
    objetivos: [
      "Analizar el proceso de transición a la democracia en Chile.",
      "Evaluar los principales desafíos políticos, sociales y económicos del Chile actual.",
      "Reflexionar sobre la identidad y diversidad cultural chilena.",
    ],
    habilidades: ["Pensamiento crítico", "Comunicación", "Análisis y trabajo con fuentes"],
    oas: ["OA9", "OA10"],
  },

  // ══════════════════════════════════════════════════════════════
  // CIENCIAS NATURALES — 7° y 8° Básico
  // ══════════════════════════════════════════════════════════════
  {
    id: "CN-7B-U1", asignaturaId: "ciencias", grado: "7B", nivel: "7° básico",
    titulo: "Célula: unidad de la vida",
    objetivos: [
      "Describir la estructura y función de los componentes celulares.",
      "Distinguir entre células procariotas y eucariotas.",
      "Explicar los procesos de nutrición celular: fotosíntesis y respiración.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Analizar y concluir"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "CN-7B-U2", asignaturaId: "ciencias", grado: "7B", nivel: "7° básico",
    titulo: "Ecosistemas y biodiversidad",
    objetivos: [
      "Caracterizar los componentes bióticos y abióticos de un ecosistema.",
      "Analizar las relaciones entre organismos: cadenas y redes tróficas.",
      "Evaluar el impacto humano en la biodiversidad y los ecosistemas.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "CN-7B-U3", asignaturaId: "ciencias", grado: "7B", nivel: "7° básico",
    titulo: "Materia y sus transformaciones",
    objetivos: [
      "Clasificar la materia según sus propiedades y estados.",
      "Distinguir cambios físicos y químicos de la materia.",
      "Analizar mezclas y métodos de separación.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Analizar y concluir"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "CN-7B-U4", asignaturaId: "ciencias", grado: "7B", nivel: "7° básico",
    titulo: "Fuerzas y movimiento",
    objetivos: [
      "Describir el movimiento usando conceptos de velocidad y aceleración.",
      "Aplicar las leyes de Newton para explicar el movimiento.",
      "Analizar situaciones cotidianas donde actúan fuerzas.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Analizar y concluir"],
    oas: ["OA10", "OA11", "OA12"],
  },

  {
    id: "CN-8B-U1", asignaturaId: "ciencias", grado: "8B", nivel: "8° básico",
    titulo: "Reproducción y herencia",
    objetivos: [
      "Explicar los mecanismos de reproducción sexual y asexual.",
      "Describir la meiosis y su importancia en la variabilidad genética.",
      "Aplicar las leyes de Mendel para predecir características hereditarias.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "CN-8B-U2", asignaturaId: "ciencias", grado: "8B", nivel: "8° básico",
    titulo: "Energía y sus transformaciones",
    objetivos: [
      "Describir las formas de energía y sus transformaciones.",
      "Analizar fuentes de energía renovables y no renovables.",
      "Evaluar el impacto ambiental del uso de diferentes fuentes de energía.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA4", "OA5", "OA6"],
  },
  {
    id: "CN-8B-U3", asignaturaId: "ciencias", grado: "8B", nivel: "8° básico",
    titulo: "Estructura del universo y Sistema Solar",
    objetivos: [
      "Describir la estructura y composición del Sistema Solar.",
      "Explicar los movimientos de la Tierra y sus consecuencias.",
      "Analizar características de los astros y su clasificación.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA7", "OA8", "OA9"],
  },
  {
    id: "CN-8B-U4", asignaturaId: "ciencias", grado: "8B", nivel: "8° básico",
    titulo: "Evolución y origen de la vida",
    objetivos: [
      "Explicar la teoría de la evolución de Darwin y Wallace.",
      "Analizar evidencias de la evolución: registro fósil, anatomía comparada.",
      "Evaluar el origen de la vida y las hipótesis científicas al respecto.",
    ],
    habilidades: ["Analizar y concluir", "Observar y preguntar", "Comunicar"],
    oas: ["OA10", "OA11", "OA12"],
  },

  // ══════════════════════════════════════════════════════════════
  // BIOLOGÍA — 1° a 4° Medio
  // ══════════════════════════════════════════════════════════════
  {
    id: "BIO-1M-U1", asignaturaId: "biologia", grado: "1M", nivel: "1° medio",
    titulo: "Biología celular y molecular",
    objetivos: [
      "Describir la estructura y función de las macromoléculas biológicas.",
      "Explicar los procesos de síntesis de proteínas: transcripción y traducción.",
      "Analizar el rol del ADN en la herencia y la variabilidad genética.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Modelar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "BIO-1M-U2", asignaturaId: "biologia", grado: "1M", nivel: "1° medio",
    titulo: "Metabolismo celular",
    objetivos: [
      "Explicar la fotosíntesis como proceso de conversión de energía.",
      "Describir la respiración celular aeróbica y anaeróbica.",
      "Relacionar metabolismo con la salud y la nutrición.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Comunicar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "BIO-1M-U3", asignaturaId: "biologia", grado: "1M", nivel: "1° medio",
    titulo: "Sistema nervioso e inmune",
    objetivos: [
      "Describir la organización y función del sistema nervioso.",
      "Explicar los mecanismos de defensa del sistema inmune.",
      "Analizar enfermedades asociadas al sistema nervioso e inmune.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "BIO-1M-U4", asignaturaId: "biologia", grado: "1M", nivel: "1° medio",
    titulo: "Ecología y sustentabilidad",
    objetivos: [
      "Analizar las relaciones entre organismos y su ambiente.",
      "Evaluar el impacto del cambio climático en los ecosistemas.",
      "Proponer acciones para la conservación de la biodiversidad.",
    ],
    habilidades: ["Analizar y concluir", "Comunicar", "Pensamiento crítico"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "BIO-2M-U1", asignaturaId: "biologia", grado: "2M", nivel: "2° medio",
    titulo: "Genética y biotecnología",
    objetivos: [
      "Explicar las bases moleculares de la herencia genética.",
      "Analizar las técnicas de biotecnología y sus aplicaciones.",
      "Evaluar implicancias éticas de la ingeniería genética.",
    ],
    habilidades: ["Analizar y concluir", "Pensamiento crítico", "Comunicar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "BIO-2M-U2", asignaturaId: "biologia", grado: "2M", nivel: "2° medio",
    titulo: "Evolución y biodiversidad",
    objetivos: [
      "Explicar los mecanismos evolutivos: selección natural, deriva genética.",
      "Analizar la especiación y el origen de la biodiversidad.",
      "Evaluar la evidencia científica de la evolución.",
    ],
    habilidades: ["Analizar y concluir", "Observar y preguntar", "Comunicar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "BIO-2M-U3", asignaturaId: "biologia", grado: "2M", nivel: "2° medio",
    titulo: "Fisiología humana",
    objetivos: [
      "Describir la homeostasis y los sistemas reguladores del cuerpo.",
      "Analizar el funcionamiento de sistemas endocrino y reproductor.",
      "Relacionar hábitos de vida con la salud y bienestar.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "BIO-2M-U4", asignaturaId: "biologia", grado: "2M", nivel: "2° medio",
    titulo: "Neurociencias y comportamiento",
    objetivos: [
      "Explicar las bases neurológicas del comportamiento y las emociones.",
      "Analizar el efecto de sustancias sobre el sistema nervioso.",
      "Evaluar estrategias para el cuidado de la salud mental.",
    ],
    habilidades: ["Analizar y concluir", "Pensamiento crítico", "Comunicar"],
    oas: ["OA8", "OA9"],
  },

  // ══════════════════════════════════════════════════════════════
  // FÍSICA — 1° a 4° Medio
  // ══════════════════════════════════════════════════════════════
  {
    id: "FIS-1M-U1", asignaturaId: "fisica", grado: "1M", nivel: "1° medio",
    titulo: "Mecánica clásica",
    objetivos: [
      "Aplicar las leyes de Newton para analizar el movimiento de objetos.",
      "Resolver problemas de cinemática usando ecuaciones de movimiento.",
      "Analizar la dinámica de sistemas con fuerzas múltiples.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Modelar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "FIS-1M-U2", asignaturaId: "fisica", grado: "1M", nivel: "1° medio",
    titulo: "Trabajo, energía y potencia",
    objetivos: [
      "Calcular trabajo, energía cinética y potencial en sistemas físicos.",
      "Aplicar el principio de conservación de la energía.",
      "Analizar máquinas simples y su eficiencia.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Modelar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "FIS-1M-U3", asignaturaId: "fisica", grado: "1M", nivel: "1° medio",
    titulo: "Ondas y sonido",
    objetivos: [
      "Describir las propiedades de las ondas mecánicas.",
      "Explicar el fenómeno del sonido y sus características.",
      "Analizar aplicaciones tecnológicas basadas en ondas.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Comunicar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "FIS-1M-U4", asignaturaId: "fisica", grado: "1M", nivel: "1° medio",
    titulo: "Calor y termodinámica",
    objetivos: [
      "Distinguir temperatura, calor y energía interna.",
      "Aplicar las leyes de la termodinámica en contextos cotidianos.",
      "Analizar procesos de transferencia de calor.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Modelar"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "FIS-2M-U1", asignaturaId: "fisica", grado: "2M", nivel: "2° medio",
    titulo: "Electricidad y magnetismo",
    objetivos: [
      "Explicar los fundamentos de la electricidad estática y corriente.",
      "Analizar circuitos eléctricos usando las leyes de Ohm y Kirchhoff.",
      "Describir el electromagnetismo y sus aplicaciones tecnológicas.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Modelar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "FIS-2M-U2", asignaturaId: "fisica", grado: "2M", nivel: "2° medio",
    titulo: "Ondas electromagnéticas y óptica",
    objetivos: [
      "Describir el espectro electromagnético y sus aplicaciones.",
      "Analizar los fenómenos de reflexión, refracción y difracción.",
      "Explicar el funcionamiento de instrumentos ópticos.",
    ],
    habilidades: ["Observar y preguntar", "Experimentar", "Comunicar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "FIS-2M-U3", asignaturaId: "fisica", grado: "2M", nivel: "2° medio",
    titulo: "Física nuclear y partículas",
    objetivos: [
      "Describir la estructura del átomo y el núcleo atómico.",
      "Explicar la radiactividad y sus tipos.",
      "Analizar aplicaciones y riesgos de la energía nuclear.",
    ],
    habilidades: ["Analizar y concluir", "Pensamiento crítico", "Comunicar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "FIS-2M-U4", asignaturaId: "fisica", grado: "2M", nivel: "2° medio",
    titulo: "Relatividad y física moderna",
    objetivos: [
      "Comprender los postulados de la relatividad especial.",
      "Analizar implicancias de E=mc² en fenómenos naturales y tecnológicos.",
      "Describir avances de la física cuántica y su impacto.",
    ],
    habilidades: ["Analizar y concluir", "Pensamiento crítico", "Comunicar"],
    oas: ["OA8", "OA9"],
  },

  // ══════════════════════════════════════════════════════════════
  // QUÍMICA — 1° a 4° Medio
  // ══════════════════════════════════════════════════════════════
  {
    id: "QUI-1M-U1", asignaturaId: "quimica", grado: "1M", nivel: "1° medio",
    titulo: "Estructura atómica y tabla periódica",
    objetivos: [
      "Describir los modelos atómicos y la estructura del átomo.",
      "Interpretar la tabla periódica y las tendencias periódicas.",
      "Explicar la formación de enlaces químicos iónicos y covalentes.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Modelar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "QUI-1M-U2", asignaturaId: "quimica", grado: "1M", nivel: "1° medio",
    titulo: "Reacciones químicas",
    objetivos: [
      "Balancear ecuaciones químicas aplicando la ley de conservación de masa.",
      "Clasificar reacciones químicas según sus características.",
      "Analizar factores que afectan la velocidad de reacción.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Modelar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "QUI-1M-U3", asignaturaId: "quimica", grado: "1M", nivel: "1° medio",
    titulo: "Soluciones y estequiometría",
    objetivos: [
      "Calcular concentraciones de soluciones en distintas unidades.",
      "Aplicar relaciones estequiométricas en cálculos cuantitativos.",
      "Resolver problemas de rendimiento y pureza en reacciones.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Modelar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "QUI-1M-U4", asignaturaId: "quimica", grado: "1M", nivel: "1° medio",
    titulo: "Termoquímica y energía",
    objetivos: [
      "Explicar el concepto de entalpía y calor de reacción.",
      "Aplicar la ley de Hess para calcular entalpías.",
      "Analizar procesos endotérmicos y exotérmicos en contextos reales.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Comunicar"],
    oas: ["OA8", "OA9"],
  },

  {
    id: "QUI-2M-U1", asignaturaId: "quimica", grado: "2M", nivel: "2° medio",
    titulo: "Química orgánica",
    objetivos: [
      "Clasificar y nombrar compuestos orgánicos según grupos funcionales.",
      "Describir propiedades y reacciones características de hidrocarburos.",
      "Analizar aplicaciones de compuestos orgánicos en la vida cotidiana.",
    ],
    habilidades: ["Observar y preguntar", "Analizar y concluir", "Comunicar"],
    oas: ["OA1", "OA2", "OA3"],
  },
  {
    id: "QUI-2M-U2", asignaturaId: "quimica", grado: "2M", nivel: "2° medio",
    titulo: "Equilibrio químico",
    objetivos: [
      "Explicar el concepto de equilibrio químico dinámico.",
      "Aplicar el principio de Le Chatelier para predecir cambios en el equilibrio.",
      "Calcular constantes de equilibrio Kc y Kp.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Modelar"],
    oas: ["OA4", "OA5"],
  },
  {
    id: "QUI-2M-U3", asignaturaId: "quimica", grado: "2M", nivel: "2° medio",
    titulo: "Ácidos, bases y pH",
    objetivos: [
      "Aplicar las teorías de Arrhenius y Brønsted-Lowry a ácidos y bases.",
      "Calcular pH, pOH y concentración de soluciones ácidas y básicas.",
      "Analizar reacciones de neutralización y titulaciones.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Modelar"],
    oas: ["OA6", "OA7"],
  },
  {
    id: "QUI-2M-U4", asignaturaId: "quimica", grado: "2M", nivel: "2° medio",
    titulo: "Electroquímica",
    objetivos: [
      "Explicar procesos de oxidación-reducción y número de oxidación.",
      "Analizar pilas galvánicas y celdas electrolíticas.",
      "Evaluar aplicaciones tecnológicas de la electroquímica.",
    ],
    habilidades: ["Experimentar", "Analizar y concluir", "Comunicar"],
    oas: ["OA8", "OA9"],
  },
];

// ── Función principal de carga ──────────────────────────────────────────────
async function seedCurriculo() {
  console.log(`\n🌱 Iniciando seed de currículo MINEDUC...`);
  console.log(`📦 Total de unidades a cargar: ${CURRICULO.length}\n`);

  const batch_size = 400; // Firestore permite 500 ops por batch
  let total = 0;
  let errores = 0;

  for (let i = 0; i < CURRICULO.length; i += batch_size) {
    const chunk = CURRICULO.slice(i, i + batch_size);
    const batch = db.batch();

    for (const item of chunk) {
      const { id, ...data } = item;
      const ref = db.collection("curriculo").doc(id);
      batch.set(ref, {
        ...data,
        actitudes: [],
        oaClaves: data.oas || [],
        horasSugeridas: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: false }); // merge: false reemplaza completamente
      total++;
    }

    await batch.commit();
    console.log(`✅ Batch ${Math.floor(i / batch_size) + 1}: ${chunk.length} documentos guardados`);
  }

  console.log(`\n🎉 Seed completado: ${total} unidades cargadas, ${errores} errores`);
  console.log(`\nAsignaturas cargadas:`);
  const asigs = [...new Set(CURRICULO.map(c => c.asignaturaId))];
  asigs.forEach(a => {
    const count = CURRICULO.filter(c => c.asignaturaId === a).length;
    console.log(`  • ${a}: ${count} unidades`);
  });

  process.exit(0);
}

seedCurriculo().catch(err => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});