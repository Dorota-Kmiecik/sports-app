# Forma — dziennik treningowy  https://dorota-kmiecik.github.io/sports-app/

Prosta aplikacja do zapisywania ćwiczeń, serii, powtórzeń i ciężaru oraz obserwowania progresu w czasie.

## Uruchomienie

Otwórz plik `index.html` w przeglądarce. Nie trzeba instalować żadnych zależności ani uruchamiać serwera.

### Android

Otwórz cały folder projektu w Android Studio. Moduł `app` automatycznie kopiuje aktualne pliki `index.html`, `styles.css` i `app.js` do aplikacji podczas każdego budowania.

## Dane

Wpisy są automatycznie zapisywane w pamięci lokalnej przeglądarki (`localStorage`). Są dostępne na tym samym urządzeniu i w tej samej przeglądarce. Wyczyszczenie danych witryny usunie również dziennik.

## Funkcje

- własne foldery miesięcy,
- dowolna liczba dni treningowych,
- minimum 5 ćwiczeń i 3 serie w każdym dniu,
- osobne pola na powtórzenia i kilogramy w każdej serii,
- kolorowe oznaczenie odczuwanego wysiłku dla każdej serii,
- dodatkowe ćwiczenia i serie,
- osobne wykresy ciężaru i liczby serii dla każdego ćwiczenia,
- filtrowanie progresu według zakresu dat,
- responsywny widok na komputerze i telefonie.
