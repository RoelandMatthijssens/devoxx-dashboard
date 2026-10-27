# Devoxx Belgium schedule archive

A static, browser-based archive of Devoxx Belgium schedules and session recordings.

## GitHub Pages

The site is deployed by [the Pages workflow](.github/workflows/deploy-pages.yml) whenever `main` is pushed. In the repository settings on GitHub, select **GitHub Actions** as the Pages source.

For this repository, the default URL will be:

<https://roelandmatthijssens.github.io/devoxx-dashboard/>

## Local preview

```sh
make serve
```

Then open <http://127.0.0.1:8000/>. Serving over HTTP is required because the schedule pages fetch their edition data from JSON files.

To use another port or listen address:

```sh
make serve PORT=8080 HOST=0.0.0.0
```

## Rebuild a schedule

To retrieve public Devoxx data and rebuild an edition's HTML and JSON files:

```sh
python3 build_devoxx_schedule.py 2025
```
