# Sentiment Monitor — Backend Server

轻量后端服务，为品牌舆情监控产品提供 Mock 数据 API。

## 快速启动

```bash
cd sentiment-monitor/server
npm install
npm start
# 服务默认运行在 http://localhost:3001
```

## API 说明

### 关键词管理

| 方法   | 路径                    | 描述           |
|--------|-------------------------|----------------|
| GET    | /api/keywords           | 获取关键词列表 |
| POST   | /api/keywords           | 添加关键词     |
| DELETE | /api/keywords/:id       | 删除关键词     |

```bash
# 获取关键词列表
curl http://localhost:3001/api/keywords

# 添加关键词
curl -X POST http://localhost:3001/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"name": "小米"}'

# 删除关键词
curl -X DELETE http://localhost:3001/api/keywords/1
```

### 用户之声（Mentions）

**GET /api/mentions**

| 参数       | 类型   | 说明                                          |
|------------|--------|-----------------------------------------------|
| keyword    | string | 关键词过滤，多个用逗号分隔                    |
| channel    | string | 渠道过滤：新闻/微博/抖音/快手/小红书/主流媒体 |
| from       | string | 开始时间 ISO8601，如 2025-06-01               |
| to         | string | 结束时间 ISO8601                              |
| sentiment  | string | 情感：positive / negative / neutral           |
| page       | number | 页码，默认 1                                  |
| page_size  | number | 每页条数，默认 20，最大 100                   |

```bash
# 查询星巴克最近负面评论
curl "http://localhost:3001/api/mentions?keyword=星巴克&sentiment=negative&page_size=5"

# 查询微博渠道
curl "http://localhost:3001/api/mentions?channel=微博&page=1&page_size=10"
```

### 洞察分析

**GET /api/insights/summary** — 情感分布、渠道分布、TopN 关键词、时间趋势

| 参数    | 说明         |
|---------|--------------|
| keyword | 关键词过滤   |
| from    | 开始时间     |
| to      | 结束时间     |

```bash
curl "http://localhost:3001/api/insights/summary?keyword=蔚来"
```

**GET /api/insights/wordcloud** — 词云数据 `[{word, weight, sentiment}]`

```bash
curl "http://localhost:3001/api/insights/wordcloud?keyword=星巴克"
```

### 报告导出

**GET /api/report/export** — 返回 HTML 报告，可在浏览器另存为 PDF

| 参数    | 说明                           |
|---------|--------------------------------|
| keyword | 关键词过滤                     |
| from    | 开始时间                       |
| to      | 结束时间                       |
| format  | 格式（目前仅支持 html，默认值） |

```bash
# 浏览器打开或 curl 保存
curl "http://localhost:3001/api/report/export?keyword=星巴克&from=2025-06-01" -o report.html
open report.html
```

## Mock 数据策略

- **Mock 数量**：启动时内存中生成 **310 条** Mentions，覆盖最近 30 天。
- **品牌**：以「星巴克」「蔚来」为主，各自有专属场景文案（咖啡体验、换电模式等）。
- **渠道**：6 个渠道均匀分布 — 新闻、微博、抖音、快手、小红书、主流媒体。
- **情感标签**：正面约 40%、负面约 35%、中性约 25%，分布有随机性。
- **数据生成文件**：`mock/seed.js`，服务启动时懒加载入内存，不持久化。

## 技术栈

- Node.js + Express
- cors、dayjs（无需外网大依赖）
- 无数据库，全内存 Mock

## 目录结构

```
sentiment-monitor/server/
├── index.js           # 入口，挂载所有路由
├── package.json
├── README.md
├── mock/
│   └── seed.js        # Mock 数据生成器
└── routes/
    ├── keywords.js    # 关键词 CRUD
    ├── mentions.js    # 用户之声列表
    ├── insights.js    # 洞察分析（summary + wordcloud）
    └── report.js      # HTML 报告导出
```
