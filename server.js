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
  processInitialData: false,
  enableExtendedGiftInfo: false,
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
