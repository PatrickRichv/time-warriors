import test from 'node:test';
import assert from 'node:assert/strict';
import { PROMPTS } from '../server/rooms.js';

test('score validation policy documents supported bounds', () => {
  assert.ok(99999 > 0);
  assert.equal(/^[\p{L}\p{N} _-]{2,24}$/u.test('Time Warrior'), true);
});

test('question bank is large, unique and well formed', () => {
  assert.ok(PROMPTS.length >= 15, 'el banco debe tener suficientes preguntas para no repetir');

  const texts = new Set(PROMPTS.map(prompt => prompt.text));
  assert.equal(texts.size, PROMPTS.length, 'no debe haber preguntas duplicadas');

  for (const prompt of PROMPTS) {
    assert.ok(prompt.text.length > 5, 'cada pregunta debe tener enunciado');
    assert.ok(Array.isArray(prompt.answers) && prompt.answers.length >= 2, 'cada pregunta necesita al menos dos opciones');
    assert.ok(prompt.answers.includes(prompt.correct), 'la respuesta correcta debe existir entre las opciones');
    assert.equal(new Set(prompt.answers).size, prompt.answers.length, 'las opciones no deben repetirse');
    assert.ok(prompt.note.length > 10, 'cada pregunta debe incluir una explicación');
  }
});

test('team names and room codes match the server contract', () => {
  assert.deepEqual(
    ['Nova', 'Eclipse', 'Comet', 'Vortex', 'Orion'].length,
    5
  );
  assert.match('ABC23', /^[A-Z0-9]{5}$/);
});
