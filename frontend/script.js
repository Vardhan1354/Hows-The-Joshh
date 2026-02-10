// ================== INIT ==================
let username = localStorage.getItem("username");

const socket = new WebSocket(
    "wss://pole-talent-median-metal.trycloudflare.com"
);

const chatBox = document.getElementById("chatBox");
const userList = document.getElementById("userList");
const messageInput = document.getElementById("messageInput");
const userDisplay = document.getElementById("userDisplay");

messageInput.disabled = true;

let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChatUser = localStorage.getItem("currentChatUser");

// ================== LOGIN ==================
function login() {
    const input = document.getElementById("usernameInput").value.trim();
    if (!input) return alert("Enter username");

    username = input;
    localStorage.setItem("username", username);

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("chatPage").style.display = "flex";
    document.getElementById("myName").textContent = username;

    socket.onopen = () => socket.send(username);
}

// Auto-login
if (username) {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("chatPage").style.display = "flex";
    document.getElementById("myName").textContent = username;

    socket.onopen = () => socket.send(username);
}

// ================== SOCKET EVENTS ==================
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // -------- USERS LIST --------
    if (data.type === "users") {
        userList.innerHTML = "";

        data.all.forEach(user => {
            if (user === username) return;

            if (!chats[user]) chats[user] = [];

            const li = document.createElement("li");
            li.textContent = user;

            const dot = document.createElement("span");
            dot.className = "dot " + (data.online.includes(user) ? "online" : "offline");
            li.appendChild(dot);

            li.onclick = () => {
                document.querySelectorAll("#userList li")
                    .forEach(x => x.classList.remove("active"));
                li.classList.add("active");
                switchChat(user);
            };

            userList.appendChild(li);
        });
    }

    // -------- NEW MESSAGE --------
    if (data.type === "message") {
        if (!chats[data.from]) chats[data.from] = [];

        chats[data.from].push({
            text: data.message,
            type: "received",
            time: data.time,
            date: data.date || getDate()
        });

        localStorage.setItem("chats", JSON.stringify(chats));

        if (currentChatUser === data.from) {
            renderChat(data.from);
        }
    }

    // -------- CHAT HISTORY --------
    if (data.type === "history") {
        chats[data.with] = data.messages.map(m => ({
            text: m.text,
            type: m.from === username ? "sent" : "received",
            time: m.time,
            date: m.date || getDate()
        }));

        localStorage.setItem("chats", JSON.stringify(chats));
        renderChat(data.with);
    }
};

// ================== CHAT SWITCH ==================
function switchChat(user) {
    currentChatUser = user;
    localStorage.setItem("currentChatUser", user);

    userDisplay.textContent = `${username} → ${user}`;
    chatBox.innerHTML = "";

    messageInput.disabled = false;
    messageInput.focus();

    socket.send(`HISTORY|${user}`);
}

// ================== SEND MESSAGE ==================
function sendMessage() {
    if (!currentChatUser) return;

    const text = messageInput.value.trim();
    if (!text) return;

    if (!chats[currentChatUser]) chats[currentChatUser] = [];

    chats[currentChatUser].push({
        text,
        type: "sent",
        time: getTime(),
        date: getDate()
    });

    socket.send(`TO|${currentChatUser}|${text}`);

    messageInput.value = "";
    localStorage.setItem("chats", JSON.stringify(chats));
    renderChat(currentChatUser);
}

messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

// ================== RENDER CHAT (WITH DATE) ==================
function renderChat(user) {
    chatBox.innerHTML = "";

    let lastDate = null;

    chats[user].forEach(m => {
        if (m.date && m.date !== lastDate) {
            const dateDiv = document.createElement("div");
            dateDiv.className = "date-separator";
            dateDiv.textContent = formatDate(m.date);
            chatBox.appendChild(dateDiv);
            lastDate = m.date;
        }

        const div = document.createElement("div");
        div.className = `message ${m.type}`;
        div.innerHTML = `
            <span>${m.text}</span>
            <div class="time">${m.time}</div>
        `;
        chatBox.appendChild(div);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

// ================== DATE & TIME ==================
function getTime() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getDate() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split("-");
    const date = new Date(y, m - 1, d);
    const today = new Date();

    if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    ) {
        return "Today";
    }

    return date.toDateString();
}

// ================== AVATAR ==================
document.getElementById("avatar").textContent =
    username ? username.charAt(0).toUpperCase() : "";

// ================== THEME ==================
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.className);
}

function changeTheme(theme) {
    document.body.className = theme === "light" ? "" : theme;
    localStorage.setItem("theme", document.body.className);
}

const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
    document.body.className = savedTheme;

    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect) {
        themeSelect.value =
            savedTheme === "" ? "light" : savedTheme;
    }
}
