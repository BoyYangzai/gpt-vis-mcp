#!/bin/bash

# GPT-Vis MCP 发布脚本

set -e

echo "🚀 开始发布 GPT-Vis MCP..."

# 检查是否已登录 NPM
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ 请先登录 NPM: npm login"
    exit 1
fi

# 检查工作目录是否干净
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ 工作目录不干净，请先提交所有更改"
    exit 1
fi

# 运行测试
echo "🧪 运行测试..."
npm test

# 构建项目
echo "🔨 构建项目..."
npm run build

# 检查构建结果
if [ ! -d "dist" ]; then
    echo "❌ 构建失败，dist 目录不存在"
    exit 1
fi

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 当前版本: $CURRENT_VERSION"

# 询问版本类型
echo "请选择版本更新类型:"
echo "1) patch (修订版本)"
echo "2) minor (次版本)"
echo "3) major (主版本)"
echo "4) 跳过版本更新"

read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        npm version patch
        ;;
    2)
        npm version minor
        ;;
    3)
        npm version major
        ;;
    4)
        echo "跳过版本更新"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

# 获取新版本
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📦 新版本: $NEW_VERSION"

# 推送到 Git
if [ "$choice" != "4" ]; then
    echo "📤 推送到 Git..."
    git push origin main
    git push origin --tags
fi

# 发布到 NPM
echo "📦 发布到 NPM..."
npm publish

echo "✅ 发布成功！"
echo "🔗 NPM 链接: https://www.npmjs.com/package/gpt-vis-mcp"
echo "📊 查看统计: https://www.npmjs.com/package/gpt-vis-mcp"

# 可选：构建 Docker 镜像
read -p "是否构建 Docker 镜像? (y/n): " build_docker

if [ "$build_docker" = "y" ]; then
    echo "🐳 构建 Docker 镜像..."
    docker build -t gpt-vis-mcp:$NEW_VERSION .
    docker tag gpt-vis-mcp:$NEW_VERSION gpt-vis-mcp:latest
    docker tag gpt-vis-mcp:$NEW_VERSION boyyangzai/gpt-vis-mcp:$NEW_VERSION
    docker tag gpt-vis-mcp:$NEW_VERSION boyyangzai/gpt-vis-mcp:latest
    echo "✅ Docker 镜像构建完成"
    echo "💡 推送到 Docker Hub: docker push boyyangzai/gpt-vis-mcp:$NEW_VERSION"
    echo "💡 推送到 Docker Hub: docker push boyyangzai/gpt-vis-mcp:latest"
fi

echo "🎉 发布流程完成！" 
