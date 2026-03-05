import os
import requests
from dotenv import load_dotenv

load_dotenv()

def send_telegram(message):

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    print("BOT:", os.getenv("TELEGRAM_BOT_TOKEN"))
    print("CHAT:", os.getenv("TELEGRAM_CHAT_ID"))
    if not bot_token or not chat_id:
        print("TELEGRAM ERROR: TOKEN OR CHAT_ID MISSING")
        return

    max_length = 4000

    parts = [
        message[i:i + max_length]
        for i in range(0, len(message), max_length)
    ]

    for part in parts:

        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            data={
                "chat_id": chat_id,
                "text": part
            }
        )

        # показываем ошибки Telegram
        if response.status_code != 200:
            print("TELEGRAM ERROR:", response.text)