# CI setup

The CI workflow was prepared but could not be pushed by the automation because
the token used lacks the GitHub `workflow` scope (required to create anything
under `.github/workflows/`).

To activate CI, copy the template into place manually:

```bash
mkdir -p .github/workflows
cp docs/ci-setup/ci.yml.template .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "Add CI workflow"
git push
```

You'll need to push this from a session where your GitHub credentials have the
`workflow` scope (a personal access token with the `workflow` checkbox, or the
regular `gh auth login` flow with the default scopes).

Once added, the workflow will run on every push to `main` and every pull
request, executing:

- `npm run lint` (if defined)
- `npm test -- --ci --coverage`
- `npx expo export --platform web` on PRs that pass tests

See the template file for the full definition.
