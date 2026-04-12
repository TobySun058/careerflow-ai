import os
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()

def main() -> None:
    base_url = os.getenv("FEATHERLESS_BASE_URL")
    model = os.getenv("FEATHERLESS_MODEL")
    api_key = os.getenv("FEATHERLESS_API_KEY")

    if not base_url:
        raise ValueError("Missing FEATHERLESS_BASE_URL")
    if not model:
        raise ValueError("Missing FEATHERLESS_MODEL")
    if not api_key:
        raise ValueError("Missing FEATHERLESS_API_KEY")

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say hello and give me one short fact about agentic AI."},
        ],
        temperature=0.7,
        max_tokens=200,
    )

    print("Model:", response.model)
    print("Reply:")
    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()