import { log } from './log'
import { post } from './post'
export interface Context {
    chatId: string
}
export interface MessageContext extends Context {
    text: string
}
export interface CallbackContext extends Context {
    callbackData: string
    messageId: string
}
export interface CommandContext extends MessageContext {
    command: string
}
export type Handler<C extends Context> = (ctx: C) => Promise<void>

export class Telega {
    private commands = new Map<string, Handler<CommandContext>>()
    private callbackHandlers = new Map<string, Handler<CallbackContext>>()
    private textHandler: Handler<MessageContext> = () => Promise.resolve()
    constructor(private token: string) {}
    onCommand(command: string, handler: Handler<CommandContext>) {
        this.commands.set(command, handler)
    }
    onText(handler: Handler<MessageContext>) {
        this.textHandler = handler
    }
    onCallback(callback: string, handler: Handler<CallbackContext>) {
        this.callbackHandlers.set(callback, handler)
    }
    run(request: unknown): Promise<any> {
        if (isMessageRequest(request)) {
            const chatId = String(request.message.chat.id)
            const text = request.message.text
            if (text.startsWith('/')) {
                const command = this.commands.get(text.slice(1))
                log.debug('running COMMAND', text, command)
                if (!command) return Promise.resolve()
                return command({ chatId, text, command: text.slice(1) })
            } else {
                log.debug('running TEXT handler', text)
                return this.textHandler({ chatId, text })
            }
        }
        if (isCbQueryRequest(request)) {
            const chatId = String(request.callback_query.message.chat.id)
            const callback = request.callback_query.data
            const handler = this.callbackHandlers.get(callback)
            log.debug('running CALLBACK handler', callback, handler)
            if (!handler) return Promise.resolve()
            const messageId = String(request.callback_query.message.message_id)
            return handler({ chatId, callbackData: callback, messageId })
        }
        log.error('Unknown message type', request)
        throw new Error('Unknown message type')
    }
    sendMessage(message: Message) {
        const msg = message.build()
        log.debug('sending message', msg)
        return post(this.token, this.getBotUrl('sendMessage'), msg)
    }
    hideKeyboard(chatId: string, messageId: string) {
        log.debug('hiding keyboard', chatId, messageId)
        return post(this.token, this.getBotUrl('editMessageReplyMarkup'), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] },
        })
    }
    replaceKeyboard(chatId: string, messageId: string, message: Message) {
        const msg = message.build()
        log.debug('replacing keyboard', chatId, messageId, msg.reply_markup)
        return post(this.token, this.getBotUrl('editMessageReplyMarkup'), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: msg.reply_markup,
        })
    }
    sendTyping(chatId: string) {
        log.debug('sending typing', chatId)
        return post(this.token, this.getBotUrl('sendChatAction'), {
            chat_id: chatId,
            action: 'typing',
        })
    }
    createMessage(chatId: string, message: string) {
        return new Message(chatId, message)
    }
    private getBotUrl(action: string) {
        return new URL(`https://api.telegram.org/bot${this.token}/${action}`)
    }
}

type ID = string | number
export interface TgMessage {
    message_id: ID
    chat: Chat
    text: string
    date: number
}
interface MessageRequest {
    message: TgMessage
}
interface Chat {
    id: ID
}

interface From {
    id: ID
    is_bot: boolean
    first_name: string
    last_name: string
    username: string
    language_code: string
}

interface CbQueryRequest {
    update_id: ID
    callback_query: {
        id: ID
        from: From
        message: TgMessage
        chat_instance: ID
        data: string
    }
}
function isMessageRequest(req: unknown): req is MessageRequest {
    if (!(typeof req === 'object') || !req) return false
    if (!('message' in req)) return false
    if (!(typeof req.message === 'object') || !req.message) return false
    if (!('chat' in req.message)) return false
    if (!(typeof req.message.chat === 'object') || !req.message.chat)
        return false
    // we trust the rest
    return true
}

export function isCbQueryRequest(req: unknown): req is CbQueryRequest {
    if (!(typeof req === 'object') || !req) return false
    if (!('callback_query' in req)) return false
    if (!(typeof req.callback_query === 'object') || !req.callback_query)
        return false
    if (!('data' in req.callback_query)) return false
    if (!(typeof req.callback_query.data === 'string')) return false
    // we trust the rest
    return true
}

interface MessageObj {
    chat_id: string
    text: string
    reply_markup?: string | any
}

interface CbBtn {
    text: string
    cb: string
}
export class Message {
    private keys: CbBtn[] = []
    private keyboardFmt?: number[]
    constructor(private chatId: string, private message: string) {}
    addCallbackKey(text: string, callbackData: string) {
        this.keys.push({ text, cb: callbackData })
        return this
    }
    formatKeyboard(rows: number[]) {
        this.keyboardFmt = rows
    }
    build() {
        const message: MessageObj = {
            chat_id: this.chatId,
            text: this.message,
        }
        if (this.keys.length) {
            message['reply_markup'] ={
                // inline_keyboard: this.formatKbd(),
                inline_keyboard: [
                    [
                      { text: '🐻‍❄️', callback_data: 'ok', hide: false },
                      { text: 'Explain', callback_data: 'explain', hide: false }
                    ]
                  ]
            }
        }

        return message
    }
    private formatKbd() {
        if (!this.keyboardFmt) return [this.keys.map(formatCallbackBtn)]
        const kbd: CallbackBtn[][] = []
        let keysAdded = 0
        this.keyboardFmt.forEach((rowSize) => {
            kbd.push(
                this.keys
                    .slice(keysAdded, keysAdded + rowSize)
                    .map(formatCallbackBtn)
            )
            keysAdded += rowSize
            if (keysAdded > this.keys.length)
                throw new Error(
                    `Total keys in format: ${keysAdded} is more than total keys: ${this.keys.length}`
                )
        })
        return kbd
    }
}

interface CallbackBtn {
    text: string
    callback_data: string
}

function formatCallbackBtn(btn: CbBtn) {
    return { text: btn.text, callback_data: btn.cb }
}
