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

// 2. Ruta para los Chats / Conversaciones recientes (Corregida para evitar errores de parsing)
router.get('/chats', async (req, res) => {
    try {
        const chats = await getAllChats();
        
        const cleanedChats = chats.map(chat => {
            // Aseguramos que existan strings válidos antes de limpiar o enviar
            const rawName = chat.name || chat.id || "Chat sin nombre";
            const rawMessage = chat.lastMessage || "";
            const rawTimestamp = chat.timestamp || chat.date || "";

            return {
                ...chat,
                id: chat.id ? chat.id.toString() : "",
                name: cleanTextForSymbian(rawName),
                lastMessage: cleanTextForSymbian(rawMessage),
                timestamp: cleanTextForSymbian(rawTimestamp) // Limpiamos también la fecha por si tiene caracteres raros
            };
        });
        
        res.json(cleanedChats);
    } catch (error) {
        console.error("Error en /chats:", error);
        res.status(500).json({ error: "Error al obtener chats" });
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

// 6. Ruta para la Raíz (Tu sitio web / descarga de la aplicación)
router.get('/', (req, res) => {
    res.sendFile('./index.html', { root: __dirname });
});

module.exports = router;