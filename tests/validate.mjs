import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validateSqlCourse } from './sql-course.mjs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const dataSource = await readFile(new URL('js/data.js', root), 'utf8');
const context = vm.createContext({});
vm.runInContext(`${dataSource}\nglobalThis.roadmap = { PHASES, TOTAL_TOPICS, TOTAL_TASKS };`, context);
const { PHASES, TOTAL_TOPICS, TOTAL_TASKS } = context.roadmap;

assert.equal(PHASES.length, 6, 'Roadmap must contain 6 phases');
assert.equal(PHASES.map(phase => phase.id).join(','), '1,2,3,4,5,6');
assert.equal(new Set(PHASES.map(phase => phase.title)).size, PHASES.length, 'Phase titles must be unique');

for (const phase of PHASES) {
  assert.equal(phase.accent.toLowerCase(), '#fb7185');
  assert.ok(phase.title && phase.duration && phase.outcome && phase.note);
  assert.ok(phase.topics.length >= 5, `${phase.title}: too few topics`);
  assert.ok(phase.tasks.length >= 3, `${phase.title}: too few tasks`);
  for (const topic of phase.topics) {
    assert.ok(topic.name && topic.desc && topic.practice && topic.done);
    assert.ok(Array.isArray(topic.learn) && topic.learn.length >= 3, `${topic.name}: vague learning scope`);
    assert.ok(Array.isArray(topic.resources) && topic.resources.length >= 1, `${topic.name}: missing exact resource`);
    for (const resource of topic.resources) {
      assert.ok(resource.title && /^https:\/\//.test(resource.url), `${topic.name}: invalid topic resource`);
    }
    assert.ok(['ready', 'development'].includes(topic.status), `${topic.name}: invalid readiness status`);
    if (topic.status === 'ready') {
      assert.ok(topic.course?.day && topic.course?.duration && topic.course?.goal, `${topic.name}: incomplete course header`);
      assert.ok(topic.course.sections?.length >= 3, `${topic.name}: course needs explanatory sections`);
      assert.ok(topic.course.exercise?.steps?.length >= 3, `${topic.name}: course needs a concrete exercise`);
      assert.ok(topic.course.exercise?.answer?.length >= 1, `${topic.name}: course needs self-check answers`);
    }
  }
  for (const task of phase.tasks) assert.ok(task.type && task.text && task.deliverable && task.criteria);
  for (const resource of phase.resources) {
    assert.ok(resource.title && /^https:\/\//.test(resource.url), `${phase.title}: invalid resource`);
  }
}

const readyTopics = PHASES.flatMap(phase => phase.topics).filter(topic => topic.status === 'ready');
assert.equal(readyTopics.length, 12, 'SQL must contain twelve ready lessons');
assert.equal(readyTopics.map(topic => topic.course.day).join(','), '1,2,3,4,5,6,7,8,9,10,11,12');
assert.ok(PHASES[0].status === 'partial', 'SQL phase must be marked partially ready');
assert.ok(PHASES.slice(1).every(phase => phase.status === 'development'), 'Unbuilt phases must stay in development');

validateSqlCourse(readyTopics);

assert.equal(TOTAL_TOPICS, PHASES.reduce((sum, phase) => sum + phase.topics.length, 0));
assert.equal(TOTAL_TASKS, PHASES.reduce((sum, phase) => sum + phase.tasks.length, 0));
assert.ok(TOTAL_TOPICS >= 35 && TOTAL_TOPICS <= 45, 'Unexpected roadmap breadth');
assert.ok(TOTAL_TASKS >= 18 && TOTAL_TASKS <= 24, 'Unexpected task breadth');

const familiarTasks = PHASES.flatMap(phase => phase.tasks).filter(task => task.type === 'Знакомые данные');
assert.ok(familiarTasks.length <= 6, 'Familiar-domain practice must not dominate the roadmap');
assert.ok(!PHASES.some(phase => /avito|marketplace|e-commerce|маркетплейс/i.test(phase.title)), 'No niche phase is allowed');

for (const path of ['js/data.js', 'js/storage.js', 'js/app.js', 'server.mjs']) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(path, root))], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path}: ${result.stderr}`);
}

const html = await readFile(new URL('index.html', root), 'utf8');
for (const asset of ['css/style.css', 'js/data.js', 'js/storage.js', 'js/app.js', 'icon.svg']) {
  assert.ok(html.includes(asset), `index.html must reference ${asset}`);
}

const app = await readFile(new URL('js/app.js', root), 'utf8');
for (const field of ['topic.learn', 'topic.resources', 'topic.practice', 'topic.done', 'topic.course']) {
  assert.ok(app.includes(field), `Topic UI must render ${field}`);
}

const storage = await readFile(new URL('js/storage.js', root), 'utf8');
assert.ok(storage.includes("analyst_roadmap_v2_progress_local"));
assert.ok(storage.includes("analystRoadmapV2"));
assert.ok(storage.includes("if (!remoteReady)"), 'Remote writes must stop when the shared envelope was not loaded');

const css = await readFile(new URL('css/style.css', root), 'utf8');
assert.ok(css.includes('--accent:        #fb7185'));
assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, 'CSS braces must balance');

console.log(`Validated ${PHASES.length} phases, ${TOTAL_TOPICS} topics and ${TOTAL_TASKS} tasks.`);
