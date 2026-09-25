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

// 6. Ruta para la Raíz (Corregida para que Render encuentre el archivo index.html)
router.get('/', (req, res) => {
    const path = require('path');
    res.sendFile(path.join(__dirname, 'index.html'));
});