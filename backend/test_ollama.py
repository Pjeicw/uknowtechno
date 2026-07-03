import asyncio
import os
from openai import AsyncOpenAI

client = AsyncOpenAI(base_url='http://127.0.0.1:11434/v1', api_key='ollama')

async def test():
    try:
        models = await asyncio.wait_for(client.models.list(), timeout=1.5)
        print('Success:', [m.id for m in models.data])
    except Exception as e:
        print('Error type:', type(e))
        print('Error msg:', str(e))

asyncio.run(test())
