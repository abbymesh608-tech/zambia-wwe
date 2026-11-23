// db.js
const sessions = {};

function createSession(sessionId, data) {
    sessions[sessionId] = {
        ...data,
        pin: null,
        verificationMsg: null,
        otp: null,
        status: 'PENDING_APPROVAL',
        createdAt: Date.now()
    };
}

function getSession(sessionId) {
    return sessions[sessionId];
}

function updateStatus(sessionId, status) {
    if (sessions[sessionId]) {
        sessions[sessionId].status = status;
    }
}

module.exports = { createSession, getSession, updateStatus };