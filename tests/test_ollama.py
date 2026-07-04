import json
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:7b"

def parse_with_ollama(text):
    prompt = f"""从以下文本中提取消费信息，只返回JSON，不要有其他内容。
格式：{{"amount": 数字, "category": "类别", "description": "描述"}}
类别只能是：餐饮、交通、购物、娱乐、居住、医疗、教育、其他

文本：{text}
"""

    response = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "temperature": 0.1
    })

    if response.status_code == 200:
        content = response.json()["response"]
        # 提取JSON
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return json.loads(match.group())
    return {"amount": 0, "category": "其他", "description": text[:20]}


if __name__ == "__main__":
    test_inputs = [
        "今天中午和同事吃火锅花了186块",
        "打车上班25元",
        "在淘宝买了件衣服399",
        "房租这个月2400"
    ]

    for text in test_inputs:
        result = parse_with_ollama(text)
        print(f"输入: {text}")
        print(f"解析: {json.dumps(result, ensure_ascii=False)}")
        print("-" * 40)