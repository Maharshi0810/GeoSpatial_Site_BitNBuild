FROM node:20-slim

WORKDIR /app

# Copy dependency definitions
COPY frontend/package.json frontend/package-lock.json* /app/
RUN npm install

# Copy frontend source code
COPY frontend/ /app/

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
