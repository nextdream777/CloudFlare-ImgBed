# File Distribution 领域业务硬规则 (Business Rules)

1. **缓存控制**: 静态图片文件必须默认配置长期浏览器与边缘缓存（`public, max-age=31536000, immutable`）。
2. **防盗链阻断**: 当开启防盗链且请求的 `Referer` 不在白名单时，返回 403 Forbidden 或预设的防盗链占位图。
3. **安全 MIME 映射**: 禁止通过文件分发端点直接作为可执行脚本或 HTML 执行（防止 XSS 攻击），必须强制正确的 `Content-Type` 与安全 Header。
