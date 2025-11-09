// src/services/emergencyService.js

// Suscripción “dummy” para que no rompa: devuelve un objeto con unsubscribe()
export function subscribeEmergency(callback) {
  // Si más adelante quieres emitir eventos, guarda el callback y llámalo.
  const intervalId = null; // placeholder (no hacemos nada aún)

  return {
    unsubscribe() {
      if (intervalId) clearInterval(intervalId);
    },
  };
}

// Si en DesarrolloClase.jsx piensas usar un “push” manual, expón también un emisor simple:
let _listeners = [];
export function emitEmergency(payload) {
  for (const fn of _listeners) {
    try { fn(payload); } catch {}
  }
}
export function onEmergency(callback) {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter(fn => fn !== callback);
  };
}
