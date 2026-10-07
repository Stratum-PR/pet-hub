# ATH Móvil API simulator from @stratum-pr/payments (Stratum-PR/payment_methods, simulator/athmovil).
# Local tests only. server.mjs and core.mjs are copied by scripts/sync-payment-libs.sh; don't edit them here.
FROM node:22-alpine
WORKDIR /app
COPY server.mjs core.mjs ./
ENV PORT=4010
EXPOSE 4010
USER node
HEALTHCHECK --interval=5s --timeout=3s --retries=10 CMD wget -qO- http://localhost:4010/health || exit 1
CMD ["node", "server.mjs"]
