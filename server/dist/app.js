"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const example_1 = require("./ai-bpmn/example");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Hello, world!');
});
app.get('/execute', (req, res) => {
    example_1.engine.execute(() => {
        res.send('Execution completed');
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
