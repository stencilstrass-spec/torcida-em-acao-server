process.on("uncaughtException", function(err) {
  console.error("Uncaught Exception: " + err.message);
});

process.on("unhandledRejection", function(err) {
  console.error("Unhandled Rejection: " + err);
});

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

var GIFT_MAP = {
  "rose":                 { teamId: "fla", points: 1 },
  "rosa":                 { teamId: "fla", points: 1 },
  "gg":                   { teamId: "pal", points: 1 },
  "tiktok":               { teamId: "cor", points: 1 },
  "love you so much":     { teamId: "sao", points: 1 },
  "te amo tanto":         { teamId: "sao", points: 1 },
  "ice cream cone":       { teamId: "flu", points: 1 },
  "casquinha de sorvete": { teamId: "flu", points: 1 },
  "glow stick":           { teamId: "bot", points: 1 },
  "oldies":               { teamId: "vas", points: 1 },
  "pop":                  { teamId: "gre", points: 1 },
  "freestyle":            { teamId: "int", points: 1 },
  "cake slice":           { teamId: "atl", points: 1 },
  "fatia de bolo":        { teamId: "atl", points: 1 },
  "white rose":           { teamId: "cru", points: 1 },
  "rosa branca":          { teamId: "cru", points: 1 },
  "you're awesome":       { teamId: "san", points: 1 },
  "voce e incrivel":      { teamId: "san", points: 1 },
};

let tiktokConnection = null;
let tiktokConnected = false;
let tiktokUsername = "";

io.on("connection", function(socket) {
  console.log("Cliente conectado: " + socket.id);

  socket.emit("status", {
    connected: tiktokConnected,
    username: tiktokUsername,
  });

  socket.on("connect-tiktok", async function(username) {
    console.log("Tentando conectar ao TikTok: @" + username);

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
      console.log("Conectado ao TikTok: @" + username);
      io.emit("tiktok-connected", username);

      tiktokConnection.on("gift", function(data) {
        try {
          if (data.giftType === 1 && !data.repeatEnd) return;

          var giftName = data.giftName || "";
          var giftLower = giftName.toLowerCase().trim();
          var mapping = GIFT_MAP[giftLower];
          var repeatCount = data.repeatCount || 1;

          var giftData = {
            uniqueId: data.uniqueId || "",
            username: data.nickname || data.uniqueId || "Anonimo",
            profilePicture: data.profilePictureUrl || "",
            giftName: giftName,
            giftPictureUrl: data.giftPictureUrl || "",
            repeatCount: repeatCount,
            teamId: mapping ? mapping.teamId : null,
            points: mapping ? mapping.points * repeatCount : 0,
          };

          console.log(
            "Gift: " + giftName + " x" + repeatCount + " -> " +
            (mapping ? mapping.teamId + " (+" + giftData.points + "pts)" : "NAO MAPEADO") +
            " de " + giftData.username
          );

          io.emit("gift", giftData);
        } catch (err) {
          console.error("Erro ao processar gift: " + err.message);
        }
      });

      tiktokConnection.on("chat", function(data) {
        io.emit("chat", {
          uniqueId: data.uniqueId,
          comment: data.comment,
          profilePicture: data.profilePictureUrl,
        });
      });

      tiktokConnection.on("member", function(data) {
        io.emit("member", {
          uniqueId: data.uniqueId,
          profilePicture: data.profilePictureUrl,
        });
      });

      tiktokConnection.on("roomUser", function(data) {
        io.emit("viewer-count", data.viewerCount);
      });

      tiktokConnection.on("disconnected", function() {
        console.log("TikTok desconectado");
        tiktokConnected = false;
        tiktokUsername = "";
        io.emit("tiktok-disconnected");
      });

    } catch (err) {
      console.error("Erro ao conectar TikTok: " + err.message);
      tiktokConnected = false;
      io.emit("tiktok-error", err.message);
    }
  });

  socket.on("disconnect-tiktok", function() {
    if (tiktokConnection) {
      try { tiktokConnection.disconnect(); } catch (_) {}
      tiktokConnection = null;
      tiktokConnected = false;
      tiktokUsername = "";
      io.emit("tiktok-disconnected");
      console.log("TikTok desconectado manualmente");
    }
  });

  socket.on("disconnect", function() {
    console.log("Cliente desconectado: " + socket.id);
  });
});

app.get("/", function(req, res) {
  res.json({
    name: "Torcida em Acao - TikTok Server",
    status: "running",
    tiktok: { connected: tiktokConnected, username: tiktokUsername },
  });
});

app.get("/status", function(req, res) {
  res.json({ connected: tiktokConnected, username: tiktokUsername });
});

app.get("/gift-map", function(req, res) {
  res.json(GIFT_MAP);
});

server.listen(PORT, function() {
  console.log("Torcida em Acao Server rodando na porta " + PORT);
});
