import { log } from './log'
import { post } from './post'
export interface Context {
    chatId: string
    text: string
}
export type Handler = (ctx: Context) => Promise<void>

export class Telega {
    private commands = new Map<string, Handler>()
    private textHandler: Handler = () => Promise.resolve()
    constructor(private token: string) {}
    onCommand(command: string, handler: Handler) {
        this.commands.set(command, handler)
    }
    onText(handler: Handler) {
        this.textHandler = handler
    }
    run(request: unknown) {
        if (!isTgRequest(request)) {
            log.error('Unknown message type', request)
            throw new Error('Unknown message type')
        }
        const chatId = String(request.message.chat.id)
        const text = request.message.text
        if (text.startsWith('/')) {
            const command = this.commands.get(text.slice(1))
            log.debug('running command', text, command)
            if (!command) return
            command({ chatId, text })
        } else {
            log.debug('running text handler', text)
            this.textHandler({ chatId, text })
        }
    }
    sendMessage(chatId: string, message: string) {
        log.debug('sending message', chatId, message)
        return post(this.getBotUrl('sendMessage'), {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
        })
    }
    sendTyping(chatId: string) {
        log.debug('sending typing', chatId)
        return post(this.getBotUrl('sendChatAction'), {
            chat_id: chatId,
            action: 'typing',
        })
    }
    private getBotUrl(action: string) {
        return new URL(`https://api.telegram.org/bot${this.token}/${action}`)
    }
}

export interface TgRequest {
    message: {
        chat: {
            id: string | number
        }
        text: string
    }
}
function isTgRequest(message: unknown): message is TgRequest {
    if (!(typeof message === 'object') || !message) return false
    if (!('message' in message)) return false
    if (!(typeof message.message === 'object') || !message.message) return false
    if (!('chat' in message.message)) return false
    if (!(typeof message.message.chat === 'object') || !message.message.chat)
        return false
    if (!('id' in message.message.chat)) return false
    if (typeof message.message.chat.id !== 'string' && typeof message.message.chat.id !== 'number') return false
    if (!('text' in message.message)) return false
    if (typeof message.message.text !== 'string') return false
    return true
}
