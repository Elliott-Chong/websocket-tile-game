const http = require("http");
const app = require("express")();
app.listen(8081, () => console.log("listeining on httpport 8081"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

const websocketServer = require("websocket").server;
const httpServer = http.createServer();

httpServer.listen(8080, () => console.log("listening on port 8080"));

// hashmap of clients
const clients = {};
const games = {};

const wsServer = new websocketServer({
  httpServer: httpServer,
});

wsServer.on("request", (request) => {
  // connect
  const connection = request.accept(null, request.origin);
  connection.on("open", () => {
    console.log("opened!");
  });

  connection.on("closed", () => {
    console.log("closed");
  });

  connection.on("message", (message) => {
    // received message from client
    const result = JSON.parse(message.utf8Data);

    if (result.method === "create") {
      const clientId = result.clientId;
      const gameId = guid();

      games[gameId] = {
        id: gameId,
        balls: 20,
        clients: [],
      };

      const payload = {
        method: "create",
        game: games[gameId],
        clientId,
      };

      clients[clientId].connection.send(JSON.stringify(payload));
    }

    if (result.method === "join") {
      const { clientId, gameId } = result;
      const game = games[gameId];
      if (game.clients.length >= 3) {
        // max clients reach
        return;
      }

      const color = ["red", "green", "blue"][game.clients.length];
      game.clients.push({
        clientId,
        color,
      });
      if (game.clients.length === 3) updateGameState();
      const payload = {
        method: "join",
        game,
      };
      game.clients.forEach((c) => {
        clients[c.clientId].connection.send(JSON.stringify(payload));
      });
    }

    // user plays
    if (result.method === "play") {
      const { gameId, ballId, color } = result;
      games[gameId].state = {};
      games[gameId].state[ballId] = color;
    }
  });

  // generate a new client id
  const clientId = guid();

  clients[clientId] = {
    connection,
  };

  const payload = {
    method: "connect",
    clientId,
  };

  connection.send(JSON.stringify(payload));
});

const updateGameState = () => {
  for (let g in games) {
    const game = games[g];
    const payload = {
      method: "update",
      game,
    };
    for (let c of game.clients) {
      clients[c.clientId].connection.send(JSON.stringify(payload));
    }
  }
  setTimeout(updateGameState, 100);
};

function guid() {
  // Public Domain/MIT
  var d = new Date().getTime(); //Timestamp
  var d2 =
    (typeof performance !== "undefined" &&
      performance.now &&
      performance.now() * 1000) ||
    0; //Time in microseconds since page-load or 0 if unsupported
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16; //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      //Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
