import json
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:7b"

def parse_expense(text):
    prompt = f"""从以下文本中提取消费信息，只返回JSON。
格式：{{"amount": 数字, "category": "类别", "description": "描述"}}
类别只能是：餐饮、交通、购物、娱乐、居住、医疗、教育、其他

文本：{text}
"""

    try:
        response = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "temperature": 0.1
        }, timeout=30)

        if response.status_code == 200:
            content = response.json()["response"]
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                return json.loads(match.group())
    except Exception as e:
        print(f"错误: {e}")

    return {"amount": 0, "category": "其他", "description": text[:20]}

if __name__ == "__main__":
    result = parse_expense("今天吃火锅花了186")
    print(json.dumps(result, ensure_ascii=False, indent=2))