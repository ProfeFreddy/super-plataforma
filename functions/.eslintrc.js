module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/public/**",
    "**/lib/**",
  ],
  rules: {
    // Quita la exigencia de comentarios JSDoc
    "require-jsdoc": "off",

    // Permite líneas más largas y no molesta con URLs/strings
    "max-len": ["warn", { "code": 120, "ignoreUrls": true, "ignoreStrings": true, "ignoreTemplateLiterals": true }],

    // (Opcional) Si aún se cuela algo del front, desactiva no-undef
    // "no-undef": "off",
  },
};

