import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Replit deployments set PORT automatically. Use 3001 for local development
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from dist folder in production
const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

const DEVICE_MODEL_FINDER_URL = process.env.VITE_DEVICE_MODEL_FINDER_URL;
const MODEL_DB_INSERTION_URL = process.env.VITE_MODEL_DB_INSERTION_URL;

app.post('/api/device-model-finder', async (req, res) => {
  try {
    if (!DEVICE_MODEL_FINDER_URL) {
      return res.status(500).json({ error: 'API URL not configured' });
    }

    const response = await fetch(DEVICE_MODEL_FINDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Device Model Finder Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/model-db-insertion', async (req, res) => {
  try {
    if (!MODEL_DB_INSERTION_URL) {
      return res.status(500).json({ error: 'API URL not configured' });
    }

    const response = await fetch(MODEL_DB_INSERTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Model DB Insertion Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// In production, serve index.html for all other routes (client-side routing)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
