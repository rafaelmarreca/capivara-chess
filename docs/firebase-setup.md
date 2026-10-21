# Configurar o Firebase (login com Google e sincronização)

Sem esta configuração o app funciona normalmente e guarda as análises só no aparelho;
o botão "Entrar com Google" fica escondido. Tudo abaixo cabe no plano gratuito (Spark),
sem cartão.

## 1. Criar o projeto

1. Acesse <https://console.firebase.google.com> e clique em **Criar projeto**
   (ex.: `capivara-chess`). O Google Analytics pode ficar desligado.
2. **Build → Authentication → Começar → Método de login → Google → Ativar.**
   Escolha o e-mail de suporte e salve.
3. Ainda em Authentication: **Configurações → Domínios autorizados → Adicionar domínio**:
   `rafaelmarreca.github.io`. (`localhost` já vem na lista.)
4. **Build → Firestore Database → Criar banco de dados**: modo de produção,
   região `southamerica-east1` (São Paulo).

## 2. Ligar o app ao projeto

1. **Configurações do projeto (engrenagem) → Seus apps → ícone Web (`</>`)**.
   Registre com o nome `capivara-web`, sem Firebase Hosting.
2. Copie `apiKey`, `authDomain`, `projectId` e `appId` do objeto `firebaseConfig`
   mostrado e cole em `src/library/firebaseConfig.ts`.
3. Commit e push: o deploy no GitHub Pages já sai com o login ligado.

Esses valores não são segredo: vão para o navegador de qualquer forma. Quem protege
os dados são as regras do passo 3.

## 3. Publicar as regras de segurança

As regras ficam em `firestore.rules` (cada usuário só acessa `users/{seu uid}/…`).
Publique pela CLI, e de novo sempre que o arquivo mudar:

```bash
npm i -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

Em `firebase use --add`, escolha o projeto criado e dê o apelido `default`. Isso cria
o `.firebaserc` local, que pode ser commitado.

## Limites do plano Spark (out/2026)

1 GiB armazenado, 50 mil leituras, 20 mil gravações e 20 mil exclusões por dia, e
50 mil usuários ativos por mês no login. Se um limite estourar, o serviço para até o
dia ou mês seguinte; não há cobrança.
