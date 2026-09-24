FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json requirements.txt ./

RUN npm ci --omit=dev \
    && python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

COPY . .

ENV SPIRASCAN_PYTHON=/app/.venv/bin/python

EXPOSE 3000

CMD ["npm", "start"]