const express = require("express");
const bodyParser = require("body-parser");
const formParser = bodyParser.urlencoded({ extended: true });
const session = require("express-session");
const app = express();
const MESSAGES = require("./factories/message_factory.js");

// A dictionary which keeps track of currently connected and idle users
const USERS = {};

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
const server = app.listen(8000, () => {
    console.log("server started");
});

// Spin up live client-server connection
const io = require("socket.io").listen(server);

// Main socket event
io.sockets.on("connection", c_sock => {
    console.log("client connected: ", c_sock.id);
    // This event fires whenever the chat application is loaded
    c_sock.on("new_user", res => {
        // Check if the user has chat open in another tab.
        if (USERS[res.session_id].socket_id !== undefined) {
            c_sock.emit("already_connected");
            c_sock.disconnect(close = true);
            return;
        }
        // Session_id is passed to the socket event handler by client-side code
        // This sets the user's socket_id
        USERS[res.session_id].socket_id = c_sock.id;
        // If the user is currently classified as disconnected (which only happens if they logged out manually or are a new user),
        // set their status as connected and notify other users that a new user has joined
        if (USERS[res.session_id].connected === false) {
            USERS[res.session_id].connected = true;
            c_sock.broadcast.emit("user_joined", {
                user_name: USERS[res.session_id].name
            });
            // If the user is currently classified as connected, but idle, update their status and notify everyone else that the user has rejoined
        } else if (USERS[res.session_id].idle === true) {
            USERS[res.session_id].idle = false;
            c_sock.broadcast.emit("user_rejoined", {
                user_name: USERS[res.session_id].name
            });
        }
    });
    // Requests messages that are currently sitting in memory. This event is emitted by the client as soon as the chat app is loaded
    // Server immediately responds with a list of up to 100 messages
    c_sock.on("request_old_messages", () => {
        c_sock.emit("old_messages", {
            old_messages: MESSAGES.get_all_messages()
        });
    });
    // This event is emitted when a new message is posted by a user
    c_sock.on("send_message", res => {
        // Ensure the user is allowed to send messages
        if (USERS[res.session_id].connected === false) {
            c_sock.emit("prohibited");
            c_sock.disconnect(close = true);
            return;
        }
        MESSAGES.new_message(USERS[res.session_id].name, res.message);
        io.sockets.emit("message_posted", {
            name: USERS[res.session_id].name,
            message: res.message
        });
    });
    // This event fires whenever a user manually logs out
    c_sock.on("user_force_disconnect", res => {
        USERS[res.session_id].connected = false;
        USERS[res.session_id].socket_id = undefined;
        c_sock.broadcast.emit("user_left", {
            user_name: USERS[res.session_id].name
        });
    });
    // This event fires when a user's connection closes without them clicking on "Leave chat" first
    c_sock.on("disconnect", () => {
        // Find the user in the USERS dict based on their socket id (since we don't have access to their session id) and clear their socket id
        let session_id;
        for (let session in USERS) {
            if (USERS[session].socket_id === c_sock.id) {
                // Do nothing if the user has disconnected manually already
                if (USERS[session].connected === false) {
                    return;
                }
                USERS[session].socket_id = undefined;
                session_id = session;
                break;
            }
        }
        // Verify that the user is still disconnected 10 seconds later and notify other users that the user timed out.
        // The delay gives the user a chance to reconnect
        setTimeout(() => {
            console.log("disconnect event fired");
            if (
                USERS[session_id] &&
                USERS[session_id].socket_id === undefined &&
                USERS[session_id].connected === true
            ) {
                USERS[session_id].idle = true;
                c_sock.broadcast.emit("user_timed_out", {
                    user_name: USERS[session_id].name
                });
                console.log("Users table was modified");
            }
            console.log("USERS:");
            console.log(USERS);
        }, 10000);
    });
});
