<!-- markdownlint-disable -->
# Container Configuration: {{title}}

**Feature**: {{feature_id}}
**Language**: {{language}}
**Framework**: {{framework}}
**Date**: {{date}}

---

## Dockerfile

```dockerfile
{{dockerfile_content}}
```

## Docker Compose

```yaml
{{compose_content}}
```

## .dockerignore

```
{{dockerignore_content}}
```

## Build & Run

```bash
docker build -t {{image_name}} .
docker run -p {{port}}:{{port}} {{image_name}}
```
