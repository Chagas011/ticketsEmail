

### REALIZAR ESSAS CONFIGURACOES QUANDO E NECESSARIO REFAZER BUILD

sudo docker build -t api-tickets:dev .
sudo docker stop api-tickets
sudo docker rm api-tickets

sudo docker run -d \
  --name api-tickets \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:3001:3001 \
  api-tickets:dev