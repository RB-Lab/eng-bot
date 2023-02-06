import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda'
import { base64Decode } from './lib/base-64'
import { post } from './lib/post'
import { correctEssay } from './lib/prompts/correction'
import { getSecrets } from './lib/secret-service'


export const handler = async (
    event: APIGatewayEvent,
    context: Context,
    callback: APIGatewayProxyCallback
) => {
    if (!event.body) {
        callback(null, {
            statusCode: 400,
            body: 'unknown request type',
        })
        return
    }
    try {
        console.log('[INFO] inside handler getting secret', event)

        // TODO check header for X-Telegram-Bot-Api-Secret-Token
        let body = event.body
        if(event.isBase64Encoded){
            body = base64Decode(body)
        }
        const {botToken} = await getSecrets()

        console.log('[INFO] got secret, parsing event', body)
        
        const message = JSON.parse(body)
        const chatId = message.message.chat.id
        const text = message.message.text
        const address = `https://api.telegram.org/bot${botToken}/`
        const url = new URL(`${address}sendMessage`)
        const typingUrl = new URL(`${address}sendChatAction`)
        const typingResponse = await post(typingUrl, { chat_id: chatId, action: 'typing' })
        console.log('[INFO] requesting correction', typingResponse)
        const correction = await correctEssay(text)
        let response = await post(url, { chat_id: chatId, text: 'Here\'s corrected version:' })
        response = await post(url, { chat_id: chatId, text: correction })

        console.log('[SUCCESS]', response)
        
        callback(null, {
            statusCode: 200,
            body: JSON.stringify({
                message: 'success',
            }),
        })
    } catch (err) {
        callback(null, {
            statusCode: 500,
            body: JSON.stringify({
                error: String(err),
            }),
        })
    }
}


