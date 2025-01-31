
const ExcelJS = require('exceljs');
const moment = require('moment');
const fs = require('fs');
const { MessageMedia, Buttons, List } = require('whatsapp-web.js');
const { cleanNumber } = require('./handle')
const DELAY_TIME = 170; //ms
const DIR_MEDIA = `${__dirname}/../mediaSend`;
// import { Low, JSONFile } from 'lowdb'
// import { join } from 'path'
const { saveMessage } = require('../adapter')
/**
 * Enviamos archivos multimedia a nuestro cliente
 * @param {*} number 
 * @param {*} fileName 
 */

const sendMedia = (client, number = null, fileName = null) => {
    if(!client) return console.error("El objeto cliente no está definido.");
    try {
        number = cleanNumber(number || 0)
        const file = `${DIR_MEDIA}/${fileName}`;
        if (fs.existsSync(file)) {
            const media = MessageMedia.fromFilePath(file);
            client.sendMessage(number, media, { sendAudioAsVoice: true });
        }
    } catch(e) {
        throw e;
    }
}

/**
 * Enviamos archivos como notas de voz
 * @param {*} number 
 * @param {*} fileName 
 */

 const sendMediaVoiceNote = (client, number = null, fileName = null) => {
     if(!client) return console.error("El objeto cliente no está definido.");
     try { 
        number = cleanNumber(number || 0)
        const file = `${DIR_MEDIA}/${fileName}`;
        if (fs.existsSync(file)) {
            const media = MessageMedia.fromFilePath(file);
            client.sendMessage(number, media ,{ sendAudioAsVoice: true });

        }
    }catch(e) {
        throw e;
}

}
/**
 * Enviamos un mensaje simple (texto) a nuestro cliente
 * @param {*} number 
 */
const sendMessage = async (client, number = null, text = null, trigger = null) => {
   setTimeout(async () => {
    number = cleanNumber(number)
    const message = text
    client.sendMessage(number, message);
    await readChat(number, message, trigger)
    console.log(`⚡⚡⚡ Enviando mensajes....`);
   },DELAY_TIME)
}

/**
 * Enviamos un mensaje con buttons a nuestro cliente
 * @param {*} number 
 */
const sendMessageButton = async (client, number = null, text = null, actionButtons) => {
    setTimeout(async () => {
    number = cleanNumber(number)
    const { title = null, message = null, footer = null, buttons = [] } = actionButtons;
    let button = new Buttons(message,[...buttons], title, footer);
    client.sendMessage(number, button);
    await readChat(number, message, actionButtons)
    console.log(`⚡⚡⚡ Enviando mensajes....`);
    }, DELAY_TIME)
}

/**
 * Enviamos un mensaje con lista a nuestro cliente
 * @param {*} number 
 */
 const sendMessageList = async (client, number = null, text = null, actionList) => {
    setTimeout(async () => {
    number = cleanNumber(number)
    const { body = null, buttonText = null, sections = [], title = null, footer = null } = actionList;
    let aList = new List( body, buttonText, [...sections], title, footer);
    client.sendMessage(number, aList);
    await readChat(number, message, actionList)
    console.log(`⚡⚡⚡ Enviando lista....`);
    }, DELAY_TIME)
}

/**
 * Opte
 */
const lastTrigger = (number) => new Promise((resolve, reject) => {
    number = cleanNumber(number)
    const pathExcel = `${__dirname}/../chats/${number}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    if (fs.existsSync(pathExcel)) {
        workbook.xlsx.readFile(pathExcel)
            .then(() => {
                const worksheet = workbook.getWorksheet(1);
                const lastRow = worksheet.lastRow;
                const getRowPrevStep = worksheet.getRow(lastRow.number);
                const lastStep = getRowPrevStep.getCell('C').value;
                resolve(lastStep)
            });
    } else {
        resolve(null)
    }
})

/**
 * Guardar historial de conversacion
 * @param {*} number 
 * @param {*} message 
 */
const readChat = async (number, message, trigger = null) => {
    number = cleanNumber(number)
    await saveMessage( message, trigger, number )
    console.log('Saved')
}

module.exports = { sendMessage, sendMedia, lastTrigger, sendMessageButton, sendMessageList, readChat, sendMediaVoiceNote }
