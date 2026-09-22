# Crawl Readiness MCP server — stdio transport.
#
# Registries such as Glama build this image to introspect the tool list and
# grade the server; end users normally run `npx -y crawl-readiness-mcp`
# instead. The image needs outbound HTTPS to www.crawlreadiness.com at run
# time; CRAWL_READINESS_API_KEY is optional (audit tools work without it).
FROM node:22-alpine

WORKDIR /app

# There is deliberately no lockfile in this repo (see .gitignore), so this is
# `npm install`, not `npm ci`. Only the two runtime dependencies are pulled.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production

# stdio MCP: the client speaks JSON-RPC over this process's stdin/stdout.
ENTRYPOINT ["node", "src/index.js"]
