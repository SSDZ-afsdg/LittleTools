# 📐 智能记账系统 - 详细设计文档

> **版本**：v1.0  
> **最后更新**：2026-07-06  
> **状态**：✅ 已确认


## 1. 数据库详细设计（DDL）


### 1.1 数据库概述

| 项目 | 内容 |
|---|---|
| **数据库类型** | MySQL 8.0+ |
| **字符集** | utf8mb4 |
| **排序规则** | utf8mb4_unicode_ci |
| **数据库名** | `smart_accounting` |
| **引擎** | InnoDB |


### 1.2 建库语句

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS `smart_accounting`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `smart_accounting`
```
### 1.3 表结构：expenses（消费记录表）

```sql
CREATE TABLE `expenses` (
    -- ===== 主键 =====
    `id` VARCHAR(36) NOT NULL COMMENT 'UUID，与手机端一致',
    
    -- ===== 用户输入 =====
    `raw_text` VARCHAR(500) NOT NULL COMMENT '用户原始输入文本',
    
    -- ===== 核心字段 =====
    `amount` DECIMAL(10, 2) NOT NULL COMMENT '金额（精确到分）',
    `category` VARCHAR(20) NOT NULL COMMENT '类别：餐饮/交通/购物/娱乐/居住/医疗/教育/其他',
    `description` VARCHAR(200) DEFAULT NULL COMMENT '简短描述',
    `date` DATETIME NOT NULL COMMENT '消费日期时间',
    
    -- ===== AI 解析 =====
    `ai_parsed` JSON DEFAULT NULL COMMENT 'Ollama 解析结果（JSON格式）',
    
    -- ===== 系统字段 =====
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    `synced_at` DATETIME DEFAULT NULL COMMENT '同步到电脑的时间',
    
    -- ===== 状态 =====
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '软删除：0-正常，1-已删除',
    `version` INT NOT NULL DEFAULT 1 COMMENT '版本号，每次修改 +1，用于冲突检测',
    
    -- ===== 索引 =====
    PRIMARY KEY (`id`),
    INDEX `idx_date` (`date`),
    INDEX `idx_category` (`category`),
    INDEX `idx_deleted` (`is_deleted`),
    INDEX `idx_date_category` (`date`, `category`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消费记录表';
```

### 1.4 字段说明
| 字段        | 类型          | 必填 | 说明                             | 示例                                                         |
| ----------- | ------------- | ---- | -------------------------------- | ------------------------------------------------------------ |
| id          | VARCHAR(36)   | ✅    | UUID v4，手机端生成              | 550e8400-e29b-41d4-a716-446655440000                          |
| raw_text    | VARCHAR(500)  | ✅    | 用户原话，保留用于后续分析       | 今天中午和同事吃火锅花了186                                   |
| amount      | DECIMAL(10,2) | ✅    | 金额，DECIMAL 避免浮点误差       | 186.00                                                       |
| category    | VARCHAR(20)   | ✅    | 固定分类，应用层校验             | 餐饮                                                         |
| description | VARCHAR(200)  | ❌    | 简短描述，从 raw_text 提取       | 和同事吃火锅                                                 |
| date        | DATETIME      | ✅    | 用户消费时间，非录入时间         | 2026-07-06 12:30:00                                          |
| ai_parsed   | JSON          | ❌    | 存完整 AI 响应，方便调试         | `{"amount":186,"category":"餐饮","description":"和同事吃火锅"}` |
| created_at  | DATETIME      | ✅    | 记录首次创建时间                 | 2026-07-06 12:35:00                                          |
| synced_at   | DATETIME      | ❌    | 同步时间，NULL 表示未同步        | 2026-07-06 20:00:00                                          |
| is_deleted  | TINYINT(1)    | ✅    | 软删除，默认 0                   | 0                                                            |
| version     | INT           | ✅    | 冲突检测，每次 UPDATE 自动 +1    | 3                                                            |

### 1.5 索引说明
| 索引名          | 字段           | 用途                         |
| --------------- | -------------- | ---------------------------- |
| PRIMARY         | id             | 主键查询                     |
| idx_date        | date           | 按月/日查询                  |
| idx_category    | category       | 按类别筛选                   |
| idx_deleted     | is_deleted     | 过滤已删除记录               |
| idx_date_category | date, category | 月度类别统计（GROUP BY）     |

### 1.6 查询示例

```sql
-- 查询本月所有正常记录
SELECT * FROM expenses 
WHERE YEAR(date) = 2026 AND MONTH(date) = 7 
  AND is_deleted = 0 
ORDER BY date DESC;

-- 本月各类别汇总
SELECT category, SUM(amount) as total, COUNT(*) as count
FROM expenses 
WHERE YEAR(date) = 2026 AND MONTH(date) = 7 AND is_deleted = 0
GROUP BY category
ORDER BY total DESC;

-- 本月每日趋势
SELECT DATE(date) as day, SUM(amount) as daily_total
FROM expenses 
WHERE YEAR(date) = 2026 AND MONTH(date) = 7 AND is_deleted = 0
GROUP BY DATE(date)
ORDER BY day;

-- 检测冲突（手机端 version 与电脑端不一致）
SELECT id, version as computer_version
FROM expenses 
WHERE id = 'test-001' AND version != 2;
```