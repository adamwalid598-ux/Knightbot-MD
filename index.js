require('./settings')

const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const axios = require('axios')

const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")

// ================== 🔥 SESSION FROM ENV ==================

const sessionPath = "./session"

// create folder لو مش موجود
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath)
}

// لو فيه creds في Railway
if (process.env.CREDS) {
    fs.writeFileSync(`${sessionPath}/creds.json`, process.env.CREDS)
    console.log("✅ Loaded creds from ENV")
}

// ========================================================

async function startBot() {
    try {
        let { version } = await fetchLatestBaileysVersion()

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

        const msgRetryCounterCache = new NodeCache()

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            msgRetryCounterCache
        })

        // حفظ السيشن
        sock.ev.on('creds.update', saveCreds)

        // عند الاتصال
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update

            if (connection === 'connecting') {
                console.log('🔄 Connecting...')
            }

            if (connection === 'open') {
                console.log('✅ BOT CONNECTED SUCCESSFULLY')
            }

            if (connection === 'close') {
                const shouldReconnect =
                    (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut

                console.log('❌ Connection closed, reconnecting...')

                if (shouldReconnect) {
                    startBot()
                }
            }
        })

        // استقبال الرسائل
        sock.ev.on('messages.upsert', async (m) => {
            try {
                await handleMessages(sock, m)
            } catch (err) {
                console.error(err)
            }
        })

    } catch (err) {
        console.error("❌ Error:", err)
        setTimeout(startBot, 5000)
    }
}

// تشغيل البوت
startBot()

// Errors handling
process.on('uncaughtException', console.error)
process.on('unhandledRejection', console.error)
