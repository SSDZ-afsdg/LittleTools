import json
import re
import requests
from typing import Dict, Any

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:7b"

# 固定类别列表
CATEGORIES = ["餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "其他"]


def parse_with_ollama(raw_text: str) -> Dict[str, Any]:
    """
    调用 Ollama 解析消费文本，提取结构化信息。

    Args:
        raw_text: 用户原始输入

    Returns:
        {"amount": float, "category": str, "description": str}

    Raises:
        Exception: 解析失败时抛出
    """
    prompt = f"""从以下文本中提取消费信息，只返回 JSON，不要有其他内容。

类别只能是：{', '.join(CATEGORIES)}

文本：{raw_text}

返回格式：{{"amount": 数字(纯数字), "category": "类别", "description": "简短描述"}}"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": "qwen2.5:3b",
                "prompt": prompt,
                "stream": False,
                "temperature": 0.1
            },
            timeout=30
        )

        if response.status_code != 200:
            raise Exception(f"Ollama 返回错误码: {response.status_code}")

        content = response.json().get("response", "")

        # 用正则提取 JSON 部分
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if not json_match:
            raise Exception(f"无法解析 Ollama 返回值: {content}")

        result = json.loads(json_match.group())

        # 验证字段
        if "amount" not in result:
            result["amount"] = 0.0
        if "category" not in result or result["category"] not in CATEGORIES:
            result["category"] = "其他"
        if "description" not in result:
            result["description"] = raw_text[:20]

        return result

    except requests.exceptions.RequestException as e:
        raise Exception(f"Ollama 请求失败: {e}") from e
    except json.JSONDecodeError as e:
        raise Exception(f"Ollama 返回 JSON 格式错误: {e}") from e


if __name__ == "__main__":
    # 测试
    tests = [
        "今天中午和同事吃火锅花了186",
        "打车上班25元",
        "在淘宝买了件衣服399",
        "房租这个月2400",
    ]

    for text in tests:
        try:
            result = parse_with_ollama(text)
            print(f"输入: {text}")
            print(f"解析: {json.dumps(result, ensure_ascii=False)}")
            print("-" * 40)
        except Exception as e:
            print(f"❌ 解析失败: {text} -> {e}")