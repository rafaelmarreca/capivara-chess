/**
 * Config do app web no Firebase (console → Configurações do projeto → Seus apps).
 * Não é segredo: quem protege os dados são as regras em firestore.rules.
 * Enquanto estiver vazia, o botão de login não aparece. Ver docs/firebase-setup.md.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}
