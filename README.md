<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="WEB/public/brand/vetra-logo-dark.png" />
    <img src="WEB/public/brand/vetra-logo-light.png" alt="Vetra.AI" width="560" />
  </picture>
</p>

<h1 align="center">Vetra.AI</h1>

<p align="center">Cadastre rostos e identifique pessoas a partir de uma foto ou da câmera.</p>

<p align="center">
  <a href="#sobre-o-projeto">Sobre</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#execução-local">Execução local</a> ·
  <a href="#api-http">API HTTP</a> ·
  <a href="#contribuindo">Contribuir</a>
</p>

## Sobre o projeto

O **Vetra.AI** é uma aplicação de cadastro e reconhecimento facial. A interface permite capturar uma foto pela câmera, enviar uma imagem, cadastrar uma pessoa, consultar uma identidade e gerenciar os registros existentes.

O processamento acontece na API: a imagem é validada, o rosto é detectado e convertido em uma representação numérica. Essa representação é comparada com os cadastros armazenados no banco.

### Funcionalidades

- Cadastro facial com nome e imagem.
- Reconhecimento a partir de arquivo ou captura da câmera.
- Resultado com nome, identificador, distância e índice de similaridade retornados pela API.
- Listagem e exclusão de pessoas cadastradas.
- Seleção de câmera e mensagens para falhas de acesso, dispositivo ausente ou interrupção do vídeo.
- Temas claro e escuro com preferência salva no navegador e transição de cores.
- Menu lateral recolhível no desktop e menu de hambúrguer no celular.
- Notificações de sucesso e erro no cadastro.

O horário exibido na identificação corresponde à consulta atual na interface; não existe histórico persistido de reconhecimentos.

## Tecnologias

<p align="center">
  <img src="DOCS/assets/imagens/tecnologias.svg" alt="Angular, TypeScript, HTML, CSS, Python, FastAPI, TensorFlow, OpenCV, PostgreSQL, Docker e Git" width="660" />
</p>

| Parte | Tecnologias e responsabilidades |
| --- | --- |
| Interface | Angular 22, TypeScript, HTML, CSS e RxJS. |
| API | Python, FastAPI, Pydantic e upload multipart. |
| Processamento facial | DeepFace, FaceNet512, OpenCV, NumPy e TensorFlow/Keras. |
| Persistência | PostgreSQL 18, pgvector, SQLAlchemy e psycopg. |
| Migrações | Alembic para versionamento do esquema do banco. |
| Ambiente local | Docker Compose para o PostgreSQL. API e WEB executados separadamente. |
| Verificação do WEB | Vitest, jsdom e Prettier. |
| Ícones | SVGs adaptados do Lucide Animated, sob licença MIT. |

As dependências Python estão em [requirements.txt](API/requirements.txt). As versões do frontend e seus comandos estão em [package.json](WEB/package.json).

## Arquitetura

A API organiza as responsabilidades em rotas, serviços, repositórios, modelos e contratos de entrada e saída.

```mermaid
flowchart LR
    Usuario[Usuário] --> WEB[Interface Angular]
    WEB --> HTTP[Rotas FastAPI]
    HTTP --> Servico[Serviço facial]
    Servico --> Imagem[Detecção e recorte do rosto]
    Imagem --> Vetor[Geração do embedding]
    Vetor --> Repositorio[Repositório SQLAlchemy]
    Repositorio --> Banco[(PostgreSQL e pgvector)]
```

| Caminho | Responsabilidade |
| --- | --- |
| `WEB/src/app/app.*` | Navegação, câmera, formulários, resultados e diretório de pessoas. |
| `WEB/src/app/services/face.service.ts` | Cliente HTTP utilizado pela interface. |
| `WEB/src/app/models/face.model.ts` | Contratos TypeScript das respostas. |
| `WEB/src/styles.css` e `WEB/src/shell.css` | Cores, temas, menu lateral e elementos compartilhados. |
| `WEB/public/brand` | Logos para os temas claro e escuro. |
| `API/app/routers` | Endpoints e integração com os serviços. |
| `API/app/services` | Leitura da imagem, detecção do rosto, embeddings e operações faciais. |
| `API/app/repositories` | Consultas e persistência dos cadastros. |
| `API/app/models` | Modelo relacional e coluna vetorial. |
| `API/app/schemas` | Contratos Pydantic de resposta. |
| `API/app/database` | Conexão, configuração e sessões do banco. |
| `API/alembic` | Migrações do esquema. |
| `API/infra` | Docker Compose, exemplo de ambiente e inicialização do pgvector. |

### Dados armazenados

Cada cadastro contém UUID, nome, embedding de 512 dimensões e data de criação. O modelo atual não possui coluna para armazenar a fotografia original. A imagem enviada é processada para gerar o vetor; a prévia da imagem na interface utiliza uma URL temporária do navegador.

## Execução local

### Pré-requisitos

