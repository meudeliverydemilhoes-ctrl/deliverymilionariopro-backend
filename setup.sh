#!/bin/bash
# ============================================
# DELIVERY MILIONÁRIO PRO - Setup Automático
# ============================================
# Execute com: chmod +x setup.sh && ./setup.sh
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   DELIVERY MILIONÁRIO PRO - Setup          ║${NC}"
echo -e "${GREEN}║   CRM + WhatsApp + IA                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# 1. Verificar pré-requisitos
echo -e "${BLUE}[1/6] Verificando pré-requisitos...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado. Instale: https://nodejs.org${NC}"
    exit 1
fi
echo -e "  ✅ Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não encontrado${NC}"
    exit 1
fi
echo -e "  ✅ npm $(npm -v)"

if command -v docker &> /dev/null; then
    echo -e "  ✅ Docker $(docker --version | cut -d' ' -f3)"
    HAS_DOCKER=true
else
    echo -e "  ${YELLOW}⚠️  Docker não encontrado (opcional, mas recomendado)${NC}"
    HAS_DOCKER=false
fi

# 2. Criar arquivo .env
echo ""
echo -e "${BLUE}[2/6] Configurando variáveis de ambiente...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "  ✅ Arquivo .env criado a partir do .env.example"
    echo ""
    echo -e "${YELLOW}  ⚠️  IMPORTANTE: Edite o arquivo .env com suas credenciais:${NC}"
    echo -e "  ${YELLOW}     - EVOLUTION_API_KEY (sua chave da Evolution API)${NC}"
    echo -e "  ${YELLOW}     - ANTHROPIC_API_KEY (crie em console.anthropic.com)${NC}"
    echo -e "  ${YELLOW}     - JWT_SECRET (gere uma chave segura)${NC}"
    echo ""
else
    echo -e "  ✅ Arquivo .env já existe"
fi

# 3. Instalar dependências
echo -e "${BLUE}[3/6] Instalando dependências...${NC}"
npm install
echo -e "  ✅ Dependências instaladas"

# 4. Criar pasta de uploads
echo ""
echo -e "${BLUE}[4/6] Criando diretórios...${NC}"
mkdir -p uploads logs
echo -e "  ✅ Pasta uploads/ criada"
echo -e "  ✅ Pasta logs/ criada"

# 5. Banco de dados
echo ""
echo -e "${BLUE}[5/6] Configurando banco de dados...${NC}"

if [ "$HAS_DOCKER" = true ]; then
    echo -e "  Iniciando PostgreSQL e Redis via Docker..."
    docker-compose up -d postgres redis 2>/dev/null || {
        echo -e "  ${YELLOW}⚠️  Não foi possível iniciar Docker. Configure o banco manualmente.${NC}"
    }
    echo -e "  ⏳ Aguardando banco iniciar (5s)..."
    sleep 5
fi

echo -e "  Executando migrations..."
npx knex migrate:latest 2>/dev/null && echo -e "  ✅ Tabelas criadas" || {
    echo -e "  ${YELLOW}⚠️  Erro nas migrations. Verifique DATABASE_URL no .env${NC}"
    echo -e "  ${YELLOW}     Se ainda não tem PostgreSQL, rode: docker-compose up -d${NC}"
}

echo -e "  Executando seeds..."
npx knex seed:run 2>/dev/null && echo -e "  ✅ Dados iniciais inseridos" || {
    echo -e "  ${YELLOW}⚠️  Erro nos seeds (pode ser que já existam)${NC}"
}

# 6. Pronto!
echo ""
echo -e "${BLUE}[6/6] Configuração concluída!${NC}"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ SETUP COMPLETO!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Para iniciar o servidor:"
echo -e "  ${BLUE}npm run dev${NC}        (desenvolvimento com hot-reload)"
echo -e "  ${BLUE}npm start${NC}          (produção)"
echo ""
echo -e "  Para iniciar tudo com Docker:"
echo -e "  ${BLUE}docker-compose up -d${NC}"
echo ""
echo -e "  API rodando em: ${GREEN}http://localhost:3000${NC}"
echo -e "  Health check:   ${GREEN}http://localhost:3000/health${NC}"
echo ""
echo -e "${YELLOW}  📋 CHECKLIST antes de usar:${NC}"
echo -e "  ${YELLOW}  [ ] Editar .env com suas chaves${NC}"
echo -e "  ${YELLOW}  [ ] Configurar webhook na Evolution API${NC}"
echo -e "  ${YELLOW}  [ ] Criar chave Anthropic (console.anthropic.com)${NC}"
echo -e "  ${YELLOW}  [ ] Escanear QR Code do WhatsApp${NC}"
echo ""
