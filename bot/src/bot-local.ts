import { Telegraf } from "telegraf";
import { createBot, EngBotContext } from "./lib/bot";
import { log } from "./lib/log";
import { TestStores } from "./lib/stores";
import { MockOpenAI, RealOpenAI } from "./lib/open-ai";

const token = process.env.BOT_TOKEN_TEST
const openAiToken = process.env.OPEN_AI_TOKEN
if(!token) {
    throw new Error('BOT_TOKEN_TEST is not defined')
}
if(!openAiToken) {
    throw new Error('OPEN_AI_TOKEN is not defined')
}
const bot = new Telegraf<EngBotContext>(token);
const openAi = new RealOpenAI(openAiToken)
// const openAi = new MockOpenAI()

createBot({bot, openAi, stores: new TestStores()})

bot.launch({
    webhook: {
        domain: 'https://tribalizm.rblab.net',
        hookPath: '/callback',
        port: 5000,
    }
}).then(() => {
    log.debug(`Bot started ${bot.botInfo?.username}`)
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));