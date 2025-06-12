import fs from 'fs-extra';
import * as path from 'path';
import { ChartType, VisChartConfig } from '../types/chart.js';

export interface MCPClient {
  createMessage(request: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: {
        type: 'text';
        text: string;
      };
    }>;
    systemPrompt?: string;
    maxTokens: number;
    modelPreferences?: {
      hints?: Array<{ name: string }>;
      intelligencePriority?: number;
      speedPriority?: number;
      costPriority?: number;
    };
  }): Promise<{
    content: {
      type: 'text';
      text: string;
    };
    model: string;
    stopReason?: string;
  }>;
}

export interface VisualizationIntent {
  intention?: string;
  dataSource: {
    data: any[];
    metas?: any[];
  };
  chartType?: string;
}



export interface ChartExample {
  question: string;
  answer: any;
  chartType: string;
}

export class RAGService {
  private knowledgeBase: ChartExample[] = [];
  private supportedChartTypes: Set<string> = new Set();
  private mcpClient?: MCPClient;

  setMCPClient(client: MCPClient) {
    this.mcpClient = client;
  }

  async loadKnowledgeBase(): Promise<void> {
    try {
      console.log('📚 从knowledge目录加载标准化图表知识库...');

      const knowledgesPath = path.join(process.cwd(), 'knowledges');

      if (!(await fs.pathExists(knowledgesPath))) {
        console.warn('⚠️ knowledges目录不存在');
        return;
      }

      const files = await fs.readdir(knowledgesPath);

      for (const file of files) {
        if (file.endsWith('.md') && !file.includes('知识库总览')) {
          const filePath = path.join(knowledgesPath, file);

          try {
            const content = await fs.readFile(filePath, 'utf-8');

            // 从文件名提取图表类型 (e.g., "饼图 - Pie Chart.md" -> "pie")
            const chartTypeName = file.replace('.md', '').split(' - ')[1];
            if (chartTypeName) {
              const chartTypeKey = this.getChartTypeKey(chartTypeName);
              this.supportedChartTypes.add(chartTypeKey);

              // 解析markdown内容提取使用示例
              const examples = this.extractExamplesFromMarkdown(content, chartTypeKey);

              // 保存到知识库
              this.knowledgeBase.push(...examples);
            }
          } catch (error) {
            console.warn(`⚠️ 无法解析知识文档 ${file}:`, error instanceof Error ? error.message : error);
          }
        }
      }

      console.log(`📊 知识库加载完成，包含 ${this.knowledgeBase.length} 个示例`);
      console.log(`🎨 支持的图表类型 (${this.supportedChartTypes.size}种): ${Array.from(this.supportedChartTypes).join(', ')}`);
    } catch (error) {
      console.error('❌ 知识库加载失败:', error);
    }
  }

  private getChartTypeKey(chartTypeName: string): string {
    const typeMapping: { [key: string]: string } = {
      'Pie Chart': 'pie',
      'Line Chart': 'line',
      'Bar Chart': 'bar',
      'Column Chart': 'column',
      'Scatter Chart': 'scatter',
      'Area Chart': 'area',
      'Radar Chart': 'radar',
      'Mind Map': 'mind-map',
      'WordCloud Chart': 'word-cloud',
      'Treemap Chart': 'treemap',
      'Histogram Chart': 'histogram',
      'Flow Diagram': 'flow',
      'Network Graph': 'network',
      'Organization Chart': 'organization',
      'DualAxes Chart': 'dual-axes',
      'Fishbone Diagram': 'fishbone',
      'PinMap': 'pin-map',
      'HeatMap': 'heatmap',
      'Vis Text': 'vis-text'
    };

    return typeMapping[chartTypeName] || chartTypeName.toLowerCase();
  }

