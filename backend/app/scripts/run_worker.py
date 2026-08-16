import asyncio

from app.core.worker import run_forever

if __name__ == "__main__":
    asyncio.run(run_forever())
