const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());

// 👇 cambia .js → .cjs
app.get("/api/mineduc", require("../api/mineduc.cjs"));

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log("[API] up on", PORT));

