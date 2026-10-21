/**
 * Config do app web no Firebase (console → Configurações do projeto → Seus apps).
 * Não é segredo: quem protege os dados são as regras em firestore.rules.
 * Enquanto estiver vazia, o botão de login não aparece. Ver docs/firebase-setup.md.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAhZVjmiFkaQNuRUrt3bFaFlIETFQ5xKno",
  authDomain: "capivara-chess.firebaseapp.com",
  projectId: "capivara-chess",
  appId: "1:652664702736:web:5f552a85d91b646c628795",
}

export function isFirebaseConfigured(config: typeof firebaseConfig = firebaseConfig): boolean {
  return Boolean(config.apiKey && config.projectId)
}
