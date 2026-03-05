import os
import requests
from dotenv import load_dotenv

load_dotenv()

def send_telegram(message):

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")

    max_length = 4000

    parts = [
        message[i:i + max_length]
        for i in range(0, len(message), max_length)
    ]

    for part in parts:
        requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": part
            }
        )