- Git.
- Docker com Docker Compose.
- Python com suporte às dependências de DeepFace e TensorFlow do ambiente escolhido.
- Node.js compatível com Angular 22 e npm; o projeto declara npm 11.13.0 em `packageManager`.
- Uma câmera disponível, se quiser usar a captura de vídeo.

As dependências Python não têm versões fixadas no arquivo atual. Use um ambiente virtual e confirme a compatibilidade do TensorFlow com sua versão do Python e sistema operacional.

### 1. Clonar o repositório

```bash
git clone https://github.com/GabrielCost4/Vetra.AI.git
cd Vetra.AI
```

### 2. Configurar o banco

No PowerShell, a partir da raiz:

```powershell
Copy-Item API/infra/.env.example API/infra/.env
```

No Linux ou macOS:

```bash
cp API/infra/.env.example API/infra/.env
```

Edite `API/infra/.env` e defina sua senha local:

```dotenv
POSTGRES_DB=vetra
POSTGRES_USER=vetra
POSTGRES_PASSWORD=sua_senha_local
POSTGRES_PORT=5432
DATABASE_URL=postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}
```

Se a senha contiver caracteres reservados de URL, use a codificação correspondente na `DATABASE_URL`. Não versione o arquivo `.env`.

Inicie o PostgreSQL e consulte o estado do serviço:

```bash
docker compose --env-file API/infra/.env -f API/infra/compose.yaml up -d
docker compose --env-file API/infra/.env -f API/infra/compose.yaml ps
```

O banco fica acessível apenas em `127.0.0.1`, na porta configurada. O volume preserva os dados entre reinicializações. O script `init.sql` habilita a extensão `vector` na primeira inicialização de um volume vazio.

### 3. Preparar e iniciar a API

Na raiz do repositório:

```bash
python -m venv .venv
```

Ative o ambiente no PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Ou no Linux/macOS:

```bash
source .venv/bin/activate
```

Instale as dependências e o servidor de desenvolvimento. O Uvicorn é instalado explicitamente porque não está listado no `requirements.txt` atual:

```bash
python -m pip install -r API/requirements.txt
python -m pip install "uvicorn[standard]"
cd API
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

A API procura primeiro `API/infra/.env` e depois `API/.env`. Uma `DATABASE_URL` definida no ambiente tem precedência sobre os valores carregados pelo dotenv.

| Recurso | Endereço local |
| --- | --- |
| Saúde da API | http://127.0.0.1:8000/ |
| Swagger UI | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |
| OpenAPI | http://127.0.0.1:8000/openapi.json |

O primeiro processamento pode baixar os pesos do modelo e demorar mais. Mantenha acesso à internet para esse download.

### 4. Iniciar a interface

Em outro terminal, a partir da raiz:

```bash
cd WEB
npm ci
npm start
```

Abra http://localhost:4200. O cliente usa `http://127.0.0.1:8000/api/faces`, configurado em [face.service.ts](WEB/src/app/services/face.service.ts). Se alterar a porta ou o endereço da API, ajuste esse arquivo.

Para acessar por outro dispositivo, configure um endereço de API acessível por ele. `127.0.0.1` sempre aponta para o próprio dispositivo que está acessando a aplicação. A captura de câmera exige HTTPS ou uma origem local considerada segura pelo navegador.

## Como usar

1. Abra **Cadastro facial**.
2. Ative a câmera e capture uma foto, ou selecione **Enviar imagem**.
3. Informe o nome e clique em **Cadastrar facial**.
4. Abra **Reconhecimento**, capture ou envie outra imagem e clique em **Reconhecer pessoa**.
5. Use **Pessoas** para consultar os registros e excluir um cadastro após confirmação.

Use imagens nítidas, com boa iluminação e apenas um rosto. O reconhecimento pode variar com iluminação, enquadramento, oclusões e qualidade da imagem.

## API HTTP

Os endpoints de imagem recebem `multipart/form-data`. Não envie o arquivo como JSON ou Base64.

| Método | Rota | Entrada | Resposta de sucesso |
| --- | --- | --- | --- |
| `GET` | `/` | — | `200`, estado da API. |
| `POST` | `/api/faces/register` | `name` e `image` | `201`, cadastro criado. |
| `POST` | `/api/faces/recognize` | `image` | `200`, resultado da comparação. |
| `GET` | `/api/faces` | `skip` e `limit` opcionais | `200`, lista de cadastros. |
| `DELETE` | `/api/faces/{face_id}` | UUID na URL | `204`, sem corpo. |

### Exemplos com cURL

Os exemplos abaixo usam sintaxe de shell Bash. No PowerShell, use `curl.exe` e coloque cada comando em uma única linha ou adapte a continuação de linha.

```bash
# Cadastrar
curl -X POST http://127.0.0.1:8000/api/faces/register \
  -F "name=Ana Silva" \
  -F "image=@./foto.jpg"

# Reconhecer
curl -X POST http://127.0.0.1:8000/api/faces/recognize \
  -F "image=@./consulta.jpg"

# Listar
curl "http://127.0.0.1:8000/api/faces?skip=0&limit=100"

# Excluir: substitua pelo UUID retornado no cadastro
curl -X DELETE http://127.0.0.1:8000/api/faces/00000000-0000-0000-0000-000000000001
```

