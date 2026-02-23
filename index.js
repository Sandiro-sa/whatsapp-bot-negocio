const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const qrcode = require('qrcode-terminal');

// Configuración del logger para que no ensucie la consola
const logger = P({ level: 'error' });

// Función principal asíncrona
async function connectToWhatsApp() {
    // Cargamos el estado de sesión desde la carpeta "auth_info"
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Creamos la conexión
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Nosotros mostraremos el QR con qrcode-terminal
        logger: logger,
        browser: ['Negocio Bot', 'Safari', '1.0.0'] // Nombre que aparecerá en WhatsApp
    });

    // Evento para cuando se genera el código QR (solo la primera vez o cuando expira)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Escanea este código QR con tu WhatsApp:');
            qrcode.generate(qr, { small: true }); // Muestra el QR en la terminal
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp(); // Reintenta conectar a menos que nos hayan deslogueado
            }
        } else if (connection === 'open') {
            console.log('¡Conectado a WhatsApp correctamente!');
            // Aquí puedes enviar un mensaje de prueba
            // sock.sendMessage('[número]@s.whatsapp.net', { text: 'Hola, soy tu bot' });
        }
    });

    // Evento para guardar las credenciales automáticamente
    sock.ev.on('creds.update', saveCreds);

    // Evento para recibir mensajes
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        // Ignorar mensajes propios o de estados
        if (message.key.fromMe) return;
        if (message.key.remoteJid.endsWith('@g.us')) {
            // Mensaje de grupo
            console.log('Mensaje en grupo:', message);
            // Aquí procesas los mensajes del grupo de ventas
            const texto = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            if (texto.toLowerCase().includes('hola')) {
                await sock.sendMessage(message.key.remoteJid, { text: '¡Hola! ¿En qué puedo ayudarte?' });
            }
        } else {
            // Mensaje privado
            console.log('Mensaje privado:', message);
        }
    });
}

// Iniciamos la conexión
connectToWhatsApp().catch(err => console.error(err));
