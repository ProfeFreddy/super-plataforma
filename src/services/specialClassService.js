// src/services/specialClassService.js

const SPECIAL_CLASS_KEY = "specialClassConfig";

export function setSpecialClassConfig(config) {
  sessionStorage.setItem(SPECIAL_CLASS_KEY, JSON.stringify(config));
}

export function getSpecialClassConfig() {
  const raw = sessionStorage.getItem(SPECIAL_CLASS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSpecialClassConfig() {
  sessionStorage.removeItem(SPECIAL_CLASS_KEY);
}
