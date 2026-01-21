Deploying the frontend to Vercel

1. Connect your repository to Vercel and set the project root to `frontend` (if monorepo, configure accordingly).

2. Set the build command and output (Create React App defaults):

 - Build Command: `npm run build`
 - Install Command: `npm install`
 - Output Directory: `build`

3. Add an environment variable for the backend API URL:

 - Key: `REACT_APP_API_URL`
 - Value: `https://<YOUR_BACKEND_HOST>` (e.g. the Render URL)

4. Deploy. The app will use `REACT_APP_API_URL` at runtime to call the backend endpoints.

Local testing with env var:

```bash
cd frontend
REACT_APP_API_URL="https://your-backend.example.com" npm run build
serve -s build
```

Notes:
- We changed the frontend to use `REACT_APP_API_URL` (see `src/api.js`). If the variable is empty, the app falls back to relative paths.
- Make sure your backend allows CORS requests from your Vercel frontend domain.
