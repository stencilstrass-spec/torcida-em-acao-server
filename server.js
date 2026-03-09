const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 3001;

let tiktokConnection = null;
let tiktokConnected = false;
let tiktokUsername = "";

const GIFT_MAP = {
  "rosa":         { teamId: "fla", points: 1 },
  "leão":         { teamId: "fla", points: 10 },
  "gg":           { teamId: "pal", points: 1 },
  "diamante":     { teamId: "pal", points: 10 },
  "dedo de coração": { teamId: "cor", points: 1 },
  "coroa":        { teamId: "cor", points: 10 },
  "rosinha":      { teamId: "sao", points: 1 },
  "futebol":      { teamId: "sao", points: 10 },
  "café":         { teamId: "flu", points: 1 },
  "golfinho":     { teamId: "flu", points: 10 },
  "chama":        { teamId: "bot", points: 1 },
  "raio":         { teamId: "bot", points: 10 },
  "nota musical": { teamId: "vas", points: 1 },
  "foguete":      { teamId: "vas", points: 10 },
  "trevo":        { teamId: "gre", points: 1 },
  "unicórnio":    { teamId: "gre", points: 10 },
  "balão":        { teamId: "int", points: 1 },
  "guitarra":     { teamId: "int", points: 10 },
  "biscoito da sorte": { teamId: "atl", points: 1 },
  "dragão":       { teamId: "atl", points: 10 },
  "gato dançante":     { teamId: "bah", points: 5 },
  "presente surpresa": { teamId: "bah", points: 15 },
  "bolo":         { teamId: "cru", points: 1 },
  "estrela cadente": { teamId: "cru", points: 10 },
  "panda":        { teamId: "san", points: 1 },
  "alvo":         { teamId: "san", points: 10 },
  "diva":         { teamId: "vit", points: 5 },
  "águia dourada": { teamId: "vit", points: 15 },
  "coração brilhante": { teamId: "cap", points: 5 },
  "circo mágico":      { teamId: "cap", points: 15 },
  "ursinho":      { teamId: "ctb", points: 5 },
  "lobo":         { teamId: "ctb", points: 15 },
};

io.on("connection", (socket) => {
  console.log("🔌 Cliente conectado:", socket.id);

  socket.emit("status", {
    connected: tiktokConnected,
    username: tiktokUsername,
  });

  socket.on("connect-tiktok", async (username) => {
    console.log(`🎵 Tentando conectar ao TikTok: @${username}`);

    if (tiktokConnection) {
      try { tiktokConnection.disconnect(); } catch (_) {}
      tiktokConnection = null;
      tiktokConnected = false;
      tiktokUsername = "";
    }

    try {
      tiktokConnection = new WebcastPushConnection(username, {
        enableExtendedGiftInfo: true,
      });

      await tiktokConnection.connect();
      tiktokConnected = true;
      tiktokUsername = username;
      console.log(`✅ Conectado ao TikTok: @${username}`);
      io.emit("tiktok-connected", username);

      tiktokConnection.on("gift", (data) => {
        const giftName = data.giftName || "";
        const giftLower = giftName.toLowerCase().trim();
        const mapping = GIFT_MAP[giftLower];

        const giftPictureUrl =
          data.giftPictureUrl ||
          data.gift?.picture?.urlList?.[0] ||
          "";

        const giftData = {
          uniqueId: data.uniqueId || "",
          username: data.nickname || data.uniqueId || "Anônimo",
          profilePicture:
            data.profilePictureUrl ||
            `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.uniqueId}`,
          giftName: giftName,
          giftPictureUrl: giftPictureUrl,
          repeatCount: data.repeatCount || 1,
          diamondCount: data.diamondCount || 0,
          teamId: mapping ? mapping.teamId : null,
          points: mapping ? mapping.points : 0,
        };

        console.log(
          `🎁 Presente: "${giftName}" → ${
            mapping
              ? `Time ${mapping.teamId} (+${mapping.points}pts)`
              : "NÃO MAPEADO"
          } | User: ${giftData.username}`
        );

        io.emit("gift", giftData);
      });

      tiktokConnection.on("chat", (data) => {
        io.emit("chat", {
          uniqueId: data.uniqueId,
          comment: data.comment,
          profilePicture: data.profilePictureUrl,
        });
      });

      tiktokConnection.on("member", (data) => {
        io.emit("member", {
          uniqueId: data.uniqueId,
          profilePicture: data.profilePictureUrl,
        });
      });

      tiktokConnection.on("roomUser", (data) => {
        io.emit("viewer-count", data.viewerCount);
      });

      tiktokConnection.on("disconnected", () => {
        console.log("❌ TikTok desconectado");
        tiktokConnected = false;
        tiktokUsername = "";
        io.emit("tiktok-disconnected");
      });
    } catch (error) {
      console.error("❌ Erro ao conectar TikTok:", error.message);
      tiktokConnected = false;
      io.emit("tiktok-error", error.message);
    }
  });

  socket.on("disconnect-tiktok", () => {
    if (tiktokConnection) {
      try { tiktokConnection.disconnect(); } catch (_) {}
      tiktokConnection = null;
      tiktokConnected = false;
      tiktokUsername = "";
      io.emit("tiktok-disconnected");
      console.log("🔌 TikTok desconectado manualmente");
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Cliente desconectado:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "Torcida em Ação — TikTok Server",
    status: "running",
    tiktok: { connected: tiktokConnected, username: tiktokUsername },
  });
});

app.get("/status", (req, res) => {
  res.json({ connected: tiktokConnected, username: tiktokUsername });
});

app.get("/gift-map", (req, res) => {
  res.json(GIFT_MAP);
});

server.listen(PORT, () => {
  console.log(`⚽ Torcida em Ação Server rodando na porta ${PORT}`);
});
