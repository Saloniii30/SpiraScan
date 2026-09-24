# SpiraScan

A responsive Parkinson’s awareness interface inspired by the supplied reference.
All application source files are plain, editable HTML, CSS, JavaScript, Python,
and SVG, with one HTML tag per line. There is no frontend build step.
OpenCV processing requires the Python packages listed below.

## This week's image-processing workflow

Open **Review a Spiral** on the home page, or visit `/workspace.html`.
No Supabase connection or login is required.

1. Choose or drop a JPEG, PNG, or WebP image, or click **Try a sample spiral**.
2. Review the original and select rotation, blur, thresholding, and speck removal.
3. Click **Process with OpenCV**.
4. Compare all eight stages, click a preview to enlarge it, and review quality notes.
5. Download individual PNG stages and the JSON report with measurements and settings.

Images are processed in memory on your local computer. There is no upload storage,
database connection, or external image service. Limits are 10 MB and 20 megapixels.
Processing preserves aspect ratio and limits the longest side to 1,200 pixels.

## Install image-processing dependencies once

Use Python 3.12 or newer and Node.js 18 or newer. In PowerShell, from this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

On macOS or Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

The server finds `.venv` automatically. If you use a different environment, set
`SPIRASCAN_PYTHON` to its absolute Python executable path before starting Node.
No virtual-environment activation is needed.

## Run locally

Install Node.js, then run `npm start` from this folder.
Open http://localhost:3000 in your browser.
Use the server instead of opening HTML files directly, because JavaScript modules need HTTP.

## Run from VS Code

Open this project folder in VS Code. In Run and Debug, select **Run SpiraScan** and press **F5**.
VS Code starts the Node server and opens your default browser after the server is ready.
Use **Shift+F5** to stop the server. Do not run `npm start` at the same time on port 3000.
If the browser does not open automatically, open the URL printed in the Debug Console.
This uses VS Code's built-in Node debugger and does not require an Edge browser debugging connection.

Configuration reference: https://code.visualstudio.com/docs/debugtest/debugging-configuration#_automatically-open-a-uri-when-debugging-a-server-program

## Project files

- `index.html`: landing page, information sections, and accessible information dialog.
- `login.html`: sign-in, account creation, and password recovery interface.
- `styles.css`: page styles and responsive layouts.
- `assets/brain.svg`: editable brain illustration.
- `js/app.js`: information dialogs and illustrative spirals.
- `js/config.js`: public Supabase configuration.
- `js/auth.js`: shared Supabase client initialization.
- `js/login.js`: authentication form behavior.
- `server.js`: local preview server, not a production server.
- `workspace.html` and `workspace.css`: image-review workspace and its styles.
- `js/workspace.js`: upload, preview, settings, processing, and download behavior.
- `processing-api.js`: local request validation and Python worker integration.
- `processing/pipeline.py`: readable OpenCV image-processing steps.
- `processing/worker.py`: JSON communication between Node and Python.
- `processing/test_pipeline.py`: synthetic-image and validation tests.
- `processing/README.md`: stage explanations, measurements, and limitations.
- `requirements.txt`: pinned Python dependencies.

## Connect Supabase later

1. Create a Supabase project and enable email/password authentication.
2. Add your project URL and publishable key to `js/config.js`. Never use a secret or service-role key in browser code.
3. In Supabase Authentication URL Configuration, set the production Site URL and allow the exact login callback URL, such as `http://localhost:3000/login.html` for local development.
4. Configure your email confirmation and recovery templates and delivery settings.
5. Test sign-up, email confirmation, sign-in, sign-out, and password recovery against the real project before launch.

The Supabase JavaScript client loads from esm.sh only when configuration is present. For production, bundle and pin the SDK through your chosen build tooling. Authentication is not simulated when configuration is empty.

Authentication remains optional and unconfigured. Image preprocessing works without
it. Disease prediction, database tables, and image storage are not implemented.
When adding storage, protect user data with Supabase row-level security and storage
policies; hiding a page in the browser is not access control.

## Checks

Run `npm run check` to validate JavaScript syntax.
Run `.\.venv\Scripts\python.exe -m unittest discover -s processing -v` to test
the actual OpenCV pipeline on generated images, including invalid files,
blank images, camera orientation, rotation, and transparent backgrounds.
Check the home page and login page at desktop and mobile widths.
The information dialog supports the close button, Escape, and clicking outside it.

The educational prototype does not diagnose Parkinson’s or provide a validated screening result.

If processing reports missing dependencies, run the installation commands above.
Use `npm start` or **Run SpiraScan** in VS Code, not Live Server or an HTML file
opened directly: the workspace needs the local `/api/process` endpoint.
If port 3000 is occupied, stop the older server before restarting this version.
