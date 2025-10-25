// src/hooks/useAuthX.js
import { useState, useCallback } from "react";
import { auth, db } from "../firebase"; // <-- debe exportar auth y db
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

export function useAuthX() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // --- util: normaliza mensaje de error
  const msg = (e) =>
    String(e?.message || e || "")
      .replace(/^Firebase:\s*/i, "")
      .replace(/\(auth\/.+\)\.?$/i, "")
      .trim();

  // --- util: asegura que exista perfil en Firestore (colección "profesores")
  const ensureProfile = useCallback(async (user, extra = {}) => {
    if (!user?.uid) return;
    const ref = doc(db, "profesores", user.uid);
    const snap = await getDoc(ref);

    const base = {
      uid: user.uid,
      email: user.email ?? "",
      nombre: user.displayName ?? "",
      role: "profesor",
      updatedAt: serverTimestamp(),
      ...extra,
    };

    if (snap.exists()) {
      await setDoc(ref, base, { merge: true });
    } else {
      await setDoc(ref, { ...base, createdAt: serverTimestamp() }, { merge: true });
    }
  }, []);

  // --- Google
  const loginGoogle = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const prov = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, prov);
      await ensureProfile(cred.user); // crea/actualiza perfil
      return cred.user;
    } catch (e) {
      setError(msg(e) || "No se pudo iniciar sesión con Google.");
      throw e;
    } finally { setBusy(false); }
  }, [ensureProfile]);

  /**
   * Email/Password
   * @param {string} email
   * @param {string} pass
   * @param {boolean} createIfNeeded - si true, crea la cuenta
   * @param {string} nombreOpcional - nombre a usar al crear (fallback al prefijo del email)
   */
  const loginEmail = useCallback(
    async (email, pass, createIfNeeded = false, nombreOpcional) => {
      setBusy(true); setError("");
      try {
        if (createIfNeeded) {
          // 1) crear usuario
          const cred = await createUserWithEmailAndPassword(auth, email, pass);

          // 2) asegurar displayName
          const fallbackName = (nombreOpcional?.trim()) || email.split("@")[0];
          if (!cred.user.displayName || cred.user.displayName.trim() === "") {
            await updateProfile(cred.user, { displayName: fallbackName });
          }

          // 3) asegurar perfil en Firestore
          await ensureProfile(cred.user, {
            nombre: cred.user.displayName || fallbackName,
          });

          return cred.user;
        } else {
          // login normal
          const cred = await signInWithEmailAndPassword(auth, email, pass);
          await ensureProfile(cred.user); // por si no existiera perfil
          return cred.user;
        }
      } catch (e) {
        setError(msg(e) || "Error de credenciales.");
        throw e;
      } finally { setBusy(false); }
    },
    [ensureProfile]
  );

  const logout = useCallback(async () => {
    setBusy(true); setError("");
    try {
      await signOut(auth);
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, loginGoogle, loginEmail, logout, auth };
}

