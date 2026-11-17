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
  <a href="https://vetra-ai-olive.vercel.app/">Acessar Vetra.AI</a>
</p>

## Sobre o projeto

O **Vetra.AI** é uma aplicação de cadastro e reconhecimento facial. A interface permite capturar uma foto pela câmera, enviar uma imagem, cadastrar uma pessoa, consultar uma identidade e gerenciar os registros existentes.

O processamento acontece na API: a imagem é validada, o rosto é detectado e convertido em uma representação numérica. Essa representação é comparada com os cadastros armazenados no banco.

### Funcionalidades

- Criação de conta e login com email e senha, autenticação JWT e hash de senha com bcrypt.
- Cadastros, reconhecimento e exclusão restritos aos rostos da conta autenticada.
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
  <img src="DOCS/tecnologias.svg" alt="Angular, TypeScript, HTML, CSS, Python, FastAPI, TensorFlow, OpenCV, PostgreSQL, Docker e Git" width="660" />
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

### Dados armazenados

Cada cadastro contém UUID, `user_id` (FK para `users`), nome, embedding de 512 dimensões e data de criação. A tabela `users` contém UUID, nome, email único, hash bcrypt da senha e data de criação. Rostos anteriores à autenticação são preservados sem proprietário e ficam inacessíveis às contas. O modelo não armazena a fotografia original; a prévia usa uma URL temporária do navegador.

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
JWT_SECRET_KEY=**Gere uma chave rodando o comando: python -c "import secrets; print(secrets.token_urlsafe(48))"**
```

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

A API valida `JWT_SECRET_KEY` durante a inicialização e não inicia se a chave tiver menos de 32 bytes. As migrations devem ser aplicadas antes de iniciar a nova versão.

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

Abra http://localhost:4200. Em desenvolvimento, o cliente usa `http://127.0.0.1:8000/api`, definido em `WEB/src/environments/environment.ts`. O build de produção usa `environment.production.ts`, apontando para a API na Vercel.

Para acessar por outro dispositivo, configure um endereço de API acessível por ele. `127.0.0.1` sempre aponta para o próprio dispositivo que está acessando a aplicação. A captura de câmera exige HTTPS ou uma origem local considerada segura pelo navegador.

## Como usar

1. Crie uma conta ou entre com email e senha. Depois abra **Cadastro facial**.
2. Ative a câmera e capture uma foto, ou selecione **Enviar imagem**.
3. Informe o nome e clique em **Cadastrar facial**.
4. Abra **Reconhecimento**, capture ou envie outra imagem e clique em **Reconhecer pessoa**.
5. Use **Pessoas** para consultar os registros e excluir um cadastro após confirmação.

Use imagens nítidas, com boa iluminação e apenas um rosto. O reconhecimento pode variar com iluminação, enquadramento, oclusões e qualidade da imagem.

O cadastro de conta exige nome com 2 a 150 caracteres, email válido e senha com 8 a 20 caracteres. O email é normalizado para letras minúsculas e deve ser único. A senha não pode conter apenas espaços.

## API HTTP

Os endpoints de imagem recebem `multipart/form-data`. Não envie o arquivo como JSON ou Base64.

As rotas `/api/faces` exigem `Authorization: Bearer <token>` e `X-User-Id: <user.id>`. O ID deve coincidir com o usuário do JWT. Listagem, reconhecimento e exclusão são restritos aos rostos dessa conta, com filtro no banco. Consulte [o contrato completo](API/AUTH.md).

| Método | Rota | Entrada | Resposta de sucesso |
| --- | --- | --- | --- |
| `GET` | `/` | — | `200`, estado da API. |
| `POST` | `/api/auth/register` | JSON: `name`, `email`, `password` | `201`, usuário e JWT. |
| `POST` | `/api/auth/login` | JSON: `email`, `password` | `200`, usuário e JWT. |
| `GET` | `/api/auth/me` | Bearer token | `200`, usuário autenticado. |
| `POST` | `/api/faces/register` | `name` e `image` | `201`, cadastro criado. |
| `POST` | `/api/faces/recognize` | `image` | `200`, resultado da comparação. |
| `GET` | `/api/faces` | `skip` e `limit` opcionais | `200`, lista de cadastros. |
| `DELETE` | `/api/faces/{face_id}` | UUID na URL | `204`, sem corpo. |


A busca usa distância de cosseno e considera correspondência quando a menor distância é de até `0.40`, conforme o repositório facial. Esse exemplo é ilustrativo. `confidence` é calculado a partir da distância, por `max(0, (1 - distance) × 100)`. O campo não representa uma probabilidade estatística calibrada. Quando não há correspondência, `matched` é `false` e `id` e `name` são nulos.



## Estado atual e implantação

A API exige JWT e aplica autorização por proprietário em todas as operações faciais. A sessão dura uma hora, e a senha é armazenada apenas como hash bcrypt. O WEB usa `sessionStorage` para a sessão da aba e não salva senhas. A API valida o usuário no banco em cada requisição. Configure `JWT_SECRET_KEY` também na hospedagem antes de publicar a nova versão.

## Identidade visual

A interface utiliza superfícies escuras e verde, com contraste adaptado no tema claro. Os arquivos de marca estão em [WEB/public/brand](WEB/public/brand). O conceito e os prompts usados estão em [BRAND.md](WEB/BRAND.md).

As adaptações dos ícones estão documentadas em [ICONS.md](WEB/ICONS.md), com a licença do Lucide Animated em [public/licenses](WEB/public/licenses).

## Licença

O código pode ser utilizado e copiado exclusivamente para fins pessoais e educacionais, incluindo estudo e avaliação, preservando os créditos e o texto da [LICENSE](LICENSE).

Uso comercial, redistribuição, publicação, sublicenciamento e criação ou distribuição de trabalhos derivados exigem autorização prévia e expressa do titular dos direitos autorais. Consulte a [LICENSE](LICENSE) para os termos completos.

Bibliotecas, ferramentas, imagens e demais componentes de terceiros seguem suas próprias licenças. As adaptações dos ícones estão documentadas em [ICONS.md](WEB/ICONS.md), e a licença correspondente está em [public/licenses](WEB/public/licenses).

---

<p align="center">Desenvolvido por <strong><a href="https://github.com/GabrielCost4">Gabriel Costa</a></strong></p>
