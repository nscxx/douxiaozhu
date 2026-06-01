# 豆小助后端服务

Express + SQLite 后端，替代 Coze 工作流 + 飞书多维表格方案。

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 服务默认运行在 http://localhost:3000
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| DB_PATH | 数据库文件路径 | ./data/douxiaozhu.db |

## API 接口

### 通用响应格式
```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```
- `code: 0` 表示成功
- `code: 400` 参数错误
- `code: 404` 资源不存在
- `code: 500` 服务器错误

### 仪表盘
- `GET /api/dashboard` - 首页统计数据

### 账号
- `GET /api/accounts` - 账号列表（?status=&keyword=&page=&page_size=）
- `GET /api/accounts/:id` - 账号详情
- `POST /api/accounts` - 创建账号
- `POST /api/accounts/batch` - 批量导入
- `PUT /api/accounts/:id` - 更新账号
- `DELETE /api/accounts/:id` - 删除账号

### 电影
- `GET /api/movies` - 电影列表（?keyword=&page=&page_size=）
- `GET /api/movies/:id` - 电影详情
- `POST /api/movies` - 创建电影
- `POST /api/movies/batch` - 批量导入
- `PUT /api/movies/:id` - 更新电影
- `DELETE /api/movies/:id` - 删除电影

### 任务
- `GET /api/tasks` - 任务列表（?status=&movie_id=&account_id=&page=&page_size=）
- `POST /api/tasks` - 创建任务
- `POST /api/tasks/from-movie` - 从电影创建任务
- `POST /api/tasks/from-time` - 从时间创建任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 标签
- `GET /api/tags` - 标签列表（?category=A/B/C/D）
- `GET /api/tags/grouped` - 按分类分组返回
- `POST /api/tags` - 创建标签
- `POST /api/tags/batch` - 批量创建
- `DELETE /api/tags/:id` - 删除标签

### 内容
- `GET /api/contents` - 内容列表（?status=&task_id=&page=&page_size=）
- `POST /api/contents` - 创建内容
- `PUT /api/contents/:id` - 更新内容
- `DELETE /api/contents/:id` - 删除内容

### 凭证审核
- `GET /api/credentials` - 凭证列表（?status=&page=&page_size=）
- `POST /api/credentials` - 创建凭证
- `PUT /api/credentials/:id` - 更新凭证
- `PUT /api/credentials/:id/audit` - 审核凭证（action: approve/reject）
- `DELETE /api/credentials/:id` - 删除凭证

### AI 生成
- `POST /api/ai/generate` - AI内容生成（待接入火山引擎API）
- `POST /api/ai/batch-generate` - 批量AI生成（待接入）

### 其他
- `GET /api/health` - 健康检查

## 部署

### PM2 启动
```bash
npm install -g pm2
pm2 start app.js --name douxiaozhu
pm2 save
pm2 startup
```

### Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 数据备份

SQLite 数据库文件在 `./data/douxiaozhu.db`，备份只需拷贝该文件：
```bash
cp data/douxiaozhu.db data/douxiaozhu_backup_$(date +%Y%m%d).db
```
