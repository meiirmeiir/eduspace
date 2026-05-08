## Долгосрочный фикс race condition в AuthContext (TODO)

Текущее: retry 20×500ms в loadProfile (до 10 секунд worst case).

Истинный фикс: в EmailAuthScreen.jsx — после createUserWithEmailAndPassword
явно дождаться setDoc и затем сразу записать профиль в AuthContext через
прямой setProfile, минуя getDoc → onIdTokenChanged race.

Альтернатива: AuthContext.setProfile экспортируется из контекста, EmailAuthScreen
вызывает его сразу после успешного setDoc.

Сейчас не делаем потому что: точечный retry-фикс достаточен, а refactor
архитектуры авторизации выходит за рамки текущей задачи (распил App.jsx).

Когда возвращаться: после завершения распила (Этапы 6-8) или раньше, если
пользователи будут жаловаться на 10-секундное ожидание после регистрации.
