FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="Aneiang ERD Studio" \
      org.opencontainers.image.description="数据库 ER 图在线设计平台（纯前端、离线可用、私有化部署）" \
      org.opencontainers.image.licenses="MIT"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
