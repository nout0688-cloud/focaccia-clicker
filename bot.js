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

const knownUsers = new Set();

async function handleUpdate(update) {
  const msg = update.message;
  const text = (msg?.text || msg?.caption || '').trim();
  if (!text) return;

  const chatId = msg.chat.id;
  const name = msg.from?.first_name || 'друже';
  knownUsers.add(chatId);

  if (text === '/start') {
    await api('sendMessage', {
      chat_id: chatId,
      text:
        `Привіт, ${name}! 👋\n\n` +
        `🫓 *Фокача Клікер* — клікай, їж, прокачуйся\\!\n\n` +
        `🏗️ Будуй пекарні, наймай бабусь, відкривай філії в Італії та навіть запускай космічні пекарні\\! 🚀\n\n` +
        `⚡ *Фішки гри:*\n` +
        `• Комбо\\-система до x100\n` +
        `• 5% шанс криту x10 💥\n` +
        `• Золота фокача з бонусами ✨\n` +
        `• Френзі x7 🔥\n` +
        `• Система престижу ♻️\n` +
        `• 19 досягнень 🏆\n\n` +
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
    return;
  }

  // /broadcast <текст>
  if (text.startsWith('/broadcast ') || text.startsWith('/розсилка ')) {
    const broadcastText = text.replace(/^\/(broadcast|розсилка)\s+/i, '').trim();
    if (!broadcastText) {
      await api('sendMessage', { chat_id: chatId, text: '❌ Вкажи текст: /broadcast <текст>' });
      return;
    }

    await api('sendMessage', { chat_id: chatId, text: `⏳ Розпочато розсилку для ${knownUsers.size} користувачів...` });
    let sent = 0, failed = 0;
    for (const uid of knownUsers) {
      try {
        let res = await api('sendMessage', {
          chat_id: uid,
          text: `📢 *Оголошення:*\n\n${broadcastText}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🫓 Грати у Фокача Клікер!', web_app: { url: WEBAPP_URL } }]],
          },
        });
        if (!res?.ok) {
          res = await api('sendMessage', {
            chat_id: uid,
            text: `📢 Оголошення:\n\n${broadcastText}`,
            reply_markup: {
              inline_keyboard: [[{ text: '🫓 Грати у Фокача Клікер!', web_app: { url: WEBAPP_URL } }]],
            },
          });
        }
        if (res?.ok) sent++; else failed++;
      } catch (e) {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    await api('sendMessage', {
      chat_id: chatId,
      text: `✅ Розсилку завершено!\n📨 Доставлено: ${sent}\n❌ Помилок: ${failed}`,
    });
    return;
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