### Resultado do reconhecimento

```json
{
  "matched": true,
  "id": "00000000-0000-0000-0000-000000000001",
  "name": "Ana Silva",
  "distance": 0.201,
  "confidence": 79.9,
  "message": "Rosto reconhecido com sucesso: Ana Silva!"
}
```

A busca usa distância de cosseno e considera correspondência quando a menor distância é de até `0.40`, conforme o repositório facial. Esse exemplo é ilustrativo. `confidence` é calculado a partir da distância, por `max(0, (1 - distance) × 100)`. O campo não representa uma probabilidade estatística calibrada. Quando não há correspondência, `matched` é `false` e `id` e `name` são nulos.

### Falhas tratadas

| Código | Situação |
| --- | --- |
| `400` | Nome vazio, arquivo vazio ou imagem inválida. |
| `404` | Cadastro não encontrado na exclusão. |
| `415` | Tipo de arquivo diferente de imagem. |
| `422` | Nenhum rosto, múltiplos rostos ou entrada inválida para o contrato da rota. |

Detalhes adicionais: [endpoints faciais](API/ENDPOINTS-FACIAIS.md) e [fluxo das funcionalidades](API/FLUXO-FEATURES-FACIAIS.md).

## Comandos do WEB

Execute dentro de `WEB`:

| Comando | Finalidade |
| --- | --- |
| `npm start` | Servidor de desenvolvimento. |
| `npm run build` | Build de produção. |
| `npm run watch` | Build contínuo na configuração de desenvolvimento. |
| `npm test -- --watch=false` | Executar os testes Angular uma vez. |
| `npx prettier --check src` | Conferir a formatação dos fontes. |

O repositório contém testes da interface com Vitest. O build gera os arquivos em `WEB/dist/WEB`. Não há pipeline de CI/CD ou configuração de deploy versionados na estrutura atual.

## Solução de problemas

| Problema | O que verificar |
| --- | --- |
| API não inicia por configuração | Defina `DATABASE_URL` e confirme o caminho do `.env`. |
| Erro de conexão com o banco | Confira o estado do container, porta, usuário, senha e nome do banco. |
| Tabela `faces` ausente | Execute `python -m alembic upgrade head` dentro de `API`. |
| Extensão `vector` ausente | Habilite a extensão no banco utilizado; o script de inicialização só roda automaticamente em volume vazio. |
| Erro na instalação de TensorFlow | Confira a compatibilidade da versão do Python, sistema e dependências instaladas no ambiente virtual. |
| Câmera bloqueada | Libere a permissão no navegador e no sistema e use HTTPS ou localhost. |
| Câmera ocupada | Feche outros aplicativos que estejam usando o dispositivo e tente novamente. |
| WEB não alcança a API | Confira a URL do cliente, a porta e se a API está em execução. |
| Imagem rejeitada | Use um arquivo válido com uma única pessoa e um rosto visível. |

Para parar o banco sem remover seus dados:

```bash
docker compose --env-file API/infra/.env -f API/infra/compose.yaml down
```

## Estado atual e implantação

A configuração atual é voltada à execução local. A API não implementa autenticação ou autorização e permite origens CORS de forma ampla. Antes de disponibilizá-la publicamente, configure controle de acesso, origens permitidas, limites de upload e de requisições, HTTPS e tratamento operacional de falhas.

Os embeddings também são dados biométricos. Defina consentimento, acesso, retenção e exclusão adequados ao uso da aplicação. O código atual não implementa detecção de vivacidade; uma imagem enviada pode ser usada para reconhecimento, portanto o fluxo não deve ser tratado como prova de presença física.

## Identidade visual

A interface utiliza superfícies escuras e verde, com contraste adaptado no tema claro. Os arquivos de marca estão em [WEB/public/brand](WEB/public/brand). O conceito e os prompts usados estão em [BRAND.md](WEB/BRAND.md).

As adaptações dos ícones estão documentadas em [ICONS.md](WEB/ICONS.md), com a licença do Lucide Animated em [public/licenses](WEB/public/licenses).

## Contribuindo

Sugestões de melhorias e relatos de problemas podem ser enviados pelas [issues do repositório](https://github.com/GabrielCost4/Vetra.AI/issues). Descreva o comportamento esperado, o que aconteceu e os passos para reproduzir.

Para contribuir com código, crie uma branch, mantenha as alterações focadas, documente novas configurações e envie um pull request com o contexto e a validação realizada.

## Licença

O repositório não possui um arquivo de licença geral na raiz. A licença dos ícones de terceiros está incluída junto aos arquivos utilizados.

---

<p align="center">Desenvolvido por <strong><a href="https://github.com/GabrielCost4">Gabriel Costa</a></strong></p>
