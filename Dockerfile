FROM python:3.12-slim

WORKDIR /app
COPY web /app/web
COPY server /app/server

ENV PORT=8088
EXPOSE 8088

CMD ["python", "server/api_server.py"]
