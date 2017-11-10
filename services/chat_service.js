module.exports = function(server, USERS, MESSAGES) {
    // Spin up live client-server connection
    const io = require("socket.io").listen(server);
    // Main socket event
    io.sockets.on("connection", c_sock => {
        // This event fires whenever the chat application is loaded
        c_sock.on("new_user", res => {
            // Check if the user has chat open in another tab.
            if (USERS[res.session_id].socket_id !== undefined) {
                c_sock.emit("already_connected");
                c_sock.disconnect((close = true));
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
                c_sock.disconnect((close = true));
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
                if (
                    USERS[session_id] &&
                    USERS[session_id].socket_id === undefined &&
                    USERS[session_id].connected === true
                ) {
                    USERS[session_id].idle = true;
                    c_sock.broadcast.emit("user_timed_out", {
                        user_name: USERS[session_id].name
                    });
                }
            }, 10000);
        });
    });
};
