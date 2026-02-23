import os
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN").strip()
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID").strip()


def send_telegram(message: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"

    response = requests.post(url, json={
        "chat_id": CHAT_ID,
        "text": message
    })

    if response.status_code != 200:
        print("TELEGRAM ERROR:", response.text)