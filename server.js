const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let tiktok = null;
let connected = false;
let currentUsername = "";

const GIFT_MAP = {
  "rose":           { teamId: "fla", points: 1 },
  "gg":             { teamId: "pal", points: 1 },
  "tiktok":         { teamId: "cor", points: 1 },
  "football love":  { teamId: "sao", points: 1 },
  "ice cream cone": { teamId: "flu", points: 1 },
  "glow stick":     { teamId: "bot", points: 1 },
  "oldies":         { teamId: "vas", points: 1 },
  "pop":            { teamId: "gre", points: 1 },
  "freestyle":      { teamId: "int", points: 1 },
  "cake slice":     { teamId: "atl", points: 1 },
  "white rose":     { teamId: "cru", points: 1 },
  "you're awesome": { teamId: "san", points: 1 },
};

app.get("/", (req, res) => {
  res.json({
    name: "Torcida em Ação — TikTok Server",
    status: "running",
    tiktok: { connected, username: currentUsername },
  });
});

app.get("/status", (req, res) => {
  res.json({ connected, username: currentUsername });
});

app.get("/gift-map", (req, res) => {
  res.json(GIFT_MAP);
});

io.on("connection", (socket) => {
  console.log("Overlay conectado");

  if (connected && currentUsername) {
    socket.emit("tiktok-connected", currentUsername);
  }

  socket.on("connect-tiktok", async (username) => {
    if (connected && currentUsername === username) {
      socket.emit("tiktok-connected", username);
      return;
    }

    if (connected && tiktok) {
      tiktok.disconnect();
      tiktok = null;
      connected = false;
    }

    console.log("Conectando ao TikTok:", username);
    tiktok = new WebcastPushConnection(username);

    try {
      await tiktok.connect();
      connected = true;
      currentUsername = username;
      console.log("✅ Conectado à live de", username);
      io.emit("tiktok-connected", username);

      tiktok.on("gift", (data) => {
        if (data.giftType === 1 && !data.repeatEnd) return;

        const giftName = data.giftName || "";
        const giftLower = giftName.toLowerCase().trim();
        const mapping = GIFT_MAP[giftLower];

        const giftData = {
          uniqueId: data.uniqueId || "",
          username: data.nickname || data.uniqueId || "Anônimo",
          profilePicture: data.profilePictureUrl ||
            `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.uniqueId}`,
          giftName: giftName,
          giftPictureUrl: data.giftPictureUrl || "",
          repeatCount: data.repeatCount || 1,
          diamondCount: data.diamondCount || 0,
          teamId: mapping ? mapping.teamId : null,
          points: mapping ? mapping.points : 0,
        };

        console.log(
          `🎁 Gift: "${giftName}" → ${
            mapping ? `${mapping.teamId} (+${mapping.points}pts)` : "NÃO MAPEADO"
          } de ${giftData.username}`
        );

        io.emit("gift", giftData);
      });

      tiktok.on("disconnected", () => {
        console.log("❌ Live desconectada");
        connected = false;
        currentUsername = "";
        tiktok = null;
        io.emit("tiktok-error", "Live desconectada");
      });

    } catch (err) {
      console.log("❌ Erro ao conectar:", err.message);
      connected = false;
      currentUsername = "";
      tiktok = null;
      socket.emit("tiktok-error", err.message || "Erro ao conectar");
    }
  });

  socket.on("disconnect-tiktok", () => {
    if (tiktok) {
      tiktok.disconnect();
      tiktok = null;
      connected = false;
      currentUsername = "";
      io.emit("tiktok-disconnected");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Torcida em Ação Server rodando na porta", PORT);
});
