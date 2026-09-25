const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

// Importamos las funciones del cliente de WhatsApp
const { 
    startClient, 
    sendMessage, 
    isAuthenticated, 
    getStatus, 
    validate, 
    getAllChats, 
    getAllMessages, 
    loginUser, 
    getChats, 
    getContacts, 
    uploadMedia, 
    getMessages, 
    listUsers 
} = require("./WhatsappClient");

// Función ultra estricta para Symbian: elimina emojis, stickers y caracteres raros
const cleanTextForSymbian = (text) => {
    if (!text) return "";
    
    // Convierte a string y elimina tildes/acentos que causen problemas de codificación
    let clean = text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Conserva SOLO letras, números, espacios y signos de puntuación básicos. Borra todo lo demás.
    clean = clean.replace(/[^a-zA-Z0-9\s.,_\-+\(\)\/!@#$%\u00D1\u00F1]/g, "");
    
    return clean.trim();
};

// 1. Ruta para los Contactos (Soluciona el error de "parsing contacts")
router.get('/contacts', async (req, res) => {
    try {
        const contacts = await getContacts();
        
        const cleanedContacts = contacts.map(contact => ({
            ...contact,
            name: cleanTextForSymbian(contact.name || contact.pushname || contact.verifiedName || "Sin Nombre")
        }));
        
        res.json(cleanedContacts);
    } catch (error) {
        console.error("Error en /contacts:", error);
        res.status(500).json({ error: "Error al obtener contactos" });
    }
});

// 2. Ruta para los Chats optimizada al 100% para Qt Symbian
router.get('/chats', async (req, res) => {
    try {
        const chats = await getAllChats();
        
        const cleanedChats = chats.map(chat => {
            const idText = chat.id ? (typeof chat.id === 'object' ? chat.id._serialized : chat.id) : "";
            
            return {
                id: String(idText).trim(),
                name: cleanTextForSymbian(chat.name || "Chat"),
                lastMessage: cleanTextForSymbian(chat.lastMessage || ""),
                timestamp: cleanTextForSymbian(String(chat.timestamp || ""))
            };
        });
        
        // Forzamos las cabeceras HTTP correctas que Qt requiere para interpretar JSON
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).send(JSON.stringify(cleanedChats));
    } catch (error) {
        console.error("Error Qt /chats:", error);
        res.status(200).json([]); // Enviar array vacío en lugar de error 500 para que Qt no crashee
    }
});

// 3. NUEVA: Ruta para obtener los mensajes de un chat específico
router.get('/messages', async (req, res) => {
    try {
        const { chatId } = req.query; // Tu app suele enviar ?chatId=número
        if (!chatId) return res.status(400).json({ error: "Falta el chatId" });

        const messages = await getMessages(chatId);
        
        // Limpiamos el texto de cada mensaje recibido de WhatsApp para que no rompa el celular
        const cleanedMessages = messages.map(msg => ({
            ...msg,
            body: cleanTextForSymbian(msg.body || "")
        }));

        res.json(cleanedMessages);
    } catch (error) {
        console.error("Error en /messages:", error);
        res.status(500).json({ error: "Error al obtener mensajes" });
    }
});

// 4. NUEVA: Ruta para enviar un mensaje desde el Nokia
router.post('/send', upload.none(), async (req, res) => {
    try {
        const { to, message } = req.body; // Recibe el destinatario y el texto
        if (!to || !message) return res.status(400).json({ error: "Falta destinatario o mensaje" });

        await sendMessage(to, message);
        res.json({ success: true, status: "Mensaje enviado" });
    } catch (error) {
        console.error("Error en /send:", error);
        res.status(500).json({ error: "Error al enviar mensaje" });
    }
});

// 5. NUEVA: Ruta para verificar el estado de conexión del cliente de WhatsApp
router.get('/status', async (req, res) => {
    try {
        const status = await getStatus();
        res.json({ status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Ruta raíz dinámica: Dibuja el QR directamente desde la memoria del servidor
router.get('/', async (req, res) => {
    // Si ya inició sesión y no hay QR, muestra un mensaje de éxito
    if (!global.latestQr) {
        return res.send(`
            <html>
                <head><title>WhatsApp Listo</title><meta http-equiv="refresh" content="10"></head>
                <body style="font-family:sans-serif; text-align:center; padding-top:100px; background:#f0f2f5;">
                    <div style="background:white; padding:40px; display:inline-block; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color:#25D366;">¡WhatsApp Conectado Exitosamente!</h2>
                        <p>Ya puedes abrir la aplicación en tu Nokia C6 para cargar tus contactos y chats.</p>
                    </div>
                </body>
            </html>
        `);
    }

    try {
        // Usamos la librería qrcode para convertir el QR de memoria a imagen al instante
        const QRCodeNode = require('qrcode');
        const url = await QRCodeNode.toDataURL(global.latestQr, { errorCorrectionLevel: 'H', margin: 2 });

        res.send(`
            <html>
                <head>
                    <title>Vincular WhatsApp Nokia C6</title>
                    <meta http-equiv="refresh" content="10">
                </style>
                <body style="font-family:sans-serif; text-align:center; padding-top:50px; background:#f0f2f5;">
                    <div style="background:white; padding:30px; display:inline-block; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                        <h2>Escanea este código con tu WhatsApp principal</h2>
                        <p>Abre Dispositivos Vinculados en tu celular y apunta a la pantalla.</p>
                        <img src="${url}" style="width:300px; height:300px; margin-top:20px;" alt="Código QR" />
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error generando el código QR en vivo: " + err.message);
    }
});
module.exports = router;