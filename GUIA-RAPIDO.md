# Delivery Milionário Pro - Guia Rápido

## Seus dados da Evolution API
- URL: `https://evolution-api-production-36e1.up.railway.app`
- Instância: `meudelivery`
- Versão: 2.3.7

## Passo 1: Configurar o .env

```bash
cp .env.example .env
```

Edite o `.env` e preencha:

```
EVOLUTION_API_KEY=<sua chave da Evolution API - clique no olho no painel para ver>
ANTHROPIC_API_KEY=<crie em console.anthropic.com>
```

## Passo 2: Criar chave Anthropic (Claude)

1. Acesse https://console.anthropic.com
2. Crie uma conta com email/Google
3. Vá em **Settings > API Keys**
4. Clique **Create Key**
5. Copie a chave (começa com `sk-ant-`)
6. Cole no `.env`

## Passo 3: Instalar e rodar

```bash
chmod +x setup.sh
./setup.sh
npm run dev
```

Ou com Docker:

```bash
docker-compose up -d
```

## Passo 4: Configurar Webhook

Depois que o backend estiver rodando, configure o webhook para receber mensagens.

Acesse:
```
POST http://localhost:3000/api/v1/whatsapp/setup-webhook
Body: { "url": "https://seu-dominio.com/api/v1/whatsapp/webhook" }
```

## Passo 5: Conectar WhatsApp

```
POST http://localhost:3000/api/v1/whatsapp/connect
```

Escaneie o QR Code que aparecer.

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/v1/auth/register | Criar conta |
| POST | /api/v1/auth/login | Login |
| GET | /api/v1/whatsapp/status | Status do WhatsApp |
| POST | /api/v1/whatsapp/connect | Conectar WhatsApp |
| POST | /api/v1/whatsapp/send | Enviar mensagem |
| GET | /api/v1/leads | Listar leads |
| GET | /api/v1/conversations | Listar conversas |
| GET | /api/v1/reports/dashboard | Dashboard |
