import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN || '');


bot.on('text', async (ctx) => {
  // Explicit usage
    const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('🐻‍❄️', 'ok'),
        Markup.button.callback('Explain', 'explain'),
    ]);
  await ctx.telegram.sendMessage(ctx.message.chat.id, 'OLOLO', keyboard);
  
});




bot.launch({
    webhook: {
        domain: 'https://tribalizm.rblab.net',
        port: 5000,
        hookPath: '/callback',
    }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));