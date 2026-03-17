from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    MONGODB_URI = os.getenv("MONGODB_URI")

settings = Settings()