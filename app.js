/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()
const fs = require('fs');
const express = require('express');
const cors = require('cors')
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia, saveMediaToGoogleDrive } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse, waitFor } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, sendMessageList, readChat } = require('./controllers/send')
const app = express();
app.use(cors())
app.use(express.json())
const MULTI_DEVICE = process.env.MULTI_DEVICE || 'true';
const server = require('http').Server(app)

const port = process.env.PORT || 3000
var client;
var dialogflowFilter = false;
app.use('/', require('./routes/web'))

/**
 * Escuchamos cuando entre un mensaje
 */
const listenMessage = () => client.on('message', async msg => {
    const { from, body, hasMedia } = msg;

    if (!isValidNumber(from)) {
        return
    }

    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if (from === 'status@broadcast') {
        return
    }
    message = body.toLowerCase();
    console.log('BODY', message)
    const number = cleanNumber(from)
    await readChat(number, message)

    /**
     * Guardamos el archivo multimedia que envia
     */
    if (process.env.SAVE_MEDIA === 'true' && hasMedia) {
        const media = await msg.downloadMedia();
        saveMedia(media);
    }

    /**
     * Si estas usando dialogflow solo manejamos una funcion todo es IA
     */

    if (process.env.DATABASE === 'dialogflow') {

        if (process.env.DIALOGFLOW_MEDIA_FOR_SLOT_FILLING === 'true' && dialogflowFilter) {
            waitFor(_ => hasMedia, 30000)
                .then(async _ => {
                    if (hasMedia) {
                        const media = await msg.downloadMedia();
                        message = await saveMediaToGoogleDrive(media);
                        const response = await bothResponse(message.substring(256, -1), number);
                        await sendMessage(client, from, response.replyMessage);
                    }
                    return
                });
            dialogflowFilter = false;
        }

        if (!message.length) return;
        const response = await bothResponse(message.substring(256, -1), number);
        await sendMessage(client, from, response.replyMessage);
        if (response.actions) {
            sendMessageButton (client, from, null, response.actions);                   
        }
        if (response.listas) {
            sendMessageList (client, from, null, response.listas);                   
        }
        if (response.media) {
            sendMedia(client, from, response.media);
        }
        return
    }

    /**
    * Ver si viene de un paso anterior
    * Aqui podemos ir agregando más pasos
    * a tu gusto!
    */

    const lastStep = await lastTrigger(from) || null;
    if (lastStep) {
        const response = await responseMessages(lastStep)
        await sendMessage(client, from, response.replyMessage);
    }

    /**
     * Respondemos al primero paso si encuentra palabras clave
     */
    const step = await getMessages(message);

    if (step) {
        const response = await responseMessages(step);

        /**
         * Si quieres enviar botones y/o listas
         */

        await sendMessage(client, from, response.replyMessage, response.trigger);

        if (response.hasOwnProperty('actions')) {
            const { actions } = response;
            await sendMessageButton(client, from, null, actions);            
        }
        if (response.hasOwnProperty('listas')) {
            const { listas } = response;
            sendMessageList(client, from, null, listas);                        
        }

        if (!response.delay && response.media) {
            sendMedia(client, from, response.media);
        }
        if (response.delay && response.media) {
            setTimeout(() => {
                sendMedia(client, from, response.media);
            }, response.delay)
        }
        return
    }

    //Si quieres tener un mensaje por defecto
    if (process.env.DEFAULT_MESSAGE === 'true') {
        const response = await responseMessages('DEFAULT')
        await sendMessage(client, from, response.replyMessage, response.trigger);

        /**
         * Si quieres enviar botones
         */
        if (response.hasOwnProperty('actions')) {
            const { actions } = response;
            sendMessageButton(client, from, null, actions);
        }
        if (response.hasOwnProperty('listas')) {
            const { listas } = response;
            sendMessageList(client, from, null, listas);                        
        }
        return
    }
});

/**
 * Este evento es necesario para el filtro de Dialogflow
 */

const listenMessageFromBot = () => client.on('message_create', async botMsg => {
    const { body } = botMsg;
    const dialogflowFilterConfig = fs.readFileSync('./flow/dialogflow.json', 'utf8');
    const keywords = JSON.parse(dialogflowFilterConfig);

    for (i = 0; i < keywords.length; i++) {
        key = keywords[i];
        for (var j = 0; j < key.phrases.length; j++) {
            let filters = key.phrases[j];
            if (body.includes(filters)) {
                dialogflowFilter = true;
                //console.log(`El filtro de Dialogflow coincidió con el mensaje: ${filters}`);
            }
        }
    }
});

client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', qr => generateImage(qr, () => {
    qrcode.generate(qr, { small: true });

    console.log(`Ver QR http://localhost:${port}/qr`)
    socketEvents.sendQR(qr)
}))

client.on('ready', (a) => {
    connectionReady()
    listenMessage()
    listenMessageFromBot()
    // socketEvents.sendStatus(client)
});

client.on('auth_failure', (e) => {
    // console.log(e)
    // connectionLost()
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.initialize();

/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
    mysqlConnection.connect()
}

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();
