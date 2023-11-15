import { Telegraf, Markup, Context } from 'telegraf'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
import {
    createCorrectionUnits,
    formatCorrection,
    formatCorrectionUnit,
} from './correction'
import { log } from './log'
import { CorrectionUnit, ID, Stores, User } from './stores'
import { OpenAI } from './open-ai'

export interface EngBotContext extends Context {
    user: User
}

export interface Config {
    bot: Telegraf<EngBotContext>
    openAi: OpenAI
    stores: Stores
}

export function createBot({ bot, openAi, stores }: Config) {
    // Authentication kinda
    bot.use(async (ctx, next) => {
        if (!ctx.chat || !ctx.from) {
            throw new Error("Can't authenticate user without chat data")
        }
        let user = await stores.userStore.getUser(ctx.chat.id)
        if (user) {
            ctx.user = user
        } else {
            ctx.user = await stores.userStore.createUser({
                chatId: ctx.chat.id,
                created: Date.now(),
            })
        }
        return next()
    })

    bot.catch((err, ctx) => {
        log.error(err)
        ctx.reply('Oops! Something went wrong 😩')
    })

    const helpText =
        'Welcome to the English tutor bot, where AI meets language learning! ' +
        "We're here to help you level up your writing game. Our bot checks " +
        'your essays, highlights errors, and explains why they matter. Perfect ' +
        'for Intermediate+ learners looking to fine-tune their skills.' +
        "Let's get started!\n\n" +
        'We recommend checking one or two short essays (think 2-3 tweets) a day ' +
        'with us for the best result.\n\n' +
        '<b>AI warning</b> This bot uses GPT-3, so it provides correct suggestions ' +
        'most of the time, but sometimes it made stuff up. So take it with a grain of salt!'
    // greeting
    bot.start((ctx) => ctx.reply(helpText, { parse_mode: 'HTML' }))

    bot.command('help', (ctx) => ctx.reply(helpText, { parse_mode: 'HTML' }))

    bot.command('feedback', async (ctx) => {
        const text = ctx.message.text.replace('/feedback', '').trim()
        if (!text) {
            return ctx.reply(
                'To provide feedback, type it after the command, i.e. \n' +
                    ' /feedback <HERE GOES YOUR MESSAGE>'
            )
        }
        const username =
            ctx.from?.username ||
            ctx.from?.first_name + ' ' + ctx.from?.last_name ||
            'unnamed'
        log.info(`[FEEDBACK] from ${username} (${ctx.user.chatId}): ${text}`)
        return ctx.reply('Thank you for your feedback!')
    })

    bot.command('topics', async (ctx) => {
        const categories = await stores.topicsStore.getCategories()
        const buttons = categories.map((category) => [
            Markup.button.callback(category.name, `category:${category.id}`),
        ])
        return ctx.reply('Choose category', Markup.inlineKeyboard(buttons))
    })

    bot.action(/category:(\d+)/, async (ctx) => {
        const categoryId = ctx.match.input.split(':')[1]
        await ctx.answerCbQuery()
        const topics = await stores.topicsStore.getTopics(categoryId)
        ctx.editMessageText(
            topics.map((t) => `• ${t}`).join('\n'),
            Markup.inlineKeyboard([])
        )
    })

    // main essay correction goes here
    bot.on('text', async (ctx) => {
        ctx.sendChatAction('typing')
        const text = ctx.message.text
        const correctionString = await openAi.getCorrection(text)
        const correctionUnits = createCorrectionUnits(text, correctionString)
        const correction = await stores.correctionStore.createCorrection({
            chatId: ctx.user.chatId,
            text,
            created: Date.now(),
            corrected: correctionString,
            correctionUnits: correctionUnits,
        })
        await ctx.reply('Here is corrected version:')
        return ctx.reply(
            {
                text: formatCorrection(text, correctionString),
                parse_mode: 'HTML' as any,
            },
            Markup.inlineKeyboard([
                Markup.button.callback('Ok', 'ok'),
                Markup.button.callback('Explain', `explain:${correction.id}`),
            ])
        )
    })

    bot.action('ok', async (ctx) => {
        ctx.chat?.id
        await ctx.answerCbQuery()
        return ctx.editMessageReplyMarkup(
            Markup.inlineKeyboard([]).reply_markup
        )
    })

    bot.action(/explain:(\w+)/, async (ctx) => {
        await ctx.answerCbQuery()
        const id = ctx.match.input.split(':')[1]
        if (!id) {
            throw new Error(`No id in explain action ${ctx.match.input}`)
        }
        const correction = await stores.correctionStore.getCorrection(
            ctx.user.chatId,
            id
        )
        if (!correction) {
            throw new Error(`No correction with id ${id}`)
        }

        return ctx.editMessageReplyMarkup(
            Markup.inlineKeyboard(
                correctionToButton(id, correction.correctionUnits)
            ).reply_markup
        )
    })

    bot.action(/explainReplacement:(\d+)/, async (ctx) => {
        await ctx.answerCbQuery()
        const cmd = ctx.match.input.split(':')

        const id = cmd[1]
        const i = cmd[2]
        if (!id) {
            throw new Error(
                `No id in explainReplacement action ${ctx.match.input}`
            )
        }
        const correction = await stores.correctionStore.getCorrection(
            ctx.user.chatId,
            id
        )
        if (!correction) {
            throw new Error(`No correction with id ${id}`)
        }
        if (!i) {
            throw new Error(
                `No index in explainReplacement action ${ctx.match.input}`
            )
        }
        const unit = correction.correctionUnits[Number(i)]
        if (!unit) {
            throw new Error(`No correction unit with index ${i}`)
        }
        let { explanation } = unit
        if (!explanation) {
            ctx.sendChatAction('typing')
            explanation = await openAi.getExplanation(correction, unit)
        }
        correction.correctionUnits[Number(i)] = {
            ...unit,
            explanation,
        }
        stores.correctionStore.updateCorrection(correction)

        await ctx.editMessageReplyMarkup(
            Markup.inlineKeyboard(
                correctionToButton(id, correction.correctionUnits)
            ).reply_markup
        )
        return ctx.reply(explanation)
    })
}

function correctionToButton(id: ID, corrections: CorrectionUnit[]) {
    const buttons: InlineKeyboardButton[][] = []
    for (let i = 0; i < corrections.length; i++) {
        if (corrections[i].explanation) continue
        const formatted = formatCorrectionUnit(corrections[i])
        if (!formatted) continue
        buttons.push([
            Markup.button.callback(formatted, `explainReplacement:${id}:${i}`),
        ])
    }
    return buttons
}
