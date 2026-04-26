# NBestWorkFinder 辅助投递浏览器插件

第一版面向 Chrome 和 Edge，核心流程是：打开岗位详情页，点击插件采集岗位信息，导入本地 NBestWorkFinder 后进入职位工作台。

## 使用方式

1. 启动后端服务，默认地址为 `http://localhost:8080`。
2. 启动前端服务，默认地址为 `http://localhost:5173`。
3. 在 Chrome 或 Edge 打开扩展管理页。
4. 开启开发者模式。
5. 选择“加载已解压的扩展程序”，目录选择 `browser-extension`。
6. 登录 NBestWorkFinder，在浏览器控制台执行：

```js
JSON.parse(localStorage.getItem('nbwf_auth_session')).accessToken
```

7. 把得到的 `accessToken` 粘贴到插件弹窗的“登录 Token”里并保存。
8. 打开 BOSS 直聘岗位详情页，点击“采集并导入当前岗位”。

## 第一版范围

- 优先支持 Chrome 和 Edge。
- 优先支持 BOSS 直聘岗位详情页。
- 插件只采集当前用户已经打开的页面，不做批量爬取、不绕过登录、不自动发送消息。
- 导入成功后会打开 `职位工作台` 并定位到导入岗位。

## 已采集字段

- 职位标题
- 公司名称
- 工作地点
- 薪资文本
- 岗位描述
- 技术标签
- 来源平台
- 原始链接
- 外部职位 ID

## 注意

当前插件需要手动粘贴登录 Token。后续可以优化为前端页面授权或一次性插件授权码，避免用户手动复制 Token。
