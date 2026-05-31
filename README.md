# WifiShelf

**WifiShelf** is a lightweight, cross‑platform file‑sync and remote file‑browser built with **Node.js** and **Express**.  It lets you expose a folder over the local network and provides a modern, glass‑morphic web UI with:

- Directory navigation via URL hash (deep‑linking)
- Image & video thumbnails (including video preview frames)
- Adjustable icon sizes (small / medium / large / XXL)
- **Shift‑Delete**‑style permanent deletion with multi‑select via long‑press
- Batch delete with confirmation when multiple items are selected
- Basic‑Auth authentication (default `sean`/`sean`)
- Responsive dark‑mode design using only vanilla HTML, CSS and JavaScript

---

## Project Structure

```
WifiShelf/                     ← project root (your repo)
│
├─ public/                    ← static assets served by the server
│   ├─ index.html            ← main UI page
│   ├─ style.css             ← elegant glass‑morphic styling
│   └─ app.js                ← client‑side logic (routing, thumbnails, selection)
│
├─ server.js                  ← Express backend (API endpoints, auth)
│
├─ base-file.sh               ← convenient startup script (Linux/macOS)
├─ run.bat                    ← Windows batch script
├─ run.ps1                    ← PowerShell script
│
└─ package.json              ← npm metadata & dependencies
```

---

## Prerequisites

- **Node.js 18+** (includes npm)
- A folder you want to share (e.g., `C:\path\to\your\wifiShelf` on Windows or `~/wifiShelf` on *nix)

---

## Installation & Setup

1. **Clone the repository** (or download the zip)
   ```bash
   git clone https://github.com/your‑username/WifiShelf.git
   cd WifiShelf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the shared folder**
   - Edit `config.json` (created automatically) and set `"defaultRoot"` to the absolute path you want to share, e.g.:

```json
{
  "defaultRoot": "C:/path/to/your/wifiShelf"
}
```
   - No need to edit `server.js`; it will read this config at startup.
   - Save the file.

4. **Run the server** – choose the script that matches your OS:
   - **Linux/macOS**
     ```bash
     sh base-file.sh   # starts the server on port 3005
     ```
   - **Windows (Command Prompt)**
     ```cmd
     run.bat
     ```
   - **Windows (PowerShell)**
     ```powershell
     .\run.ps1
     ```
   The server will listen on `http://<your‑machine‑ip>:3005`.

5. **Open the UI**
   - Point your browser to `http://<your‑machine‑ip>:3005`.
   - The default credentials are `sean` / `sean`.  Change them in `server.js` if desired.

---

## Usage Tips

- **Navigate** using the breadcrumbs or the address bar (hash).  URLs are deep‑linkable, e.g. `http://host:3005#photos/vacation`.
- **Change icon size** with the dropdown in the toolbar.
- **Select multiple items**:
  1. Long‑press (≈500 ms) on a card to toggle selection.
  2. Selected items are highlighted and the **Delete Selected** button appears.
  3. Click the button – a confirmation dialog will show a different message for one vs. many items.
- **Delete** – single‑item trash can icon opens the same confirmation modal.
- **Download** – click the download icon on a card or use the download button in the preview modal.

---

## Scripts Overview

| Script | Platform | Purpose |
|--------|----------|---------|
| `base-file.sh` | Linux/macOS | Starts the server (`npm start`) and prints the local IP address.
| `run.bat` | Windows (cmd) | Wrapper that runs `npm start` and shows the URL.
| `run.ps1` | Windows (PowerShell) | Same as `run.bat` but for PowerShell.

All scripts simply execute `npm start` (which runs `node server.js`) and display the access URL, so you can edit them if you need custom environment variables.

---

## Customisation

- **Port** – modify the `PORT` constant in `server.js` (default `3005`).
- **Authentication** – edit the Basic‑Auth middleware in `server.js` to use your own users or disable it entirely.
- **Styling** – adjust colors, fonts, or glass‑morphism effects in `public/style.css`.
- **Front‑end behaviour** – the client side lives in `public/app.js` – feel free to extend features (e.g., drag‑and‑drop upload).

---
## Build the Packaged Executable

The project can be bundled into a single Windows executable using **pkg**.

```bash
# Install pkg globally (if not already)
npm install -g pkg   # or `npm install --save-dev pkg` as a dev dependency

# Build the .exe (see package.json script `build:exe`)
npm run build:exe

# The resulting file `WifiShelf-win.exe` will be placed in the project root.
```

---

## License

MIT – feel free to fork, modify, and deploy this project for personal or commercial use.

---

**Happy file‑browsing!**
