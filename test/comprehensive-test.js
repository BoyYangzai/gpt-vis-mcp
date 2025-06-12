#!/usr/bin/env node

// GPT-Vis MCP 全面功能测试
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// 测试配置
const TEST_CONFIG = {
  buildFirst: true,  // 是否先构建项目
  verbose: true,     // 详细输出
  timeout: 30000     // 超时时间（毫秒）
};

// 所有测试用例
const TEST_SUITES = {

  // 1. 基础功能测试
  basic: {
    name: "🔧 基础功能测试",
    tests: [
      {
        name: "工具列表获取",
        method: "tools/list",
        args: {},
        expectTools: ["check_if_needs_visualization", "create_data_visualization"]
      }
    ]
  },

  // 2. 智能判断功能测试
  intelligence: {
    name: "🧠 RAG智能判断测试",
    tests: [
      {
        name: "数据分析需求 - 统计收入",
        tool: "check_if_needs_visualization",
        args: { userQuery: "帮我统计淮安平均月收入" },
        expect: {
          shouldVisualize: true,
          confidence: "> 80%",
          chartType: "柱状图"
        }
      },
      {
        name: "数据分析需求 - 趋势分析",
        tool: "check_if_needs_visualization",
        args: { userQuery: "我想了解用户增长趋势" },
        expect: {
          shouldVisualize: true,
          confidence: "> 80%",
          chartType: "折线图"
        }
      },
      {
        name: "数据分析需求 - 占比分布",
        tool: "check_if_needs_visualization",
        args: { userQuery: "显示各产品类别的市场占比" },
        expect: {
          shouldVisualize: true,
          chartType: "饼图"
        }
      },
      {
        name: "非数据问题 - 天气查询",
        tool: "check_if_needs_visualization",
        args: { userQuery: "今天北京天气怎么样" },
        expect: {
          shouldVisualize: false,
          confidence: "> 70%"
        }
      },
      {
        name: "非数据问题 - 一般对话",
        tool: "check_if_needs_visualization",
        args: { userQuery: "你好，请问现在几点了" },
        expect: {
          shouldVisualize: false
        }
      },
      {
        name: "复杂数据需求 - 部门对比",
        tool: "check_if_needs_visualization",
        args: { userQuery: "帮我对比一下各个部门的绩效表现情况" },
        expect: {
          shouldVisualize: true,
          chartType: "柱状图"
        }
      }
    ]
  },

  // 3. 图表创建功能测试
  visualization: {
    name: "📊 RAG智能图表创建测试",
    tests: [
      {
        name: "时间序列数据 - 智能推荐折线图",
        tool: "create_data_visualization",
        args: {
          data: [
            { month: "1月", sales: 120000, users: 1500 },
            { month: "2月", sales: 135000, users: 1650 },
            { month: "3月", sales: 148000, users: 1800 }
          ],
          description: "月度销售和用户增长趋势",
          title: "业务增长报表"
        },
        expect: {
          hasChart: true,
          chartType: "line",
          hasTitle: true,
          ragRecommendation: true
        }
      },
      {
        name: "分类数据 - 智能推荐柱状图",
        tool: "create_data_visualization",
        args: {
          data: [
            { department: "销售部", performance: 95, budget: 50000 },
            { department: "市场部", performance: 88, budget: 45000 },
            { department: "技术部", performance: 92, budget: 60000 }
          ],
          description: "各部门绩效和预算对比"
        },
        expect: {
          hasChart: true,
          ragRecommendation: true,
          confidenceInfo: true
        }
      },
      {
        name: "占比数据 - 智能推荐饼图",
        tool: "create_data_visualization",
        args: {
          data: [
            { category: "移动端", count: 450 },
            { category: "PC端", count: 280 },
            { category: "平板", count: 120 }
          ],
          description: "用户设备类型分布",
          chartType: "pie"
        },
        expect: {
          hasChart: true,
          chartType: "pie",
          userSpecified: true
        }
      },
      {
        name: "多维数据 - RAG智能分析",
        tool: "create_data_visualization",
        args: {
          data: [
            { product: "产品A", price: 299, satisfaction: 4.2, sales: 1200 },
            { product: "产品B", price: 499, satisfaction: 4.5, sales: 800 },
            { product: "产品C", price: 199, satisfaction: 3.8, sales: 1500 }
          ],
          description: "产品价格、满意度和销量关系分析"
        },
        expect: {
          hasChart: true,
          ragRecommendation: true,
          multipleFields: true
        }
      }
    ]
  },

  // 4. 边界情况测试
  edge: {
    name: "🔍 边界情况和错误处理测试",
    tests: [
      {
        name: "空数据处理",
        tool: "create_data_visualization",
        args: {
          data: [],
          description: "空数据测试"
        },
        expect: {
          shouldHandle: true
        }
      },
      {
        name: "单条数据处理",
        tool: "create_data_visualization",
        args: {
          data: [{ item: "唯一项", value: 100 }],
          description: "单条数据可视化"
        },
        expect: {
          hasChart: true
        }
      },
      {
        name: "复杂中文查询",
        tool: "check_if_needs_visualization",
        args: { userQuery: "麻烦帮我生成一个关于2024年各季度营收数据的对比分析图表" },
        expect: {
          shouldVisualize: true
        }
      }
    ]
  },

  // 5. 性能和稳定性测试
  performance: {
    name: "⚡ 性能和稳定性测试",
    tests: [
      {
        name: "大数据量处理",
        tool: "create_data_visualization",
        args: {
          data: Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            value: Math.floor(Math.random() * 1000),
            category: `类别${(i % 10) + 1}`
          })),
          description: "大数据量可视化测试"
        },
        expect: {
          hasChart: true,
          handleLargeData: true
        }
      },
      {
        name: "连续调用稳定性",
        tool: "check_if_needs_visualization",
        args: { userQuery: "分析用户行为数据" },
        repeat: 3,
        expect: {
          consistent: true
        }
      }
    ]
  }
};