  private extractExamplesFromMarkdown(content: string, chartType: string): ChartExample[] {
    const examples: ChartExample[] = [];

    // 查找使用示例部分
    const exampleMatch = content.match(/## 使用示例\s*([\s\S]*?)(?=##|$)/);
    if (!exampleMatch) return examples;

    const exampleSection = exampleMatch[1];

    // 提取每个示例（以数字开头）
    const examplePattern = /(\d+\.\s*[^`]*?)```json\s*([\s\S]*?)```/g;
    let match;

    while ((match = examplePattern.exec(exampleSection)) !== null) {
      const questionText = match[1].trim();
      const jsonText = match[2].trim();

      try {
        const answer = JSON.parse(jsonText);
        examples.push({
          question: questionText,
          answer: answer,
          chartType: chartType
        });
      } catch (e) {
        console.warn(`⚠️ 无法解析JSON示例: ${e instanceof Error ? e.message : e}`);
      }
    }

    return examples;
  }

  async recommendChartType(intent: VisualizationIntent): Promise<{ type: string; confidence: number; reason: string }> {
    // 如果用户已指定类型，直接返回
    if (intent.chartType && this.supportedChartTypes.has(intent.chartType)) {
      return {
        type: intent.chartType,
        confidence: 1.0,
        reason: '用户指定的图表类型'
      };
    }

    // 基于数据特征进行推荐
    return this.analyzeDataForRecommendation(intent);
  }

  private analyzeDataForRecommendation(intent: VisualizationIntent): { type: string; confidence: number; reason: string } {
    const data = intent.dataSource.data;
    if (!data || data.length === 0) {
      return { type: 'bar', confidence: 0.5, reason: '数据为空，使用默认柱状图' };
    }

    const firstRow = data[0];
    const fields = Object.keys(firstRow);
    const numericFields = fields.filter(field => typeof firstRow[field] === 'number');
    const stringFields = fields.filter(field => typeof firstRow[field] === 'string');

    // 时间序列数据
    const timeFields = fields.filter(field =>
      field.toLowerCase().includes('time') ||
      field.toLowerCase().includes('date') ||
      field.toLowerCase().includes('年') ||
      field.toLowerCase().includes('月')
    );

    if (timeFields.length > 0 && numericFields.length > 0) {
      return { type: 'line', confidence: 0.9, reason: '包含时间字段，适合显示趋势' };
    }

    // 分类数据占比
    if (stringFields.length === 1 && numericFields.length === 1) {
      return { type: 'pie', confidence: 0.8, reason: '适合显示分类数据的占比关系' };
    }

    // 多维数值比较
    if (numericFields.length >= 2) {
      return { type: 'scatter', confidence: 0.7, reason: '多个数值字段适合散点图' };
    }

    // 默认柱状图
    return { type: 'bar', confidence: 0.6, reason: '通用的数据比较图表' };
  }

  async createVisualization(intent: VisualizationIntent): Promise<VisChartConfig> {
    const chartType = intent.chartType || (await this.recommendChartType(intent)).type;

    // 查找最相似的示例
    const template = this.findBestTemplate(intent, chartType);

    if (template) {
      return this.generateFromTemplate(intent, template);
    } else {
      // 没有找到模板，使用基础生成
      return this.generateBasicChart(intent, chartType);
    }
  }

  private findBestTemplate(intent: VisualizationIntent, chartType: string): ChartExample | null {
    // 过滤出相同类型的模板
    const typeTemplates = this.knowledgeBase.filter(example => example.chartType === chartType);

    if (typeTemplates.length === 0) return null;

    // 如果有用户意图，进行语义匹配
    if (intent.intention) {
      const keywords = intent.intention.toLowerCase().split(/\s+/);
      let bestTemplate = null;
      let bestScore = 0;

      for (const template of typeTemplates) {
        const questionWords = template.question.toLowerCase().split(/\s+/);
        const matches = keywords.filter(keyword =>
          questionWords.some(word => word.includes(keyword) || keyword.includes(word))
        );

        const score = matches.length / keywords.length;
        if (score > bestScore) {
          bestScore = score;
          bestTemplate = template;
        }
      }

      if (bestScore > 0.2) return bestTemplate;
    }

    // 返回第一个匹配的模板
    return typeTemplates[0];
  }

  private generateFromTemplate(intent: VisualizationIntent, template: ChartExample): VisChartConfig {
    const answer = template.answer;
    const userData = intent.dataSource.data;

    const config: VisChartConfig = {
      type: answer.type as ChartType,
      data: this.transformDataToStandardFormat(userData, answer.type, answer)
    };

    // 智能生成标题
    config.title = intent.intention || answer.title || `${answer.type}图表`;

    // 添加其他配置
    if (answer.axisXTitle) config.axisXTitle = answer.axisXTitle;
    if (answer.axisYTitle) config.axisYTitle = answer.axisYTitle;
    if (answer.innerRadius) config.innerRadius = answer.innerRadius;

    return config;
  }

  private transformDataToStandardFormat(userData: any[], chartType: string, templateAnswer: any): any {
    if (chartType === 'mind-map') {
      // 思维导图保持模板结构，只替换根节点名称
      if (templateAnswer.data && templateAnswer.data.name) {
        return {
          ...templateAnswer.data,
          name: userData.length > 0 ? userData[0].name || templateAnswer.data.name : templateAnswer.data.name
        };
      }
      return templateAnswer.data;
    }

    if (chartType === 'pie') {
      // 饼图需要转换为{category, value}格式
      return userData.map(item => {
        const keys = Object.keys(item);
        const valueField = keys.find(key => typeof item[key] === 'number');
        const categoryField = keys.find(key => typeof item[key] === 'string');

        return {
          category: categoryField ? item[categoryField] : (item.name || '未知'),
          value: valueField ? item[valueField] : 0
        };
      });
    }

    // 其他图表类型直接使用原始数据
    return userData;
  }

  private generateBasicChart(intent: VisualizationIntent, chartType: string): VisChartConfig {
    return {
      type: chartType as ChartType,
      data: intent.dataSource.data,
      title: intent.intention || `${chartType}图表`
    };
  }

  getSupportedChartTypes(): string[] {
    return Array.from(this.supportedChartTypes);
  }

  async analyzeDataRequest(request: string): Promise<{
    suggestion: string;
    confidence: number;
    reason: string;
    chartType: ChartType;
    data: any[];
  }> {
    // 基于用户请求分析并生成建议
    const lowerRequest = request.toLowerCase();

    // 识别关键词并推荐图表类型
    let chartType: ChartType = 'bar';
    let confidence = 0.7;
    let reason = '基于请求内容的推荐';

    if (lowerRequest.includes('收入') || lowerRequest.includes('工资') || lowerRequest.includes('薪资')) {
      if (lowerRequest.includes('平均') || lowerRequest.includes('统计')) {
        chartType = 'bar';
        reason = '收入统计适合使用柱状图进行对比分析';
        confidence = 0.9;
      } else if (lowerRequest.includes('趋势') || lowerRequest.includes('变化')) {
        chartType = 'line';
        reason = '收入趋势适合使用折线图显示变化';
        confidence = 0.85;
      }
    } else if (lowerRequest.includes('占比') || lowerRequest.includes('比例') || lowerRequest.includes('构成')) {
      chartType = 'pie';
      reason = '占比分析适合使用饼图显示构成关系';
      confidence = 0.9;
    } else if (lowerRequest.includes('分布') || lowerRequest.includes('分散')) {
      chartType = 'histogram';
      reason = '分布分析适合使用直方图显示数据分布';
      confidence = 0.8;
    } else if (lowerRequest.includes('关系') || lowerRequest.includes('相关')) {
      chartType = 'scatter';
      reason = '关系分析适合使用散点图显示相关性';
      confidence = 0.85;
    }

    // 生成模拟数据
    const data = this.generateMockData(request, chartType);
    const suggestion = this.generateSuggestion(request, chartType);

    return {
      suggestion,
      confidence,
      reason,
      chartType,
      data
    };
  }

  private generateMockData(request: string, chartType: ChartType): any[] {
    const lowerRequest = request.toLowerCase();

    // 收入相关数据
    if (lowerRequest.includes('收入') || lowerRequest.includes('工资') || lowerRequest.includes('薪资')) {
      if (lowerRequest.includes('淮安')) {
        if (chartType === 'bar' || chartType === 'column') {
          return [
            { 区域: '清江浦区', 平均月收入: 4200 },
            { 区域: '淮阴区', 平均月收入: 3800 },
            { 区域: '淮安区', 平均月收入: 3600 },
            { 区域: '洪泽区', 平均月收入: 3900 },
            { 区域: '涟水县', 平均月收入: 3200 },
            { 区域: '盱眙县', 平均月收入: 3400 },
            { 区域: '金湖县', 平均月收入: 3700 }
          ];
        } else if (chartType === 'line') {
          return [
            { 年份: '2020', 平均月收入: 3200 },
            { 年份: '2021', 平均月收入: 3500 },
            { 年份: '2022', 平均月收入: 3800 },
            { 年份: '2023', 平均月收入: 4100 },
            { 年份: '2024', 平均月收入: 4200 }
          ];
        }
      } else {
        // 通用收入数据
        if (chartType === 'bar' || chartType === 'column') {
          return [
            { 行业: 'IT互联网', 平均月收入: 8500 },
            { 行业: '金融业', 平均月收入: 7200 },
            { 行业: '教育培训', 平均月收入: 5800 },
            { 行业: '医疗健康', 平均月收入: 6500 },
            { 行业: '制造业', 平均月收入: 5200 }
          ];
        }
      }
    }

    // 销售相关数据
    if (lowerRequest.includes('销售') || lowerRequest.includes('营收') || lowerRequest.includes('业绩')) {
      if (chartType === 'line') {
        return [
          { 月份: '1月', 销售额: 120 },
          { 月份: '2月', 销售额: 135 },
          { 月份: '3月', 销售额: 158 },
          { 月份: '4月', 销售额: 142 },
          { 月份: '5月', 销售额: 168 },
          { 月份: '6月', 销售额: 195 }
        ];
      } else if (chartType === 'bar' || chartType === 'column') {
        return [
          { 产品: '产品A', 销售额: 250 },
          { 产品: '产品B', 销售额: 180 },
          { 产品: '产品C', 销售额: 320 },
          { 产品: '产品D', 销售额: 145 }
        ];
      }
    }

    // 人口或用户相关数据
    if (lowerRequest.includes('人口') || lowerRequest.includes('用户') || lowerRequest.includes('人数')) {
      if (chartType === 'pie') {
        return [
          { category: '18-25岁', value: 25 },
          { category: '26-35岁', value: 35 },
          { category: '36-45岁', value: 22 },
          { category: '46岁以上', value: 18 }
        ];
      }
    }

    // 成绩或评分相关数据  
    if (lowerRequest.includes('成绩') || lowerRequest.includes('分数') || lowerRequest.includes('评分')) {
      if (chartType === 'bar' || chartType === 'column') {
        return [
          { 科目: '数学', 平均分: 85 },
          { 科目: '语文', 平均分: 78 },
          { 科目: '英语', 平均分: 82 },
          { 科目: '物理', 平均分: 75 },
          { 科目: '化学', 平均分: 80 }
        ];
      }
    }

    // 通用模拟数据生成
    switch (chartType) {
      case 'bar':
      case 'column':
        return [
          { 类别: '类别A', 数值: 100 },
          { 类别: '类别B', 数值: 80 },
          { 类别: '类别C', 数值: 120 },
          { 类别: '类别D', 数值: 90 }
        ];
      case 'pie':
        return [
          { category: '部分A', value: 30 },
          { category: '部分B', value: 25 },
          { category: '部分C', value: 20 },
          { category: '部分D', value: 25 }
        ];
      case 'line':
        return [
          { time: '1月', value: 100 },
          { time: '2月', value: 120 },
          { time: '3月', value: 110 },
          { time: '4月', value: 130 }
        ];
      case 'scatter':
        return [
          { x: 10, y: 20 },
          { x: 15, y: 25 },
          { x: 20, y: 30 },
          { x: 25, y: 35 }
        ];
      default:
        return [
          { name: '项目1', value: 100 },
          { name: '项目2', value: 80 },
          { name: '项目3', value: 120 }
        ];
    }
  }

  private generateSuggestion(request: string, chartType: ChartType): string {
    const lowerRequest = request.toLowerCase();

    if (lowerRequest.includes('淮安') && lowerRequest.includes('收入')) {
      if (chartType === 'bar') {
        return '淮安市各区县平均月收入对比分析';
      } else if (chartType === 'line') {
        return '淮安市近年来平均月收入变化趋势';
      }
    }

    // 基于图表类型生成通用建议
    const chartNames: Record<ChartType, string> = {
      'bar': '柱状图对比分析',
      'column': '柱状图对比分析',
      'line': '趋势变化分析',
      'pie': '占比构成分析',
      'scatter': '相关性分析',
      'area': '面积趋势分析',
      'radar': '多维度对比分析',
      'heatmap': '热力分布分析',
      'histogram': '数据分布分析',
      'treemap': '层次结构分析',
      'word-cloud': '词频分析',
      'network-graph': '网络关系分析',
      'mind-map': '思维导图分析',
      'flow-diagram': '流程分析',
      'funnel': '漏斗分析',
      'dual-axes-chart': '双轴对比分析'
    };

    return chartNames[chartType] || `${chartType}数据分析`;
  }

  async generateChartFromQuestion(question: string): Promise<VisChartConfig> {
    // 分析问题并生成图表建议
    const analysis = await this.analyzeDataRequest(question);

    // 直接生成可视化图表
    return await this.createVisualization({
      dataSource: {
        data: analysis.data
      },
      intention: analysis.suggestion,
      chartType: analysis.chartType
    });
  }

  shouldVisualize(userInput: string): {
    shouldVisualize: boolean;
    reason: string;
    suggestedChartType?: ChartType;
    confidence: number;
  } {
    const input = userInput.toLowerCase();

    // 明确的数据可视化关键词
    const visualizationKeywords = [
      '统计', '分析', '对比', '比较', '趋势', '变化', '分布', '占比', '比例',
      '收入', '工资', '薪资', '销售', '营收', '业绩', '成绩', '分数', '评分',
      '图表', '柱状图', '折线图', '饼图', '条形图', '散点图', '雷达图',
      '显示', '展示', '可视化', '画图', '生成图'
    ];

    // 数据相关的动词
    const dataVerbs = ['帮我', '请', '查看', '看', '了解', '知道'];

    // 检查是否包含可视化关键词
    const hasVisualizationKeyword = visualizationKeywords.some(keyword =>
      input.includes(keyword)
    );

    // 检查是否包含数据动词
    const hasDataVerb = dataVerbs.some(verb => input.includes(verb));

    if (hasVisualizationKeyword) {
      let suggestedChartType: ChartType = 'bar';
      let reason = '检测到数据分析相关的关键词';

      // 根据关键词推荐图表类型
      if (input.includes('趋势') || input.includes('变化')) {
        suggestedChartType = 'line';
        reason = '检测到趋势分析需求，适合使用折线图';
      } else if (input.includes('占比') || input.includes('比例') || input.includes('构成')) {
        suggestedChartType = 'pie';
        reason = '检测到占比分析需求，适合使用饼图';
      } else if (input.includes('分布')) {
        suggestedChartType = 'histogram';
        reason = '检测到分布分析需求，适合使用直方图';
      } else if (input.includes('关系') || input.includes('相关')) {
        suggestedChartType = 'scatter';
        reason = '检测到关系分析需求，适合使用散点图';
      } else if (input.includes('统计') || input.includes('对比') || input.includes('比较')) {
        suggestedChartType = 'bar';
        reason = '检测到统计对比需求，适合使用柱状图';
      }

      return {
        shouldVisualize: true,
        reason,
        suggestedChartType,
        confidence: 0.9
      };
    }

    // 检查是否是隐式的数据请求（有动词但没有明确的可视化关键词）
    if (hasDataVerb && (
      input.includes('收入') || input.includes('薪资') || input.includes('工资') ||
      input.includes('销售') || input.includes('业绩') || input.includes('成绩') ||
      input.includes('人口') || input.includes('用户') || input.includes('数据')
    )) {
      return {
        shouldVisualize: true,
        reason: '检测到数据查询需求，数据可视化能提供更好的理解',
        suggestedChartType: 'bar',
        confidence: 0.7
      };
    }

    // 不需要可视化的情况
    return {
      shouldVisualize: false,
      reason: '未检测到明确的数据分析或可视化需求',
      confidence: 0.8
    };
  }
} 
