import express from 'express';
import { engine } from './ai-bpmn/example';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello, world!');
});

app.get('/execute', (req, res) => {
  engine.execute(() => {
    res.send('Execution completed');
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});