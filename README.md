# 豆小助

豆瓣内容运营系统：PC 管理后台选题 / AI 生成 / 终审；执行者在小程序或 H5 领取任务、手工发帖后上传凭证；AI 预审 + 管理员终审。

## 启动

```bash
cd server
npm install
npm start
```

- 管理后台：http://localhost:3001/  （admin / admin123）
- 执行者 H5：http://localhost:3001/worker/  （worker / worker123）
- 审核员：reviewer / reviewer123

**请立即修改默认密码。** 飞书/Coze 已移除，请到飞书开放平台作废历史上泄露过的 App Secret。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| PORT | 端口 | 3001 |
| DB_PATH | SQLite 路径 | ./data/douxiaozhu.db |
| JWT_SECRET | JWT 密钥 | 开发默认值，生产必须改 |
| VOLCENGINE_API_KEY | 火山引擎 API Key | 空则使用本地模板生成 |
| VOLCENGINE_MODEL | 模型名 | doubao-pro-32k |
| UPLOAD_DIR | 凭证截图目录 | ./uploads |

设置页可将 AI 提供方切到「火山引擎」。无 Key 时用模板生成，便于把领取→凭证→双审闭环跑通。

## 微信小程序

见 [`miniprogram/README.md`](miniprogram/README.md)。未拿到 AppID 前用 `/worker/` H5。

## 备份

```bash
cd server && npm run backup
```

进程内每天 03:15 也会自动备份到 `data/backups/`。

## 部署

参考 [`deploy/nginx.conf`](deploy/nginx.conf) 与 [`deploy/ecosystem.config.js`](deploy/ecosystem.config.js)。
