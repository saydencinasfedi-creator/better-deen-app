# Better Deen: descargas

Página de descarga del APK de Android de Better Deen:
**https://saydencinasfedi-creator.github.io/better-deen-app/**

- `download-page/`: la página (GitHub Pages, desplegada por `.github/workflows/pages.yml`).
- Los APK van en las [Releases](https://github.com/saydencinasfedi-creator/better-deen-app/releases),
  siempre con el nombre `better-deen.apk`, así el enlace
  `releases/latest/download/better-deen.apk` apunta a la última versión.

El código fuente de la app no está en este repositorio.

## Publicar una versión nueva

```bash
flutter build apk --release --target-platform android-arm,android-arm64 --dart-define-from-file=config/dev.json
cp build/app/outputs/flutter-apk/app-release.apk better-deen.apk
gh release create v0.2.1 better-deen.apk -R saydencinasfedi-creator/better-deen-app --title "Better Deen v0.2.1" --notes "…"
```

Firma siempre con la misma clave de release; si no, los usuarios tendrían que
desinstalar para actualizar.
