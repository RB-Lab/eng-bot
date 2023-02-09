import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda'
import { log } from './lib/log'
import { base64Decode } from './lib/base-64'
import { formatCorrection } from './lib/format-correction'
import { correctEssay } from './lib/prompts/correction'
import { Telega } from './lib/telega'
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
        log.debug('event has body, starting Telega', event)
        const { botToken } = await getSecrets()
        const telega = new Telega(botToken)

        // TODO check header for X-Telegram-Bot-Api-Secret-Token
        let body = event.body
        if (event.isBase64Encoded) {
            body = base64Decode(body)
        }
        const message = JSON.parse(body)

        log.debug('body parsed', body)

        telega.onText(async ({ chatId, text }) => {
            log.debug('requesting correction')
            await telega.sendTyping(chatId)
            const correction = await correctEssay(text)
            await telega.sendMessage(chatId, "Here's corrected version:")
            await telega.sendMessage(chatId, formatCorrection(text, correction))
        })

        telega.run(message)

        log.debug('SUCCESS!')

        callback(null, {
            statusCode: 200,
            body: JSON.stringify({
                message: 'success',
            }),
        })
    } catch (err) {
        console.error('[ERROR]', err)
        callback(null, {
            statusCode: 500,
            body: JSON.stringify({
                error: String(err),
            }),
        })
    }
}
