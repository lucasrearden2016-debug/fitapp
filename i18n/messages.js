// Mensajes del back traducidos. La clave es el texto en español.
// {x} = valor variable (se captura del mensaje original y se reinserta).
const MESSAGES = {
  'Alimento no encontrado': ['Food not found', 'Alimento não encontrado'],
  'Comida no encontrada': ['Meal not found', 'Refeição não encontrada'],
  'Completá tu perfil de gimnasio en "Mi perfil"': ['Complete your gym profile in "My profile"', 'Complete seu perfil de academia em "Meu perfil"'],
  'Completá tu perfil primero': ['Complete your profile first', 'Complete seu perfil primeiro'],
  'Datos inválidos': ['Invalid data', 'Dados inválidos'],
  'Demasiados intentos, esperá unos minutos': ['Too many attempts, wait a few minutes', 'Muitas tentativas, espere alguns minutos'],
  'Día no encontrado': ['Day not found', 'Dia não encontrado'],
  'El email ya está registrado': ['That email is already registered', 'Esse e-mail já está cadastrado'],
  'Ese alimento con esa marca ya existe': ['That food with that brand already exists', 'Esse alimento com essa marca já existe'],
  'Ese nombre de usuario ya está tomado': ['That username is already taken', 'Esse nome de usuário já está em uso'],
  'Favorita no encontrada': ['Favorite not found', 'Favorito não encontrado'],
  'ID inválido': ['Invalid ID', 'ID inválido'],
  'Llegaste al límite de pedidos a la IA por hora': ['You reached the hourly AI request limit', 'Você atingiu o limite de pedidos à IA por hora'],
  'Plan no encontrado': ['Plan not found', 'Plano não encontrado'],
  'Ruta no encontrada': ['Route not found', 'Rota não encontrada'],
  'Rutina no encontrada': ['Routine not found', 'Rotina não encontrada'],
  'Solo quien lo creó puede borrarlo': ['Only its creator can delete it', 'Só quem criou pode excluir'],
  'Solo quien lo creó puede editarlo': ['Only its creator can edit it', 'Só quem criou pode editar'],
  'Todavía no tenés plan': ["You don't have a plan yet", 'Você ainda não tem plano'],
  'Token inválido o vencido': ['Invalid or expired session', 'Sessão inválida ou expirada'],
  'Token requerido': ['Login required', 'Login necessário'],
  'Usuario no encontrado': ['User not found', 'Usuário não encontrado'],
  'Usuario/email o contraseña incorrectos': ['Wrong username/email or password', 'Usuário/e-mail ou senha incorretos'],
  'Ya existe otro alimento con ese nombre y marca': ['Another food with that name and brand already exists', 'Já existe outro alimento com esse nome e marca'],
  'Ya existe un registro con ese valor': ['A record with that value already exists', 'Já existe um registro com esse valor'],
  'Error interno': ['Internal error', 'Erro interno'],
  'Esta función es Premium': ['This is a Premium feature', 'Este recurso é Premium'],
  'Llegaste al límite diario de IA. Mañana se renueva.': ['You reached the daily AI limit. It resets tomorrow.', 'Você atingiu o limite diário de IA. Renova amanhã.'],
  'Si la cuenta existe, te mandamos un email con el link': ['If the account exists, we sent you an email with the link', 'Se a conta existir, enviamos um e-mail com o link'],
  'El link no es válido o ya venció. Pedí uno nuevo.': ['The link is invalid or expired. Request a new one.', 'O link é inválido ou expirou. Peça um novo.'],
  'La IA no está disponible en este momento.': ['The AI is not available right now.', 'A IA não está disponível no momento.'],
  'Se terminó el cupo diario de la IA. Probá más tarde.': ['The daily AI quota ran out. Try again later.', 'A cota diária da IA acabou. Tente mais tarde.'],
  'La IA devolvió una respuesta inválida, probá de nuevo': ['The AI returned an invalid response, try again', 'A IA devolveu uma resposta inválida, tente de novo'],
  'El usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo': ['Username must be 3 to 20 characters: letters, numbers, dot or underscore', 'O usuário deve ter de 3 a 20 caracteres: letras, números, ponto ou sublinhado'],
  'Proteína + carbos + grasas no pueden pasar de 100 g en 100 g de alimento': ["Protein + carbs + fat can't exceed 100 g per 100 g of food", 'Proteína + carboidratos + gorduras não podem passar de 100 g em 100 g de alimento'],
  'Las calorías no cierran con los macros: con esos macros serían unas {x} kcal. Revisá que todo sea por 100 {y}.': [
    "Calories don't match the macros: those macros add up to about {x} kcal. Check that everything is per 100 {y}.",
    'As calorias não batem com os macros: com esses macros seriam umas {x} kcal. Confira se está tudo por 100 {y}.',
  ],
};

// Plantillas con variables → expresiones regulares
const TEMPLATES = Object.entries(MESSAGES)
  .filter(([k]) => k.includes('{'))
  .map(([k, v]) => {
    const names = [...k.matchAll(/\{(\w)\}/g)].map((m) => m[1]);
    const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{\w\\?\}/g, '(.+?)') + '$');
    return { re, names, v };
  });

export function translate(message, lang) {
  if (!message || lang === 'es') return message;
  const idx = lang === 'en' ? 0 : 1;
  if (MESSAGES[message]) return MESSAGES[message][idx];
  for (const { re, names, v } of TEMPLATES) {
    const m = message.match(re);
    if (m) return names.reduce((out, n, i) => out.replace(`{${n}}`, m[i + 1]), v[idx]);
  }
  return message;
}
