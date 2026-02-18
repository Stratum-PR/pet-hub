# Pet Hub

Pet grooming business management – multi-tenant SaaS (React, Vite, Supabase).

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## Repo name and local folder

- **Package/repo identity**: This project is named **pet-hub** (`package.json`).
- **Rename on GitHub**: In your repo → Settings → General → Repository name, set it to `pet-hub`. GitHub will redirect the old URL.
- **Rename your local folder** (optional): To match the repo name, rename the folder on your PC (e.g. from `stratum-hub-lovable` to `pet-hub`). Git will keep working because the remote URL is stored inside `.git`. After renaming the repo on GitHub, update the remote once:
  ```sh
  git remote set-url origin https://github.com/YOUR_USERNAME/pet-hub.git
  ```

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Documentation

- **[docs/README-SUPABASE.md](docs/README-SUPABASE.md)** – Supabase local dev (start/stop, ports, troubleshooting)
- **[docs/USER_SETUP_GUIDE.md](docs/USER_SETUP_GUIDE.md)** – Create users and link to demo business
- **[docs/OAUTH_WORKFLOW.md](docs/OAUTH_WORKFLOW.md)** – OAuth (Google/Microsoft) flow and fixes
- **[docs/API_ROUTES.md](docs/API_ROUTES.md)** – API routes via Supabase Edge Functions
- **[docs/RATE-LIMITING-GUIDE.md](docs/RATE-LIMITING-GUIDE.md)** – Upstash rate limiting
- **[docs/SECURITY-THREAT-ASSESSMENT.md](docs/SECURITY-THREAT-ASSESSMENT.md)** – Security assessment

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
