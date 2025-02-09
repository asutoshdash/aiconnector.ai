"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engine = void 0;
const bpmn_engine_1 = require("bpmn-engine");
const id = Math.floor(Math.random() * 10000);
const source = `
<?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2" />
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression>true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>`;
const engine = new bpmn_engine_1.Engine({
    name: 'execution example',
    source,
    variables: {
        id,
    },
});
exports.engine = engine;
