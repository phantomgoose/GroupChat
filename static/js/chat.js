$(document).ready(() => {
    const c_sock = io.connect();
    const session_id = $('#session_id').val();

    c_sock.emit('new_user', { session_id: session_id });
    c_sock.emit('request_old_messages');
    c_sock.on('old_messages', (res) => {
        for (let m in res.old_messages) {
            addToChat(res.old_messages[m].name, res.old_messages[m].message);
        }
    });
    c_sock.on('user_joined', (res) => {
        addToChat('Server', `A new user has joined: ${res.user_name}`);
    });
    c_sock.on('user_rejoined', (res) => {
        addToChat('Server', `User has reconnected: ${res.user_name}`);
    });
    c_sock.on('message_posted', (res) => {
        addToChat(res.name, res.message);
    });
    c_sock.on('user_left', (res) => {
        addToChat('Server', `User left: ${res.user_name}`);
    });

    c_sock.on('user_timed_out', (res) => {
        addToChat('Server', `User timed out: ${res.user_name}`);
    });

    c_sock.on('already_connected', (res) => {
        addToChat('Server', 'It appears that you are already connected to chat in another tab. This session has been terminated');
        $('a').hide();
    })

    c_sock.on('prohibited', (res) => {
        addToChat('Server', 'It appears that you have disconnected from chat or are otherwise unable to post in chat. Please reload the page and try again');
    })

    $('form').submit((e) => {
        c_sock.emit('send_message', { session_id: session_id, message: $('#message').val() });
        $('#message').val('');
        e.preventDefault();
    });

    $('a').click((e) => {
        c_sock.emit('user_force_disconnect', { session_id: session_id });
    });

    function addToChat(name, message) {
        let chat_window = $('#chat');
        let html = `${name}: ${message}</br>`
        chat_window.append(html);
    }
});