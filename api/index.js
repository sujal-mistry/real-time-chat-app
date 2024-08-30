const path = require("path");
const express = require("express");
const { createServer } = require("http");
// const { Server } = require("socket.io");
var cors = require("cors");
const {
  generateMessage,
  generateLocationMessage,
} = require("../utils/message.js");
const { isRealString } = require("../utils/validation.js");
const { Users } = require("../utils/users.js");
const publicPath = path.join(__dirname, "../public");
const PORT = process.env.PORT || 4000;
const host = "localhost";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:3000/chat/s/React%20JS",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type", "*"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // Ensures both transports are supported
});

app.use(express.static(publicPath));

// var io = socketIO(server);
var users = new Users();

app.get("/", (req, res) => {
  res.send("Hey this is my API running 🥳");
});

io.on("connection", (socket) => {
  console.log("Connected!");
  socket.on("leave", (params) => {
    socket.leave(params.room);
  });

  socket.on("join", (params, callback) => {
    if (!isRealString(params.name) || !isRealString(params.room)) {
      return callback("Bad request");
    }

    socket.join(params.room);
    users.removeUser(socket.id);
    users.addUser(socket.id, params.name, params.room);

    io.to(params.room).emit("updateUserList", users.getUserList(params.room));
    socket.emit(
      "newMessage",
      generateMessage("Admin", params.room, "Welcome to the chat app.")
    );
    socket.broadcast
      .to(params.room)
      .emit(
        "newMessage",
        generateMessage("Admin", params.room, `${params.name} has joined.`)
      );

    callback();
  });

  socket.on("createMessage", (message, callback) => {
    var user = users.getUser(socket.id);
    if (user && isRealString(message.text)) {
      let tempObj = generateMessage(user.name, user.room, message.text);
      io.to(user.room).emit("newMessage", tempObj);
      callback({
        data: tempObj,
      });
    }
    callback();
  });

  socket.on("createLocationMsg", (coords) => {
    var user = users.getUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "createLocationMsg",
        generateLocationMessage(user.name, user.room, coords.lat, coords.lon)
      );
    }
  });

  socket.on("disconnect", () => {
    var user = users.removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("updateUserList", users.getUserList(user.room));
      io.to(user.room).emit(
        "newMessage",
        generateMessage("Admin", user.room, `${user.name} has left.`)
      );
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Running on http://${host}:${PORT}`);
});
