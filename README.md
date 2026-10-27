# Devoxx Belgium schedule archive

A static, browser-based archive of Devoxx Belgium schedules and session recordings.

## GitHub Pages

The site is deployed by [the Pages workflow](.github/workflows/deploy-pages.yml) whenever `main` is pushed. In the repository settings on GitHub, select **GitHub Actions** as the Pages source.

For this repository, the default URL will be:

<https://roelandmatthijssens.github.io/devoxx-dashboard/>

## Local preview

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Rebuild a schedule

The generated schedule pages are self-contained HTML files. To retrieve public Devoxx data and rebuild one:

```sh
python3 build_devoxx_schedule.py 2025
```
