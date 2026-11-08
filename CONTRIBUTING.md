# Contributing to react-agendfy

Thank you for considering contributing to **react-agendfy**! We appreciate your help in improving and expanding this project.

## How to Contribute

### 1. Fork and Clone
1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```sh
   git clone https://github.com/your-username/react-agendfy.git
   ```
3. Navigate to the project folder:
   ```sh
   cd react-agendfy
   ```
4. Install dependencies:
   ```sh
   npm install
   ```

### 2. Create a Feature Branch
Create a new branch for your feature or fix:
```sh
   git checkout -b feature/your-feature-name
```

### 3. Make Your Changes
- Follow the project's coding style.
- Keep your code modular and well-documented.
- Run linting and formatting checks:
  ```sh
  npm run lint
  ```

### 4. Test Your Changes
Make sure your changes don’t break existing functionality by running:
```sh
npm test
```

### 5. Commit and Push
Use meaningful commit messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
```sh
   git commit -m "feat(calendar): add new event filtering feature"
   git push origin feature/your-feature-name
```

### 6. Create a Pull Request
1. Go to the original repository on GitHub.
2. Open a Pull Request (PR) from your feature branch to `main`.
3. Provide a clear description of your changes.
4. Wait for a review and feedback.

## Compat boundary (`@react-agendfy/fullcalendar-compat`)

The compat package is a migration on-ramp for FullCalendar users. It must
never slow down or shape the core. These rules decide what goes where:

1. **The core never changes for the compat.** No core API, default or
   naming exists only because FullCalendar has it. When a FullCalendar
   option does not map onto the core, the compat implements it locally
   (as it does for `groupId` constraints and `selectOverlap`) or lists it
   as ignored in `MIGRATING.md`.
2. **One-way dependency.** The core never imports the compat. The compat
   uses only the core's public API: `<Calendar>`, its props, `apiRef`, the
   exported helpers and types. If the compat needs something internal,
   either make it public in the core (it must be useful without the
   compat) or do without it.
3. **Closed scope.** The compat covers FullCalendar v6's API, including
   FullCalendar premium features that map onto core features (for example
   `resourceTimeline` once the timeline exists). Features that only
   react-agendfy has (undo/redo, middleware plugins, the AI layer) stay in
   the native API. Compat users reach them through the escape hatches
   (`agendfyPlugins`), not through new FullCalendar-style props.
4. **A door, not a destination.** Docs point compat users to the native
   API for the features that set react-agendfy apart.
5. **Its own pace.** A core release does not require a compat release.
   The compat changes when FullCalendar's API gives a reason to. Its tests
   run against the core sources, so a core change that breaks it shows up
   in CI.
6. **Reviewed with data.** Compare npm downloads of the compat and the
   core from time to time. If the compat has no users, it goes into
   maintenance mode (bug fixes only).

## Code Style Guidelines
- Use TypeScript.
- Follow React best practices.
- Maintain consistent formatting with Prettier and ESLint.
- Use functional components and React Hooks when possible.

## Reporting Issues
If you find a bug or have a feature request, open an issue [here](https://github.com/your-repo/react-agendfy/issues) with detailed information.

## Thank You!
Your contributions help make **react-agendfy** better for everyone! 🎉

