require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { encode } = require('tiktoken');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pricing = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pricing.json'), 'utf8'));

app.get('/', (req, res) => {
  res.render('index', { pricing });
});

app.post('/calculate', (req, res) => {
  const { provider, model, inputText, outputWords, requests } = req.body;
  const inputTokens = encode(inputText).length;
  const outputTokens = Math.round(outputWords * 1.33);
  const p = pricing[provider]?.find(m => m.model === model);
  if (!p) return res.status(400).send("Model not found");

  let cost;
  if (p.unit === "per image") {
    cost = (p.input + p.output) * requests;
  } else if (p.unit === "per minute") {
    cost = p.input * requests;
  } else if (p.unit === "per second") {
    cost = p.input * requests;
  } else {
    cost = ((inputTokens * p.input) + (outputTokens * p.output)) / 1_000_000 * requests;
  }

  const suggestions = [];
  if (cost > 100) suggestions.push('Consider batching or caching');
  if (provider === 'openai' && model.includes('gpt-4')) suggestions.push('Try gpt-4o-mini → ~90% cheaper');

  res.render('results', {
    provider, model, inputTokens, outputTokens, requests,
    cost: cost.toFixed(4), unit: p.unit || "per 1M tokens",
    context: p.context || "N/A", suggestions
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
