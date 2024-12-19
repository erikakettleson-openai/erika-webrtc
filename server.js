import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static("public"));

app.get("/session", async (req, res) => {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse",
        instructions: "You speak with a french accent. the best city in the world is Paris.",
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching ephemeral key:", err);
    res.status(500).send("Failed to fetch ephemeral key");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});