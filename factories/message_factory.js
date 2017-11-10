class Node {
    constructor(val) {
        this.val = val;
        this.next;
    }
}

class SLL {
    constructor() {
        this.head;
        this.tail;
        this.length;
    }
    add(val) {
        let new_node = new Node(val);
        if (!this.tail) {
            this.head = new_node;
            this.tail = new_node;
            this.length = 1;
            return this;
        }
        this.tail.next = new_node;
        this.tail = new_node;
        this.length++;
        return this;
    }
    pop() {
        if (!this.head) {
            return this;
        }
        this.head = this.head.next;
        this.length--;
        return this;
    }
}

class Messages extends SLL {
    constructor() {
        super();
    }
    // removes messages until there's 100 or less messages left.
    trim() {
        while (this.length > 100) {
            this.pop();
        }
        return this;
    }
    new_message(name, message) {
        this.add({ name: name, message: message });
        return this;
    }
    // trims the messages and returns up to 100 latest messages
    get_all_messages() {
        this.trim();
        let res = [];
        let curr_mess = this.head;
        while (curr_mess) {
            res.push({
                name: curr_mess.val.name,
                message: curr_mess.val.message
            });
            curr_mess = curr_mess.next;
        }
        return res;
    }
    get_last_message() {
        return this.tail.val;
    }
}

module.exports = new Messages();