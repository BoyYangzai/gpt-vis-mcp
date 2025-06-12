#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { RAGService, VisualizationIntent } from './services/rag-service-simple.js';
import type { ChartType, DataMeta } from './types/chart.js';

// 参数验证模式
const CheckVisualizationArgsSchema = z.object({
  userQuery: z.string().describe('用户的完整问题或请求')
});

const CreateVisualizationArgsSchema = z.object({
  data: z.array(z.record(z.unknown())).optional().describe('用户数据数组（可选，如果没有则自动生成模拟数据）'),
  title: z.string().optional().describe('图表标题（可选）'),
  description: z.string().optional().describe('数据描述或可视化意图（可选）'),
  chartType: z.string().optional().describe('指定的图表类型（可选）'),
  userQuery: z.string().optional().describe('用户原始问题（用于生成模拟数据）')
});

class ChartRecommendationMCPServer {
  private server: Server;
  private ragService: RAGService;

  constructor() {
    this.server = new Server(
      {
        name: 'gpt-vis-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 初始化RAG服务
    this.ragService = new RAGService();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'check_if_needs_visualization',
            description: '🚨 REQUIRED FINAL STEP: 在完成所有数据收集和分析后，必须最后调用此工具判断是否需要可视化。无论之前调用了多少其他工具（web_search、数据查询等），对于任何涉及数据、统计、分析的问题，都必须在最后用此工具检查是否需要图表来提升用户体验。这是数据相关问题的强制最后一步。',
            inputSchema: {
              type: 'object',
              properties: {
                userQuery: {
                  type: 'string',
                  description: '用户的完整问题或请求'
                }
              },
              required: ['userQuery']
            }
          },
          {
            name: 'create_data_visualization',
            description: '📊 IMMEDIATE FOLLOW-UP: 当check_if_needs_visualization判断需要可视化时，必须立即调用此工具创建图表。生成完整的vis-chart配置后，必须将```vis-chart代码块复制到最终回答中，确保用户能看到可视化结果。支持使用web_search等工具获取的真实数据。',
            inputSchema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: { type: 'object' },
                  description: '用户数据数组（可选，如果没有则自动生成模拟数据）'
                },
                title: {
                  type: 'string',
                  description: '图表标题（可选）'
                },
                description: {
                  type: 'string',
                  description: '数据描述或可视化意图（可选）'
                },
                chartType: {
                  type: 'string',
                  description: '指定的图表类型（可选）'
                },
                userQuery: {
                  type: 'string',
                  description: '用户原始问题（用于生成模拟数据）'
                }
              },
              required: []
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'check_if_needs_visualization':
            return await this.handleCheckIfNeedsVisualization(args);

          case 'create_data_visualization':
            return await this.handleCreateDataVisualization(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Tool ${name} error:`, error);
        throw error;
      }
    });
  }

  private async handleCheckIfNeedsVisualization(args: unknown) {
    const validatedArgs = CheckVisualizationArgsSchema.parse(args);

    console.log('🤖 使用RAG智能判断是否需要可视化:', {
      userQuery: validatedArgs.userQuery
    });

    // 加载知识库并使用RAG进行智能判断
    await this.ragService.loadKnowledgeBase();
    const analysis = this.ragService.shouldVisualize(validatedArgs.userQuery);

    if (analysis.shouldVisualize) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ 最终智能判断：基于您的问题和已收集的信息，建议创建数据可视化图表！\n\n💡 **AI分析说明**: ${analysis.reason}\n📊 **推荐图表**: ${analysis.suggestedChartType ? this.getChartTypeName(analysis.suggestedChartType) : '智能推荐'}\n🎯 **置信度**: ${(analysis.confidence * 100).toFixed(1)}%\n\n🚨 **CRITICAL REQUIREMENT**: \n1. 立即调用 create_data_visualization 工具生成图表\n2. 将生成的 \`\`\`vis-chart 代码块完整复制到最终回答中\n3. 确保用户能在最终回答中看到可视化图表\n\n📝 **原始问题**: "${validatedArgs.userQuery}"\n💾 **数据来源**: 使用之前工具收集的数据，或自动生成相关模拟数据\n🎨 **必须输出**: 包含vis-chart代码块的完整回答`
          }
        ]
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 最终智能判断：根据您的问题"${validatedArgs.userQuery}"和已收集的信息，${analysis.reason}，不需要生成数据可视化图表。\n\n🎯 **置信度**: ${(analysis.confidence * 100).toFixed(1)}%\n📝 **结论**: 当前问题更适合文本回答，无需图表展示。`
          }
        ]
      };
    }
  }

  private async handleCreateDataVisualization(args: unknown) {
    const validatedArgs = CreateVisualizationArgsSchema.parse(args);

    // 如果没有提供数据，根据用户问题生成模拟数据
    let data: Record<string, any>[] = validatedArgs.data || [];
    if (data.length === 0) {
      data = this.generateMockData(validatedArgs.userQuery || validatedArgs.description || '');
      console.log('🔧 自动生成模拟数据:', data.length, '条记录');
    }

    console.log('🤖 使用RAG服务创建可视化:', {
      dataLength: data.length,
      title: validatedArgs.title,
      description: validatedArgs.description,
      chartType: validatedArgs.chartType
    });

    // 加载知识库
    await this.ragService.loadKnowledgeBase();

    // 构建可视化意图
    const intent: VisualizationIntent = {
      dataSource: {
        data: data,
        metas: this.inferDataMetas(data)
      },
      intention: validatedArgs.description,
      chartType: validatedArgs.chartType
    };

    // 使用RAG推荐图表类型
    const recommendation = await this.ragService.recommendChartType(intent);
    console.log(`🎯 RAG推荐图表类型: ${recommendation.type} (置信度: ${(recommendation.confidence * 100).toFixed(1)}%)`);

    // 使用RAG创建可视化
    const visChart = await this.ragService.createVisualization({
      ...intent,
      chartType: recommendation.type
    });

    // 设置标题
    if (validatedArgs.title) {
      visChart.title = validatedArgs.title;
    }

    let responseText = '';

    if (validatedArgs.title) {
      responseText += `# ${validatedArgs.title}\n\n`;
    }

    responseText += `🤖 使用RAG智能生成了一个${this.getChartTypeName(recommendation.type as ChartType)}\n\n`;
    responseText += `💡 **推荐理由**: ${recommendation.reason}\n`;
    responseText += `🎯 **置信度**: ${(recommendation.confidence * 100).toFixed(1)}%\n\n`;

    // 生成vis-chart代码块
    responseText += '```vis-chart\n';
    responseText += JSON.stringify(visChart, null, 2);
    responseText += '\n```\n\n';

    responseText += `🚨 **CRITICAL**: 请将上面的 \`\`\`vis-chart 代码块完整复制到您的最终回答中！\n\n`;
    responseText += `✨ 这个图表基于RAG知识库智能生成。用户的前端组件可以直接渲染vis-chart格式。\n\n`;
    responseText += `📋 **必须包含在最终回答中的内容**:\n`;
    responseText += `\`\`\`vis-chart\n${JSON.stringify(visChart, null, 2)}\n\`\`\``;

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  }

  // 生成模拟数据
  private generateMockData(userQuery: string): Record<string, any>[] {
    const query = userQuery.toLowerCase();

    // 根据关键词生成相应的模拟数据
    if (query.includes('淮安') && (query.includes('收入') || query.includes('薪资') || query.includes('工资'))) {
      return [
        { industry: '教育行业', avgIncome: 6500, count: 1200 },
        { industry: 'IT行业', avgIncome: 8200, count: 800 },
        { industry: '制造业', avgIncome: 5800, count: 1500 },
        { industry: '服务业', avgIncome: 5200, count: 2000 },
        { industry: '公务员', avgIncome: 7200, count: 600 }
      ];
    }

    if (query.includes('趋势') || query.includes('增长')) {
      return [
        { month: '1月', value: 120, users: 1500 },
        { month: '2月', value: 135, users: 1650 },
        { month: '3月', value: 148, users: 1800 },
        { month: '4月', value: 162, users: 1950 },
        { month: '5月', value: 178, users: 2100 },
        { month: '6月', value: 195, users: 2300 }
      ];
    }

    if (query.includes('占比') || query.includes('分布') || query.includes('比例')) {
      return [
        { category: '移动端', count: 450, percentage: 52.3 },
        { category: 'PC端', count: 280, percentage: 32.6 },
        { category: '平板', count: 130, percentage: 15.1 }
      ];
    }

    if (query.includes('部门') || query.includes('绩效') || query.includes('对比')) {
      return [
        { department: '销售部', performance: 95, budget: 50000 },
        { department: '市场部', performance: 88, budget: 45000 },
        { department: '技术部', performance: 92, budget: 60000 },
        { department: '运营部', performance: 85, budget: 40000 }
      ];
    }

    // 默认通用数据
    return [
      { name: '项目A', value: 120, score: 85 },
      { name: '项目B', value: 98, score: 92 },
      { name: '项目C', value: 156, score: 78 },
      { name: '项目D', value: 134, score: 88 }
    ];
  }

  // 推断数据元信息
  private inferDataMetas(data: Record<string, any>[]): DataMeta[] {
    if (data.length === 0) return [];

    const sample = data[0];
    return Object.entries(sample).map(([name, value]) => ({
      name,
      dataType: this.inferDataType(value)
    }));
  }

  private inferDataType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (typeof value === 'string') {
      // 简单的日期检测
      if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return 'date';
      }
      return 'string';
    }
    return 'string';
  }

  private getChartTypeName(type: ChartType): string {
    const typeNames: Record<ChartType, string> = {
      'line': '折线图',
      'column': '柱状图',
      'bar': '条形图',
      'pie': '饼图',
      'scatter': '散点图',
      'area': '面积图',
      'radar': '雷达图',
      'heatmap': '热力图',
      'histogram': '直方图',
      'treemap': '矩形树图',
      'word-cloud': '词云图',
      'network-graph': '网络图',
      'mind-map': '思维导图',
      'flow-diagram': '流程图',
      'funnel': '漏斗图',
      'dual-axes-chart': '双轴图'
    };
    return typeNames[type] || '图表';
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🤖 GPT-Vis MCP Server 启动成功 (基于RAG智能推荐)');
  }
}

const server = new ChartRecommendationMCPServer();
server.run().catch(console.error); 
