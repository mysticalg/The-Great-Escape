# The Great Escape

A browser-based retro stealth game inspired by *The Great Escape* era of classic 8-bit design.

## Play online (GitHub Pages)

After the first successful GitHub Actions deployment, your live game will be available at:

- **https://<your-github-username>.github.io/The-Great-Escape/**

> Tip: replace `<your-github-username>` with your GitHub username.

## How to play

### Objective
Collect useful items, avoid guard attention, and find your route to freedom.

### Controls
- **WASD** or **Arrow Keys**: Move
- **E**: Pick up an item on your tile

### Gameplay tips
- Keep your **suspicion** low. If suspicion gets too high, you lose.
- Watch your **energy** and move efficiently.
- Explore rooms and the compound to gather key escape items.
- Learn guard movement patterns and avoid unnecessary attention.

## Automatic deployment setup

This repo includes a GitHub Actions workflow at:

- `.github/workflows/deploy-pages.yml`

To enable it in your GitHub repository:

1. Open your repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or run the workflow manually from the **Actions** tab).

Once deployment finishes, GitHub will publish the game URL.
