import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Backend proxy server running on port ${PORT}`);
});
