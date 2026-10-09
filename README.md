# Teams desktop for Linux

An independent Electron wrapper for Microsoft Teams with a desktop window,
tray controls, background operation and GNOME/PipeWire screen sharing.
Chrome is not required by the packaged app. This is not the community
`teams-for-linux` project or its Snap package and is not affiliated with Microsoft.

## Features

- Close or Alt+F4 hides Teams while its page stays loaded.
- **Open Teams** in the tray or another launcher click restores the same instance.
- **Quit Teams** exits; optional login startup launches in the background.
- Teams HTTPS and `msteams://` meeting links are supported.
- Remote pages have renderer sandboxing and context isolation, with no Node access.
- Media and notifications are restricted to Teams origins. Selected Microsoft
  authentication origins may request storage access. Sign-in popups are limited.

## Requirements

The package targets **Linux amd64**. The tested packaging environment is Ubuntu
26.04 with GNOME/Wayland; other distributions and desktops are untested. Tray
controls require AppIndicator/StatusNotifier support, supplied by Ubuntu GNOME.

To build, install Node.js **24 or newer** and npm from [nodejs.org](https://nodejs.org/),
plus these Ubuntu tools:

```sh
sudo apt install python3 dpkg-dev desktop-file-utils
```

Initial setup needs access to the npm registry and GitHub. Electron is pinned to
**44.7.0** with a lockfile; its installer validates runtime downloads. See the
[Electron installation guide](https://www.electronjs.org/docs/latest/tutorial/installation).

## Build and install

From the project directory:

```sh
npm ci
npm test
npm run build:deb
sudo apt install ./dist/microsoft-teams-pwa-local_1.1.1_amd64.deb
```

The build uses this project's files and Electron dependency, without relying
on a pre-existing local staging directory. The `.deb` bundles the runtime in
`/opt/microsoft-teams-pwa`. Node and npm are build tools, not runtime requirements.
The Python launcher and Linux library dependencies are declared in the package.

Open **Microsoft Teams** from the app menu and sign in, or use:

```sh
microsoft-teams-pwa
microsoft-teams-pwa --background
microsoft-teams-pwa 'msteams://teams.microsoft.com/l/meetup-join/...'
```

Replace the example with a real meeting URL. Accepted hosts are
`teams.microsoft.com`, `teams.cloud.microsoft`, and `teams.live.com`.
The existing package name `microsoft-teams-pwa-local`, command
`microsoft-teams-pwa`, and desktop ID `teams-pwa.desktop` are preserved for
upgrades. Only one launcher is installed. Remove unrelated Teams apps separately
if present; this package does not remove other software or install a fallback.

## Start automatically after login

After installing, run as your normal desktop user:

```sh
npm run autostart:enable
```

This writes `$XDG_CONFIG_HOME/autostart/teams-pwa.desktop`, or
`~/.config/autostart/teams-pwa.desktop` when the variable is unset, and launches
Teams in the background after login, including after a restart. Sign in once
before relying on calls. To disable startup:

```sh
npm run autostart:disable
```

Closing the window keeps Teams running. **Quit Teams** stops it until you open
it or log in again. An active desktop session and network connection are needed.

## Development and tests

```sh
npm ci
npm start
npm start -- --background
npm test
npm run test:smoke
```

Source launches use the installed app's profile and single-instance lock. If it
is running, another launch restores it; choose **Quit Teams** first to run changed
source. The native smoke test briefly opens a local window, checks close/hide,
hidden timers, renderer preservation, restore, a second launch/link, and quit.
It requires a graphical desktop and uses a temporary profile without opening
Teams or reading your sign-in data. Unit tests cover lifecycle and URL validation.

On Ubuntu with restricted user namespaces, the development scripts link the
installed root-owned `/opt/microsoft-teams-pwa/chrome-sandbox` helper into the
downloaded runtime when its Electron version matches. This changes only the
ignored dependency cache. Install the built `.deb` first on such hosts. Do not run Teams as
root or disable its sandbox. Reinstall the package if its helper is incorrectly
configured; the packaged helper is root-owned with mode `4755`.

Manual release checks: sign in without a popup chain; receive a call while hidden,
repeat after ten minutes; test camera/microphone; share a window and full screen;
cancel sharing; restore and quit; restart; verify startup after login. Automated
tests do not establish calling or sharing compatibility on every account or device.

## Project layout

```text
src/        Electron main process, lifecycle and capture picker
assets/     Desktop/tray icon
tests/      Unit tests and native smoke test
packaging/  Launcher, desktop entries and Debian control template
scripts/    Runtime, build, development and autostart helpers
dist/       Generated packages (ignored by Git)
.cache/     Generated staging files (ignored by Git)
```

## Profiles, troubleshooting and limitations

The profile is `~/.config/teams-desktop`; the installed launcher's log is
`~/.config/teams-desktop/desktop.log`. Source launches log to the terminal.
Profiles and logs may contain private data: never commit them. A former Chrome
profile at `~/.config/teams-pwa` is independent and is not imported.

- **Missing tray:** check your desktop's AppIndicator support; the app launcher
  can restore a hidden window.
- **Sign-in error:** quit, inspect the local log, update the runtime if needed,
  and retry. If resetting the profile, move it aside as a backup while Teams is stopped.
- **Screen sharing:** GNOME's portal chooses the PipeWire source. Other backends
  use a local picker for multiple sources. Linux system-audio sharing is not implemented.
- **No network at startup:** Teams loading can fail and the current app may exit.
  Open it once connected; automatic network retry is not implemented.
- Microsoft can change the web app. Recheck calls and sharing after runtime or
  web-app changes; future compatibility is not guaranteed.

## Upgrade and remove

Increment the project's `version`, rebuild, quit Teams, and install the new
package with `sudo apt install ./dist/<new-package>.deb`. Profiles and the existing
autostart entry are retained. The bundled Electron requires a rebuild for security
updates; `apt` does not update that runtime independently.

To update Electron, set an exact version in `devDependencies.electron`, run
`npm install`, run both test suites, rebuild and complete the manual checks.
Commit the updated manifest and lockfile together.

To uninstall, first quit Teams, then:

```sh
npm run autostart:disable
sudo apt remove microsoft-teams-pwa-local
```

The saved profile is retained. Remove it separately only if you intend to delete
your saved sign-in and application data.

## Create a Git repository and share

No Git repository has been initialized. Review the files and [NOTICE](NOTICE), then:

```sh
git init -b main
git add .
git status
git commit -m "Initial Teams desktop wrapper"
git remote add origin <your-repository-url>
git push -u origin main
```

Review `git status` before committing. Share source and the lockfile through Git.
Publish `.deb` files as release attachments; do not commit dependencies, runtime
binaries, staging output, profiles or logs.

## License

Wrapper code, scripts and documentation use [MIT](LICENSE). Microsoft's icon
and services are not relicensed. See [NOTICE](NOTICE) for asset and runtime notices.
