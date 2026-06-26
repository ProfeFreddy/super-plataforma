// server/firebaseAdmin.cjs
const admin = require("firebase-admin");

function must(name) {
    const v = process.env[name];
    if (!v) throw new Error(`[firebaseAdmin] Falta env ${name}`);
    return v;
}

const projectId = must("FB_PROJECT_ID");
const clientEmail = must("FB_CLIENT_EMAIL");
const privateKey = must("FB_PRIVATE_KEY").replace(/\\n/g, "\n");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

const db = admin.firestore();

module.exports = { admin, db };
