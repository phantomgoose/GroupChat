const express = require("express");
const bodyParser = require("body-parser");
const formParser = bodyParser.urlencoded({ extended: true });
const session = require("express-session");
const app = express();

// A dictionary which keeps track of currently connected and idle users
const USERS = {};

// A linked list containing names and message from chat
const MESSAGES = require("./factories/message_factory.js");

// Server setup
app.use(express.static(__dirname + "/static"));
app.use(session({ secret: "cats" }));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

// Root method. Redirects to the chat page if the user is logged in, otherwise displays the login form.
app.get("/", (req, res) => {
    req.session.is_logged_in ? res.redirect("/chat") : res.render("index");
});

// Chat app method. Redirects the user back to root if they're not logged in, otherwise renders the chat form.
app.get("/chat", (req, res) => {
    req.session.is_logged_in
        ? res.render("chat", { session_id: req.session.id })
        : res.redirect("/");
});

// Login handler. Flags the user as logged in, adds them to the USERS dictionary, and redirects them to the chat app.
app.post("/", formParser, (req, res) => {
    /*
    USERS dictionary uses session id as the key
    name = username specified on login
    socket_id = current socket id of the connected user
    connected = is set to true when the user first connects to chat, set to false on manual disconnect
    idle = set to true when the user times out (e.g. by closing the tab) without explicitly logging out;
    allows the user to reconnect without triggering new user events and associated methods
    */
    USERS[req.session.id] = {
        name: req.body.name,
        socket_id: undefined,
        connected: false,
        idle: false
    };
    req.session.is_logged_in = true;
    res.redirect("/chat");
});

// Destroys session data. Removal of the user from the USERS dictionary is handled by socket.io
app.get("/disconnect", (req, res) => {
    req.session.is_logged_in = false;
    delete req.session.id; // clearing session id, so that we never treat this user as returning after they chose to log out (since there are no accounts and usernames are not unique)
    delete USERS[req.session.id];
    res.redirect("/");
});

// Start the server
const server = app.listen(8000);

// Spins up a socket.io instance
require("./services/chat_service.js")(server, USERS, MESSAGES);