import express from "express";
import cors from "cors";

const app = express();

/* Middleware */
app.use(cors());
app.use(express.json());

/* Health check */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "meteora-analytics-backend",
    time: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* Fly.io REQUIRED PORT */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
