// NeuroAgenda Backend — Node.js + Express + Google Gemini
// Deploy gratuito en Railway.app o Render.com

const express = require("express");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10kb" }));

// ── Validar API Key de Gemini ─────────────────────────────
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.warn("⚠️  GEMINI_API_KEY no configurada en variables de entorno");
}

// ── Ruta principal: proxy a Gemini ────────────────────────
// La app envía: { messages: [...], system: "..." }
// El backend reenvía a Gemini y devuelve el texto
app.post("/ai", async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages requerido" });
    }

    // Construir el historial para Gemini
    const geminiContents = [];

    // Agregar system prompt como primer mensaje de usuario si existe
    if (system) {
      geminiContents.push({
        role: "user",
        parts: [{ text: `[Instrucciones del sistema]: ${system}` }],
      });
      geminiContents.push({
        role: "model",
        parts: [{ text: "Entendido, seguiré esas instrucciones." }],
      });
    }

    // Convertir mensajes al formato de Gemini
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Llamar a Gemini 2.0 Flash (rápido y gratuito)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, errBody);
      return res.status(502).json({ error: `Gemini error ${geminiRes.status}` });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return res.json({ text });

  } catch (err) {
    console.error("Error interno:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Health check ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "NeuroAgenda Backend",
    version: "1.0.0",
    model: "gemini-2.0-flash",
  });
});

// ── Iniciar servidor ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ NeuroAgenda backend corriendo en puerto ${PORT}`);
});
