import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

export function validateSqlAssessments(phase, setupFor) {
  const db = new DatabaseSync(':memory:');
  const tasks = phase.tasks;
  const questions = Array.from(tasks, task => task.groups.flatMap(group => group.questions));
  const rows = sql => db.prepare(sql).all().map(row => Object.values(row));
  const query = (task, question) => questions[task][question].solution;
  const isolated = check => {
    db.exec('SAVEPOINT assessment_edge');
    try { check(); } finally { db.exec('ROLLBACK TO assessment_edge; RELEASE assessment_edge'); }
  };
  try {
    assert.deepEqual(questions.map(group => group.length), [15,30,6]);
    assert.deepEqual(Array.from(tasks[1].groups, group => group.questions.length), [10,10,10]);
    assert.deepEqual(Array.from(tasks, task => !!task.optional), [false,false,true]);
    let executed = 0;
    for (const [taskIndex, task] of tasks.entries()) {
      assert.equal(task.status, 'ready');
      assert.ok(task.sections.length && task.criteria && task.deliverable);
      const setup = setupFor(task, phase.topics);
      db.exec(setup);
      db.exec(setup); // Preparation must be safe to rerun in the same practice database.
      for (const question of questions[taskIndex]) {
        assert.ok(question.title && question.prompt && question.solution && question.table);
        // Reset for each independent question: no hidden dependence on a previous solution.
        db.exec(setup);
        const statement = db.prepare(question.solution);
        assert.deepEqual(statement.columns().map(column => column.name), Array.from(question.table.headers), question.title);
        assert.deepEqual(rows(question.solution), JSON.parse(JSON.stringify(question.table.rows)), question.title);
        executed++;
      }
    }
    db.exec(setupFor(tasks[0], phase.topics));
    assert.deepEqual(rows('SELECT COUNT(*), SUM(price * quantity) FROM orders'), [[8,19400]]);
    assert.deepEqual(rows('SELECT COUNT(*), SUM(amount) FROM payments'), [[7,13700]]);
    assert.deepEqual(rows('PRAGMA foreign_key_check'), []);

    isolated(() => {
      db.exec(`UPDATE orders SET order_date = '2026-08-31' WHERE order_id = 101;
        UPDATE orders SET order_date = '2026-09-01' WHERE order_id = 102;
        UPDATE orders SET order_date = '2026-09-30' WHERE order_id = 104;
        UPDATE orders SET order_date = '2026-10-01' WHERE order_id = 105;`);
      assert.deepEqual(rows(query(0,5)), [[8400]], 'September bounds');
    });
    isolated(() => {
      db.exec('UPDATE orders SET paid = 0');
      assert.deepEqual(rows(query(0,4)), [[0,0]]);
      assert.deepEqual(rows(query(1,13)), [[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]);
    });
    isolated(() => {
      db.exec(`INSERT INTO customers VALUES (7, 'Анна');
        INSERT INTO orders VALUES (109, 'Анна', 'Сочи', 'Книга', 'Книги', 1200, 1, '2026-09-06', 0, NULL);
        INSERT INTO order_customers VALUES (109,7);`);
      assert.deepEqual(rows(query(0,8)).at(-1), [7,'Анна',1,1200], 'Same names must stay separate');
      assert.deepEqual(rows(query(1,13)).slice(-2), [[6,0],[7,0]], 'Keep no-orders and unpaid-only customers');
    });
    isolated(() => {
      db.exec('UPDATE orders SET price = 4500 WHERE order_id = 101');
      assert.deepEqual(rows(query(0,10))[0], [1,101,4500], 'Highest order tie uses lower id');
    });
    isolated(() => {
      db.exec("UPDATE orders SET order_date = '2026-09-01' WHERE order_id = 103");
      assert.deepEqual(rows(query(1,24))[0], [1,101], 'First order tie uses lower id');
      assert.deepEqual(rows(query(1,29))[0], [1,103,0], 'Same-day repeat has zero gap');
    });
    isolated(() => {
      db.exec("UPDATE orders SET order_date = '2026-09-07' WHERE order_date = '2026-09-05'");
      assert.deepEqual(rows(query(0,12)).at(-1), ['2026-09-07',4400,3200,19400]);
    });
    isolated(() => {
      db.exec('INSERT INTO payments VALUES (8,101,100)');
      assert.deepEqual(rows(query(0,14)), [[8,8,0,19400,13800]], 'Added payments cannot multiply orders');
      assert.deepEqual(rows(query(1,19)), [[101]], 'Reconciliation detects overpayment');
      assert.deepEqual(rows(query(0,13))[0], [101,3200,3300,-100], 'Negative balance remains visible');
    });
    isolated(() => {
      db.exec('DELETE FROM order_customers WHERE order_id = 108');
      assert.deepEqual(rows(query(1,18)), [[108]], 'Missing links detected');
    });
    isolated(() => {
      // Equal order amounts must both survive, unlike SUM(DISTINCT amount).
      db.exec('UPDATE orders SET price = 1200, quantity = 1 WHERE order_id = 108');
      assert.deepEqual(rows(query(0,14)), [[8,8,0,19800,13700]]);
    });
    isolated(() => {
      db.exec('DELETE FROM payments; DELETE FROM order_customers; DELETE FROM orders;');
      assert.deepEqual(rows(query(0,4)), [[0,null]], 'Empty share is undefined');
      assert.deepEqual(rows(query(0,9)), []);
      assert.deepEqual(rows(query(0,12)), []);
      assert.deepEqual(rows(query(0,14)), [[0,0,0,null,null]]);
      assert.deepEqual(rows(query(1,16)), [[6,0]], 'All registered customers have zero orders');
    });
    isolated(() => {
      db.exec('UPDATE listings SET views = 0, contacts = 0');
      assert.deepEqual(rows(query(2,3)), [[null]]);
      assert.deepEqual(rows(query(2,2)), [['Книги',0,0,null],['Лампы',0,0,null]]);
    });
    isolated(() => {
      db.exec('DELETE FROM listings');
      assert.deepEqual(rows(query(2,3)), [[null]]);
      assert.deepEqual(rows(query(2,4)), []);
    });
    console.log(`Validated ${executed} assessment queries: answer tables, independent setup and edge cases.`);
  } finally { db.close(); }
}
