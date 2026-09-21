# Auth 领域业务硬规则 (Business Rules)

1. **密码保护**: 严禁在任何接口响应或日志中明文打印管理员密码或敏感 Token。
2. **防爆破机制**: 连续登录失败达到阈值应触发限流延迟或临时锁定。
3. **Session 校验**: 中间件 `_middleware.js` 统一校验 Header / Cookie，失效或未携带凭证一律返回 401 Unauthorized。
