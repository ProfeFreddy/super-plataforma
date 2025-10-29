# PragmaProfe · Plataforma didáctica para docentes

**PragmaProfe** (nombre interno “super-plataforma”) es una plataforma web para profesores que:

* acelera la **planificación de clases**,
* activa al estudiante con actividades interactivas,
* evalúa y documenta evidencia de aprendizaje,
* y genera materiales (incluyendo modelos 3D pedagógicos) en minutos — sin depender de diseñadores ni programadores.

> Visión: **darle súperpoderes pedagógicos al profe de aula real**, no al profe ideal del PowerPoint.

---

## 🧑‍🏫 Problema real que resolvemos

Docentes en aula pierden horas cada semana en cosas que NO son enseñar:

* ✅ escribir planificaciones formales alineadas al currículum nacional,
* ✅ preparar actividades interesantes (no solo guías planas),
* ✅ evaluar / registrar evidencia para cumplir con inspectoría / UTP / estándares,
* ✅ justificar cobertura curricular frente a apoderados y dirección.

Esto genera agotamiento, clases repetitivas, estudiantes desconectados y paperileo infinito.

**PragmaProfe reduce esa fricción**: el profe planifica, activa y evalúa dentro de la misma interfaz — en lenguaje humano, no lenguaje burocrático.

---

## ✨ Qué puede hacer hoy

### 1. Panel docente con “clase actual”

* El profe ve rápidamente qué clase está activa ahora mismo.
* Puede iniciar / cerrar la clase, y el sistema guarda evidencia.
* CTA visibles tipo “Probar gratis 7 días” y “Ver planes” (ya preparado para SaaS).

### 2. Planificación en minutos, no horas

* Se generan sesiones alineadas al **currículum oficial del Mineduc (Chile)**.
* Extraemos Objetivos de Aprendizaje (OA), habilidades, contenidos, etc. vía `/mineduc` y los presentamos al docente en lenguaje claro.
* El profe puede ajustar la planificación sin perder la trazabilidad curricular.

### 3. Actividades de participación inmediata

* Juegos rápidos, códigos QR, nubes de palabras, carreras de conceptos.
* Pensado para que el docente proyecte o comparta y los alumnos interactúen de inmediato.
* Está diseñada para funcionar aun si el profe no domina tecnología.

### 4. Evidencia y evaluación

* La clase se cierra con resultados / participación / logros.
* Se genera registro útil para retroalimentación pedagógica y para respaldo formal (UTP, reuniones de apoderados, etc.).

### 5. Generación de recursos 3D educativos (beta)

PragmaProfe puede generar modelos `.glb` a partir de descripciones didácticas del profe, por ejemplo:

> “Necesito una pirámide rectangular hueca con base 3x5 cm y altura 10 cm para geometría de 1° medio”.

Técnicamente:

* El backend ejecuta un script Python (`shape_prompt2glb.py`) usando un entorno virtual local.
* El modelo 3D resultante se sirve dinámicamente vía `/files/...`.
* El profe puede usar ese recurso en clase o enviarlo a los estudiantes.

Esto convierte al profesor en **autor de material interactivo**, no solo consumidor de PDFs.

---

## 🏗 Arquitectura técnica (resumen alto nivel)

### Frontend

* **React + Vite**.
* UI pensada para docente (tono profesional pero cercano, nada de paneles corporativos fríos).
* Se construye y se sirve como estático (build de Vite).
* Se despliega en la carpeta `server/frontend/build` para producción.

### Backend

* **Node.js + Express**.
* Endpoints REST propios:

  * `/api/flow/init`: inicia flujo de pago (suscripción / upgrade).
  * `/mineduc`: proxy inteligente al currículum nacional (para traer OA reales).
  * `/wiki`: proxy liviano a Wikipedia en español (para contenido de apoyo).
  * `/shape/generate`: genera un `.glb` en base a un prompt del docente usando Python.
  * `/health`, `/ping`: endpoints de monitoreo.
* Sirve el frontend de React y también archivos generados (ej. modelos 3D).

### Integraciones clave

1. **Firebase / Google Cloud**

   * Autenticación, analítica, etc.
   * Llaves de servicio y `.env` NO se publican: están protegidas y excluidas del repo.

2. **Flow (procesador de pago chileno)**

   * Preparado para planes pagados / suscripción docente.
   * El servidor Node firma la solicitud de pago localmente usando HMAC SHA-256.
   * También soporta fallback vía Cloud Function (en caso de validación de firma estricta).
   * Endpoint `/api/flow/init` unifica todo eso:

     * Genera `token` de pago.
     * Devuelve URL directa donde el profe puede pagar su plan.
   * Hay hooks para confirmación (`/api/flow/confirm`) y depuración (`/api/flow/debug`).

