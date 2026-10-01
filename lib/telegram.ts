export async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  // If environment variables are not set yet, fail silently without breaking checkout
  if (!token || !chatId) {
    console.log('[Telegram Alert Skipped]: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
    return
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (error) {
    console.error('[Telegram Alert Error]:', error)
  }
}
EOFmkdir -p lib

cat << 'EOF' > lib/telegram.ts
export async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  // If environment variables are not set yet, fail silently without breaking checkout
  if (!token || !chatId) {
    console.log('[Telegram Alert Skipped]: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
    return
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (error) {
    console.error('[Telegram Alert Error]:', error)
  }
}
