#!/usr/bin/env node

/**
 * GPT-Vis MCP 安装验证脚本
 * 用于验证包是否正确安装和配置
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 验证 GPT-Vis MCP 安装...\n');

// 检查 Node.js 版本
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

console.log(`📋 Node.js 版本: ${nodeVersion}`);
if (majorVersion < 18) {
  console.log('❌ 需要 Node.js 18 或更高版本');
  process.exit(1);
} else {
  console.log('✅ Node.js 版本符合要求');
}

// 检查包是否存在
try {
  const packagePath = join(__dirname, '../package.json');
  const pkg = await import(packagePath, { assert: { type: 'json' } });
  console.log(`📦 包名: ${pkg.default.name}`);
  console.log(`📦 版本: ${pkg.default.version}`);
  console.log('✅ 包文件存在');
} catch (error) {
  console.log('❌ 无法读取 package.json');
  console.log(error.message);
  process.exit(1);
}

// 检查构建文件
try {
  const distPath = join(__dirname, '../dist/index.js');
  await import(distPath);
  console.log('✅ 构建文件存在且可执行');
} catch (error) {
  console.log('❌ 构建文件不存在或无法执行');
  console.log('💡 请运行: npm run build');
  process.exit(1);
}

// 测试 MCP 服务器启动
console.log('\n🧪 测试 MCP 服务器启动...');

const testServer = spawn('node', [join(__dirname, '../dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let hasError = false;

testServer.stdout.on('data', (data) => {
  output += data.toString();
});

testServer.stderr.on('data', (data) => {
  const errorText = data.toString();
  // 忽略启动成功的消息
  if (!errorText.includes('启动成功') && !errorText.includes('ExperimentalWarning')) {
    console.log('❌ 服务器启动错误:');
    console.log(errorText);
    hasError = true;
  }
});

// 5秒后终止测试
setTimeout(() => {
  testServer.kill();

  if (!hasError) {
    console.log('✅ MCP 服务器可以正常启动');
    console.log('\n🎉 安装验证完成！');
    console.log('\n📖 使用说明:');
    console.log('1. 在 Cursor/Claude Desktop 中配置 MCP 服务器');
    console.log('2. 使用以下配置:');
    console.log('   {');
    console.log('     "mcpServers": {');
    console.log('       "gpt-vis": {');
    console.log('         "command": "npx",');
    console.log('         "args": ["gpt-vis-mcp"]');
    console.log('       }');
    console.log('     }');
    console.log('   }');
    console.log('\n🔗 更多信息: https://github.com/BoyYangzai/gpt-vis-mcp');
  }

  process.exit(hasError ? 1 : 0);
}, 5000); 
