/**
 * cleanup-usuarios.cjs
 * Borra TODOS los usuarios de Firebase Auth y sus datos en Firestore.
 *
 * Uso:
 *   node tools-seed/cleanup-usuarios.cjs
 *
 * ⚠️ IRREVERSIBLE — haz un backup antes si necesitas conservar algo.
 */

const admin = require("firebase-admin");
const path = require("path");
const readline = require("readline");

const serviceAccount = require(path.join(__dirname, "../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const authAdmin = admin.auth();

// Colecciones que tienen documentos por UID
const COLECCIONES_POR_UID = [
  "usuarios",
  "users",
  "profesores",
  "clases_detalle",  // subcolección — se borra con el doc padre
  "horarios",
];

// Colecciones que NO se tocan (datos globales del sistema)
// curriculo, planificaciones_catalogo, habilidades_catalogo, etc.

async function confirmar(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pregunta, (resp) => { rl.close(); resolve(resp.trim().toLowerCase()); });
  });
}

async function borrarSubcolecciones(docRef) {
  const subcols = await docRef.listCollections();
  for (const subcol of subcols) {
    const snap = await subcol.get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
}

async function borrarColeccion(colNombre, uids) {
  let borrados = 0;
  for (const uid of uids) {
    try {
      const ref = db.collection(colNombre).doc(uid);
      const snap = await ref.get();
      if (snap.exists) {
        await borrarSubcolecciones(ref);
        await ref.delete();
        borrados++;
      }
    } catch (e) {
      console.warn(`  ⚠️ No se pudo borrar ${colNombre}/${uid}:`, e.message);
    }
  }
  return borrados;
}

async function main() {
  console.log("\n🔥 LIMPIEZA DE USUARIOS — PragmaProfe\n");
  console.log("Este script borrará:");
  console.log("  • Todos los usuarios de Firebase Authentication");
  console.log("  • Sus documentos en: usuarios/, users/, profesores/, clases_detalle/, horarios/");
  console.log("\n⚠️  Esta acción es IRREVERSIBLE.\n");

  const resp = await confirmar('Escribe "BORRAR TODO" para confirmar: ');
  if (resp !== "borrar todo") {
    console.log("\n❌ Cancelado. No se borró nada.\n");
    process.exit(0);
  }

  // 1. Obtener todos los UIDs de Authentication
  console.log("\n📋 Obteniendo lista de usuarios...");
  const uids = [];
  let pageToken;
  do {
    const result = await authAdmin.listUsers(1000, pageToken);
    result.users.forEach((u) => uids.push(u.uid));
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`   → ${uids.length} usuarios encontrados`);

  if (uids.length === 0) {
    console.log("\n✅ No hay usuarios que borrar.\n");
    process.exit(0);
  }

  // 2. Borrar datos en Firestore
  console.log("\n🗑️  Borrando datos en Firestore...");
  for (const col of COLECCIONES_POR_UID) {
    const n = await borrarColeccion(col, uids);
    console.log(`   ✅ ${col}: ${n} documentos borrados`);
  }

  // 3. Borrar usuarios de Authentication en lotes de 100
  console.log("\n🔐 Borrando usuarios de Authentication...");
  let authBorrados = 0;
  for (let i = 0; i < uids.length; i += 100) {
    const chunk = uids.slice(i, i + 100);
    const result = await authAdmin.deleteUsers(chunk);
    authBorrados += result.successCount;
    if (result.failureCount > 0) {
      console.warn(`   ⚠️ ${result.failureCount} usuarios no se pudieron borrar`);
    }
  }
  console.log(`   ✅ ${authBorrados} usuarios eliminados de Authentication`);

  console.log("\n🎉 Limpieza completada. La plataforma está lista para usuarios reales.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
