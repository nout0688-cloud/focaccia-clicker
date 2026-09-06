/**
 * Фокача Клікер — Telegram Bot
 * Відповідає на /start привітальним повідомленням з кнопкою запуску гри.
 *
 * Запуск:  node bot.js ТВІЙ_ТОКЕН
 */

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('❌ Вкажи токен бота: node bot.js ТВІЙ_ТОКЕН');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const WEBAPP_URL = 'https://nout0688-cloud.github.io/focaccia-clicker/';

async function api(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const name = msg.from?.first_name || 'друже';

  if (msg.text === '/start') {
    await api('sendMessage', {
      chat_id: chatId,
      text:
        `Привіт, ${name}! 👋\n\n` +
        `🫓 *Фокача Клікер* — клікай, їж, прокачуйся\\!\n\n` +
        `🏗️ Будуй пекарні, наймай бабусь, відкривай філії в Італії та навіть запускай космічні пекарні\\! 🚀\n\n` +
        `⚡ *Фішки гри:*\n` +
        `• Комбо\\-система до x3\n` +
        `• 5% шанс криту x10 💥\n` +
        `• Золота фокача з бонусами ✨\n` +
        `• Френзі x7 🔥\n` +
        `• Система престижу ♻️\n` +
        `• 16 досягнень 🏆\n\n` +
        `Натисни кнопку нижче і почни клікати\\! 👇`,
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🫓 Грати у Фокача Клікер!',
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      },
    });
    console.log(`✅ /start від ${name} (${chatId})`);
  }
}

// Long polling
let offset = 0;

async function poll() {
  try {
    const data = await api('getUpdates', { offset, timeout: 30 });
    if (data.ok && data.result.length) {
      for (const upd of data.result) {
        offset = upd.update_id + 1;
        handleUpdate(upd).catch(console.error);
      }
    }
  } catch (err) {
    console.error('⚠️ Помилка polling:', err.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
  poll();
}

console.log('🫓 Фокача Клікер бот запущений!');
console.log(`🔗 Webapp: ${WEBAPP_URL}`);
poll();
