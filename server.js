const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Increase timeout limits
const TIMEOUT = 60000; // 60 seconds

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Ensure uploads directory exists
fs.mkdir('uploads', { recursive: true }).catch(console.error);

// Helper functions
const encodeFileToBase64 = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
};

const cleanupFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
};

// Basic chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'llama2' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model,
      prompt: message,
      stream: false
    }, { timeout: TIMEOUT });

    res.json({
      success: true,
      response: response.data.response,
      model
    });

  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// OPTIMIZED streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, model = 'llama2' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Optimized SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send immediate connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Optimized Ollama request with better parameters
    const ollamaRequest = {
      model,
      prompt: message,
      stream: true,
      options: {
        temperature: 0.7,
        num_predict: 2048,
        num_ctx: 2048,
        top_k: 40,
        top_p: 0.9,
        repeat_penalty: 1.1,
        // Reduce batch processing for faster streaming
        num_batch: 8,
        num_gpu: -1, // Use all available GPU layers
      }
    };

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, ollamaRequest, {
      responseType: 'stream',
      timeout: TIMEOUT
    });

    let buffer = '';
    
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              // Send immediately without batching
              res.write(`data: ${JSON.stringify({ 
                type: 'token', 
                content: data.response 
              })}\n\n`);
            }
            if (data.done) {
              res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              res.end();
            }
          } catch (parseError) {
            // Skip malformed JSON
          }
        }
      });
    });

    response.data.on('error', (error) => {
      console.error('Stream error:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });

    response.data.on('end', () => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.done) {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          }
        } catch (parseError) {
          // Ignore
        }
      }
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected');
      response.data.destroy();
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      response.data.destroy();
    });

  } catch (error) {
    console.error('Stream setup error:', error.message);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: 'Stream failed to initialize' 
    })}\n\n`);
    res.end();
  }
});

// Chat with file upload
app.post('/api/chat/file', upload.single('file'), async (req, res) => {
  try {
    const { message, model = 'llava' } = req.body;
    const file = req.file;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let requestBody = { 
      model, 
      prompt: message, 
      stream: false,
      options: {
        num_ctx: 4096, // Larger context for vision models
        temperature: 0.7
      }
    };

    if (file) {
      const base64Data = await encodeFileToBase64(file.path);
      requestBody.images = [base64Data];
      await cleanupFile(file.path);
    }

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, requestBody, {
      timeout: TIMEOUT * 2 // Longer timeout for vision models
    });

    res.json({
      success: true,
      response: response.data.response,
      model,
      fileProcessed: !!file
    });

  } catch (error) {
    console.error('File chat error:', error.message);
    if (req.file) await cleanupFile(req.file.path);
    res.status(500).json({ error: 'Failed to process file request' });
  }
});

// Get available models
app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    res.json({
      success: true,
      models: response.data.models || []
    });
  } catch (error) {
    console.error('Models error:', error.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Health check with performance info
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const responseTime = Date.now() - start;
    
    res.json({
      success: true,
      message: 'Healthy',
      responseTime: `${responseTime}ms`,
      models: response.data.models?.length || 0,
      ollamaUrl: OLLAMA_URL
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({
      success: false,
      message: 'Ollama not accessible',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log('Performance tips:');
  console.log('- Ensure Ollama has GPU acceleration enabled');
  console.log('- Use smaller models for faster responses');
  console.log('- Check system resources (RAM/VRAM)');
});