3. **Mineduc (Currículum Nacional CL)**

   * Endpoint `/mineduc` actúa como “traductor” entre el sitio oficial y el docente.
   * Resultado: el profe no tiene que ir a 4 PDFs diferentes para saber qué OA va hoy.

4. **Generador 3D educativo**

   * Express -> llama Python (vía `child_process.spawn`).
   * Python genera `.glb`.
   * Express expone el `.glb` por HTTP.
   * Pensado para manipulación 3D con herramientas WebGL o visores educativos.

---

## 🔐 Seguridad y manejo de llaves

Este repositorio **NO** incluye:

* `.env`
* llaves privadas Firebase / Google Cloud
* serviceAccountKey.json
* tokens de despliegue
* credenciales de Flow en producción

Se usa `.gitignore` estricto para garantizar que credenciales personales del autor y de instituciones educativas NO entren a GitHub público.

La firma para Flow se construye en el servidor con `crypto.createHmac("sha256", secret)`, y se soportan variantes hex/base64 porque Flow puede exigir formatos distintos según endpoint (`/payment/create` vs `/pagos`).
Esto ya está implementado y probado (modo sandbox).

> Esto refleja un patrón de producción real: **el frontend nunca ve secretos de pago**. Toda negociación ocurre del lado del servidor Node.

---

## 🚀 Estado actual del proyecto

* ✅ Funciona localmente con Node + Vite (flujo docente demo).

* ✅ Llama al currículum oficial y genera planificaciones alineadas.

* ✅ Es capaz de generar material 3D pedagógico bajo demanda.

* ✅ Tiene integración con Flow lista para pruebas de onboarding pagado.

* ✅ UI tipo “landing + dashboard docente” lista para demo comercial / pitch.

* 🔄 En progreso:

  * Pulir flujos para estudiantes dentro de la clase (participación en vivo).
  * Métricas pedagógicas amigables para UTP.
  * “Catálogo de actividades rápidas” por asignatura y nivel.
  * Subida a entornos hosting gestionados (ej. Vercel / Render / Firebase Hosting + Functions).

* 🎯 Futuro:

  * Analítica de cobertura curricular por curso / nivel.
  * Reportes listos para inspección interna / planificaciones UTP.
  * Comunidad docente que comparte actividades reutilizables.

---

## 🧪 Cómo correrlo (entorno local de desarrollo)

> Nota: las llaves (.env, service accounts) son privadas y NO vienen en este repo público. Esto es intencional.
> Si se despliega en otro equipo, cada institución/usuario debe proveer sus propias credenciales.

### 1. Clonar

```bash
git clone https://github.com/ProfeFreddy/super-plataforma.git
cd super-plataforma
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crear un archivo `.env` local (NO se sube a GitHub), con datos como:

```env
PORT=8082
FLOW_API_KEY=...
FLOW_SECRET=...
FLOW_URL=https://sandbox.flow.cl/api
FIREBASE_PROJECT_ID=...
# etc.
```

### 4. Build del frontend

El frontend está hecho con Vite. Para generar la versión productiva del cliente:

```bash
npx vite build
```

Esto genera la carpeta de build del frontend, que el servidor Express sirve como estático.

### 5. Levantar el servidor

```bash
npm start
```

o, en modo desarrollo con recarga, según script configurado:

```bash
npm run dev
```

Después abre en tu navegador:

```text
http://localhost:8082/home
```

---

## 🧑 Autor / contacto

**ProfeFreddy**
Docente, desarrollador, creador de material pedagógico digital.
Enfocado en reducir carga operativa y devolver tiempo real de clase a los profes.

> “Mi meta no es que la tecnología reemplace al profe.
> Mi meta es que la tecnología sea el asistente que el profe siempre pidió y nunca le dieron.”

Para contacto profesional / colaboración:

* Integración con instituciones educativas
* Pilotos en aula real
* EdTech / inversión inicial

(Se puede coordinar por GitHub Issues mientras se habilitan otros canales formales.)

---

## 📌 Resumen ejecutivo (para evaluación rápida)

* Plataforma web enfocada en el PROFESOR como usuario principal.
* Planificación + activación + evaluación en una misma interfaz.
* Alineado al currículum nacional (Mineduc, Chile).
* Generación de recursos interactivos (incluyendo 3D pedagógico).
* Preparada para modelo de suscripción docente con pagos Flow.
* Arquitectura moderna (React/Vite frontend + Node/Express backend + integraciones externas).
* Seguridad: sin llaves ni tokens productivos en el repo público.

**Esto no es una maqueta teórica.
Esto está construido para usarse en sala.**
