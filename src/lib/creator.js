// Эксклюзивный профиль Создателя AAPA — гейт по uid.
// Все «создательские» элементы применяются только для этого uid; для всех
// остальных поведение приложения не меняется.
export const CREATOR_UID = 'TQR8qCK1qdPRWX5AvrugemGxw6G3';
export const isCreator = (uid) => !!uid && uid === CREATOR_UID;