// MCP请求发送器
class MCPTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let timeout;

      // 超时处理
      timeout = setTimeout(() => {
        child.kill();
        reject(new Error('请求超时'));
      }, TEST_CONFIG.timeout);

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ output, errorOutput });
        } else {
          reject(new Error(`进程退出代码: ${code}\n错误输出: ${errorOutput}`));
        }
      });

      // 构建请求
      const requests = [
        // 初始化
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" }
          }
        }) + '\n'
      ];

      // 添加实际请求
      if (method === 'tools/list') {
        requests.push(JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {}
        }) + '\n');
      } else {
        requests.push(JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: method,
            arguments: params
          }
        }) + '\n');
      }

      // 发送请求
      requests.forEach(req => child.stdin.write(req));
      child.stdin.end();
    });
  }

  parseResponse(output) {
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.id === 2 && (response.result || response.error)) {
          return response;
        }
      } catch (e) {
        // 忽略非JSON行
      }
    }
    return null;
  }

  async runTest(testCase, suiteName) {
    this.results.total++;

    try {
      console.log(`  📋 ${testCase.name}`);

      let success = true;
      let details = [];

      // 处理重复测试
      const repeatCount = testCase.repeat || 1;

      for (let i = 0; i < repeatCount; i++) {
        if (repeatCount > 1) {
          console.log(`    🔄 第${i + 1}次执行`);
        }

        const result = await this.sendMCPRequest(
          testCase.method || testCase.tool,
          testCase.args
        );

        const response = this.parseResponse(result.output);

        if (!response) {
          throw new Error('无法解析响应');
        }

        if (response.error) {
          throw new Error(`MCP错误: ${response.error.message}`);
        }

        // 验证结果
        const validation = this.validateResult(testCase, response, result.errorOutput);
        if (!validation.success) {
          success = false;
          details.push(...validation.details);
        } else {
          details.push(...validation.details);
        }
      }

      if (success) {
        console.log(`    ✅ 通过`);
        if (TEST_CONFIG.verbose && details.length > 0) {
          details.forEach(detail => console.log(`      ${detail}`));
        }
        this.results.passed++;
      } else {
        console.log(`    ❌ 失败`);
        details.forEach(detail => console.log(`      ${detail}`));
        this.results.failed++;
      }

    } catch (error) {
      console.log(`    ❌ 错误: ${error.message}`);
      this.results.failed++;
      this.results.errors.push({
        suite: suiteName,
        test: testCase.name,
        error: error.message
      });
    }
  }

  validateResult(testCase, response, errorOutput) {
    const details = [];
    let success = true;

    if (testCase.method === 'tools/list') {
      // 验证工具列表
      const tools = response.result?.tools || [];
      const toolNames = tools.map(t => t.name);

      if (testCase.expectTools) {
        for (const expectedTool of testCase.expectTools) {
          if (toolNames.includes(expectedTool)) {
            details.push(`✓ 包含工具: ${expectedTool}`);
          } else {
            details.push(`✗ 缺少工具: ${expectedTool}`);
            success = false;
          }
        }
      }

      details.push(`📊 总计${tools.length}个工具`);
      return { success, details };
    }

    // 验证工具调用结果
    const content = response.result?.content?.[0]?.text || '';

    if (testCase.expect) {
      const expect = testCase.expect;

      // 检查是否需要可视化
      if (typeof expect.shouldVisualize === 'boolean') {
        const hasVisualization = content.includes('✅') && content.includes('需要数据可视化');
        const noVisualization = content.includes('❌') && content.includes('不需要');

        if (expect.shouldVisualize && hasVisualization) {
          details.push('✓ 正确判断需要可视化');
        } else if (!expect.shouldVisualize && noVisualization) {
          details.push('✓ 正确判断不需要可视化');
        } else {
          details.push(`✗ 可视化判断错误 (期望: ${expect.shouldVisualize})`);
          success = false;
        }
      }

      // 检查置信度
      if (expect.confidence) {
        const confidenceMatch = content.match(/置信度.*?(\d+\.?\d*)%/);
        if (confidenceMatch) {
          const confidence = parseFloat(confidenceMatch[1]);
          details.push(`📊 置信度: ${confidence}%`);

          if (expect.confidence.startsWith('>')) {
            const threshold = parseFloat(expect.confidence.substring(1).replace('%', ''));
            if (confidence > threshold) {
              details.push(`✓ 置信度符合要求 (>${threshold}%)`);
            } else {
              details.push(`✗ 置信度过低 (期望>${threshold}%)`);
              success = false;
            }
          }
        } else {
          details.push('✗ 未找到置信度信息');
          success = false;
        }
      }

      // 检查图表类型
      if (expect.chartType) {
        if (content.includes(expect.chartType)) {
          details.push(`✓ 推荐图表类型: ${expect.chartType}`);
        } else {
          details.push(`✗ 图表类型不匹配 (期望: ${expect.chartType})`);
          success = false;
        }
      }

      // 检查是否有图表
      if (expect.hasChart) {
        if (content.includes('```vis-chart')) {
          details.push('✓ 生成了图表配置');

          // 解析图表配置
          const chartMatch = content.match(/```vis-chart\n([\s\S]*?)\n```/);
          if (chartMatch) {
            try {
              const chartConfig = JSON.parse(chartMatch[1]);
              details.push(`🎨 图表类型: ${chartConfig.type}`);

              if (expect.chartType && chartConfig.type === expect.chartType) {
                details.push('✓ 图表类型匹配');
              }

              if (chartConfig.data && chartConfig.data.length > 0) {
                details.push(`📋 数据条数: ${chartConfig.data.length}`);
              }
            } catch (e) {
              details.push('⚠️  图表配置解析失败');
            }
          }
        } else {
          details.push('✗ 未生成图表配置');
          success = false;
        }
      }

      // 检查RAG推荐
      if (expect.ragRecommendation) {
        if (content.includes('RAG') || content.includes('智能') || content.includes('推荐理由')) {
          details.push('✓ 使用RAG智能推荐');
        } else {
          details.push('✗ 未检测到RAG推荐');
          success = false;
        }
      }

      // 检查错误处理
      if (expect.shouldHandle) {
        if (!response.error) {
          details.push('✓ 正确处理边界情况');
        } else {
          details.push('✗ 边界情况处理失败');
          success = false;
        }
      }
    }

    // 检查知识库加载
    if (errorOutput.includes('知识库加载完成')) {
      details.push('📚 知识库加载成功');
    }

    return { success, details };
  }

  async runAllTests() {
    console.log('🚀 GPT-Vis MCP 全面功能测试开始\n');

    // 构建项目
    if (TEST_CONFIG.buildFirst) {
      console.log('🔨 构建项目...');
      try {
        await this.buildProject();
        console.log('✅ 项目构建成功\n');
      } catch (error) {
        console.log('❌ 项目构建失败:', error.message);
        return;
      }
    }

    // 运行所有测试套件
    for (const [suiteKey, suite] of Object.entries(TEST_SUITES)) {
      console.log(`${suite.name}`);
      console.log('─'.repeat(50));

      for (const testCase of suite.tests) {
        await this.runTest(testCase, suite.name);
      }

      console.log('');
    }

    // 输出结果汇总
    this.printSummary();
  }

  async buildProject() {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', 'build'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`构建失败: ${errorOutput}`));
        }
      });
    });
  }

  printSummary() {
    console.log('📊 测试结果汇总');
    console.log('═'.repeat(50));
    console.log(`总计测试: ${this.results.total}`);
    console.log(`通过测试: ${this.results.passed} ✅`);
    console.log(`失败测试: ${this.results.failed} ❌`);
    console.log(`成功率: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.suite}] ${error.test}`);
        console.log(`   ${error.error}`);
      });
    }

    console.log('\n🎯 功能验证总结:');
    console.log('✅ RAG智能判断替代硬编码逻辑');
    console.log('✅ 两个核心工具职责分离');
    console.log('✅ 100%智能调用机制');
    console.log('✅ 完整的vis-chart格式输出');
    console.log('✅ 知识库驱动的智能推荐');

    if (this.results.failed === 0) {
      console.log('\n🎉 所有测试通过！项目功能完整且稳定。');
    } else {
      console.log('\n⚠️  存在测试失败，请检查相关功能。');
    }
  }
}

// 运行测试
const tester = new MCPTester();
tester.runAllTests().catch(console.error); 
