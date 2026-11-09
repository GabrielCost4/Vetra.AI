# Endpoints faciais: implementação atual

Este documento explica as alterações feitas para receber imagens na API. O fluxo atual recebe e valida o upload; o recorte do rosto, a geração do embedding e a persistência ainda serão implementados.

## Arquivos alterados

| Arquivo | Responsabilidade |
| --- | --- |
| `app/routers/faces.py` | Declarar as rotas HTTP, receber os campos e chamar o service. |
| `app/services/facial_service.py` | Ler e validar a imagem e montar a resposta. |
| `requirements.txt` | Incluir `python-multipart`, necessário para arquivos e formulários. |

As alterações existentes no Docker Compose foram preservadas. Nenhuma integração com os modelos de IA, migrations ou conexão com o banco foi adicionada nesta etapa.

## Como a requisição chega

O cliente envia uma requisição `multipart/form-data`. Esse formato permite enviar um arquivo junto com campos de texto.

Uma imagem capturada pela câmera do navegador também pode ser enviada assim: o frontend transforma a captura em um `Blob` ou `File` e o adiciona a um `FormData` com o campo `image`.

O FastAPI preenche os parâmetros da função automaticamente:

```python
name: str = Form(...)
image: UploadFile = File(...)
```

- `Form` recebe o campo de texto.
- `File` informa que o campo recebe um arquivo.
- `UploadFile` fornece acesso ao nome, ao tipo informado e ao conteúdo do arquivo.
- `...` indica que o campo é obrigatório. Se faltar um campo obrigatório, o FastAPI responde com erro de validação `422`.

## Endpoints

### POST `/api/faces/register`

Recebe os campos obrigatórios `name` e `image`. A rota delega ao service:

```python
return await facial_service.register_face(name=name, image=image)
```

O service lê a imagem e retorna uma mensagem, o nome informado, o nome do arquivo e a quantidade de bytes recebidos. Ainda não cria um registro no banco.

### POST `/api/faces/recognize`

Recebe o campo obrigatório `image`. A rota delega ao service:

```python
return await facial_service.recognize_face(image=image)
```

O service lê a imagem e retorna uma mensagem, o nome do arquivo e a quantidade de bytes recebidos. Ainda não identifica uma pessoa.

Ambas as rotas retornam `202 Accepted` quando o upload passa pelas validações. A resposta atual informa que o processamento não foi realizado. Não existe processamento em segundo plano nem fila configurada.

## Separação entre controller e service

O arquivo de rotas mantém apenas os handlers exigidos pelo FastAPI: eles recebem os campos e chamam o service. A lógica compartilhada fica na classe `FacialService`.

O objeto usado pelas rotas é criado no final do módulo do service:

```python
facial_service = FacialService()
```

Os métodos `register_face` e `recognize_face` chamam `self._read_image(image)`. O prefixo `_` sinaliza, por convenção, que esse método é de uso interno da classe.

## Validação e leitura da imagem

O método `_read_image`:

1. Confere se o `content_type` informado começa com `image/`. Caso contrário, retorna `415 Unsupported Media Type`.
2. Lê o conteúdo com `await image.read()`.
3. Rejeita um arquivo vazio com `400 Bad Request`.
4. Retorna os bytes para o método que o chamou.

O `await` aguarda a leitura assíncrona do arquivo. Os métodos que usam essa leitura foram declarados com `async def`.

A validação atual confere o tipo declarado pelo cliente; ela ainda não decodifica o conteúdo para comprovar que é uma imagem válida. Também não limita o tamanho do upload e lê o arquivo inteiro em memória.

## Dependência adicionada

Foi incluído `python-multipart` no `requirements.txt`. Para instalar as dependências usando o ambiente virtual existente, execute a partir da pasta `API`:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Como experimentar manualmente

Com a API rodando, abra `/docs` no endereço dela. Se estiver usando a porta padrão do Uvicorn, o endereço será `http://127.0.0.1:8000/docs`.

No endpoint de cadastro, selecione **Try it out**, preencha `name`, escolha uma imagem no campo `image` e execute. No reconhecimento, envie somente a imagem.

Isso permite conferir a recepção do upload. Não foram executados testes automatizados nesta etapa.

## Próximas etapas

1. Decodificar os bytes recebidos e validar o conteúdo da imagem.
2. Detectar e recortar o rosto com DeepFace, tratando imagens sem rosto ou com múltiplos rostos.
3. Gerar um embedding de 512 valores com FaceNet512 no serviço de embeddings.
4. Configurar a conexão SQLAlchemy e as migrations Alembic.
5. No cadastro, salvar nome e embedding; no reconhecimento, comparar o embedding com os registros do banco.

Essas integrações devem manter a lógica nos services e o acesso ao banco nos repositórios, deixando as rotas responsáveis por receber a requisição e delegar o trabalho.
