import { Handler } from 'aws-lambda'
import { log } from './lib/log'
import { base64Decode } from './lib/base-64'
import { getSecrets } from './lib/secret-service'
import { MockOpenAI, RealOpenAI } from './lib/open-ai'
import { Telegraf } from 'telegraf'
import { createBot, EngBotContext } from './lib/bot'
import { DynamoStores } from './lib/model'
import { Update } from 'telegraf/typings/core/types/typegram'

export const handler: Handler = async (event) => {
    let message: Update
    try {
        if (!event.body) {
            throw new Error('unknown request type')
        }

        let body = event.body
        if (event.isBase64Encoded) {
            body = base64Decode(body)
        }
        message = JSON.parse(body)
    } catch (e) {
        log.error(e)
        return {
            statusCode: 400,
            body: String(e),
        }
    }
    try {
        const { botToken, openApiToken } = await getSecrets()
        log.debug('event has body, starting Telega', event)

        // TODO check header for X-Telegram-Bot-Api-Secret-Token
        const bot = new Telegraf<EngBotContext>(botToken);

        // const openAi = new RealOpenAI(openAiToken)
        const openAi = new MockOpenAI()
        const stores = new DynamoStores()
        createBot({bot, openAi, stores})
        
        await bot.handleUpdate(message)
        log.debug('SUCCESS!')

        return {
            statusCode: 200,
            body: 'OK',
        }
    } catch (err) {
        log.error(err)
        return {
            statusCode: 500,
            body: String(err),
        }
    }
}
