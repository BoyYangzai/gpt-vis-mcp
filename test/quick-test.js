#!/usr/bin/env node

// 快速功能测试 - 验证核心需求
import { spawn } from 'child_process';

const QUICK_TESTS = [
  {
    name: "✅ 100%智能调用测试",
    tool: "check_if_needs_visualization",
    args: { userQuery: "帮我统计淮安平均月收入" },
    expect: "需要可视化"
  },
  {
    name: "❌ 正确拒绝非数据问题",
    tool: "check_if_needs_visualization",
    args: { userQuery: "今天天气怎么样" },
    expect: "不需要可视化"
  },
  {
    name: "📊 RAG智能图表创建",
    tool: "create_data_visualization",
    args: {
      data: [
        { category: "教育", value: 6500 },
        { category: "IT", value: 8200 }
      ],
      title: "行业收入对比"
    },
    expect: "生成图表"
  }
];

async function sendRequest(tool, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => output += data.toString());
    child.stderr.on('data', (data) => errorOutput += data.toString());

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ output, errorOutput });
      } else {
        reject(new Error(`退出码: ${code}`));
      }
    });

    const requests = [
      JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: {
          protocolVersion: "2024-11-05", capabilities: {},
          clientInfo: { name: "quick-test", version: "1.0.0" }
        }
      }) + '\n',
      JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: tool, arguments: args }
      }) + '\n'
    ];

    requests.forEach(req => child.stdin.write(req));
    child.stdin.end();
  });
}

async function runQuickTest() {
  console.log('🚀 GPT-Vis MCP 快速功能验证\n');

  let passed = 0;
  let total = QUICK_TESTS.length;

  for (const test of QUICK_TESTS) {
    console.log(`📋 ${test.name}`);

    try {
      const result = await sendRequest(test.tool, test.args);

      const lines = result.output.split('\n').filter(line => line.trim());
      const response = lines.find(line => {
        try {
          const parsed = JSON.parse(line);
          return parsed.id === 2 && parsed.result;
        } catch { return false; }
      });

      if (response) {
        const content = JSON.parse(response).result.content?.[0]?.text || '';

        let success = false;
        if (test.expect === "需要可视化" && content.includes('✅') && (
          content.includes('需要数据可视化') ||
          content.includes('建议创建数据可视化图表') ||
          content.includes('最终智能判断')
        )) {
          success = true;
        } else if (test.expect === "不需要可视化" && content.includes('❌') && content.includes('不需要')) {
          success = true;
        } else if (test.expect === "生成图表" && content.includes('```vis-chart')) {
          success = true;
        }

        if (success) {
          console.log('  ✅ 通过');
          passed++;
        } else {
          console.log('  ❌ 失败');
        }

        // 显示关键信息
        if (content.includes('置信度')) {
          const confidenceMatch = content.match(/置信度.*?(\d+\.?\d*)%/);
          if (confidenceMatch) {
            console.log(`  📊 置信度: ${confidenceMatch[1]}%`);
          }
        }

        if (content.includes('RAG') || content.includes('智能')) {
          console.log('  🤖 使用RAG智能分析');
        }

      } else {
        console.log('  ❌ 无响应');
      }

    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);
    }

    console.log('');
  }

  console.log(`📊 结果: ${passed}/${total} 通过 (${((passed / total) * 100).toFixed(1)}%)`);

  if (passed === total) {
    console.log('🎉 所有核心功能正常！');
  } else {
    console.log('⚠️  部分功能需要检查');
  }
}

runQuickTest().catch(console.error); 
