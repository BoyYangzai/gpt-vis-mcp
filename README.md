# GPT-Vis MCP Server

一个基于 MCP (Model Context Protocol) 的智能数据可视化工具，当用户提出数据分析需求时，自动判断并生成相应的图表。

## 安装

### 使用 npx (推荐)

```bash
npx gpt-vis-mcp
```

### 使用 npm

```bash
npm install -g gpt-vis-mcp
```

### 使用 Docker

```bash
docker run -p 3000:3000 boyyangzai/gpt-vis-mcp
```

## 配置

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "gpt-vis": {
      "command": "npx",
      "args": ["gpt-vis-mcp"]
    }
  }
}
```

### Cursor

在 MCP 设置中添加：

```json
{
  "mcpServers": {
    "gpt-vis": {
      "command": "npx",
      "args": ["gpt-vis-mcp"]
    }
  }
}
```

## 功能

### 智能判断工具

- 自动识别用户问题是否需要数据可视化
- 基于关键词和语义分析，推荐合适的图表类型
- 触发词汇：统计、分析、对比、趋势、分布、占比等

### 图表生成工具

- 基于用户数据创建可视化图表
- 支持多种图表类型：柱状图、折线图、饼图、散点图等
- 输出标准的 vis-chart 格式

## 示例

用户输入：

```
"帮我统计淮安平均月收入"
```

系统自动：

1. 判断需要可视化
2. 推荐柱状图
3. 生成模拟数据
4. 输出图表配置

输出格式：

```vis-chart
{
  "type": "column",
  "data": [
    {"category": "教育行业", "value": 6500},
    {"category": "IT行业", "value": 8200}
  ],
  "title": "淮安市各行业平均月收入统计",
  "xField": "category",
  "yField": "value"
}
```

## 开发

```bash
# 克隆项目
git clone https://github.com/BoyYangzai/gpt-vis-mcp.git
cd gpt-vis-mcp

# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test
```

## License

MIT
