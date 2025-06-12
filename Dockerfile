FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制构建后的文件
COPY dist/ ./dist/
COPY README.md ./

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口（如果需要）
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"] 
