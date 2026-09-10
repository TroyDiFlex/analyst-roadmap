import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// Independent answer keys: compare the actual learner queries, not rewritten SQL.
const expectedExercises = {
  4: [[[108, 800], [106, 1200], [102, 1600], [105, 2100]],
    [['Аксессуары'], ['Дом'], ['Книги'], ['Электроника']]],
  5: [
    [['Анна', 2, 7700], ['Света', 2, 6000], ['Борис', 2, 2800], ['Илья', 1, 2100], ['Олег', 1, 800]],
    [[13700]], [['Электроника', 9800], ['Дом', 3600], ['Книги', 3600]], [[5, 2425, 800, 4500]]
  ],
  6: [
    [[101, 'крупный'], [102, 'маленький'], [103, 'крупный'], [104, 'средний'],
      [105, 'средний'], [106, 'маленький'], [107, 'крупный'], [108, 'маленький']],
    [[6, 0.75]], [[null]]
  ],
  7: [[[13700]], [[101, 2], [102, 3], [104, 4], [107, 3], [108, 4]], [['kazan', 'Заказ №102']]],
  8: [[[6]], [[8]], [[7]], [[101, 2, 3200]]],
  9: [
    [[6, 'Нина']],
    [[1, 'Анна', 2], [2, 'Борис', 2], [3, 'Света', 2], [4, 'Илья', 1], [5, 'Олег', 1], [6, 'Нина', 0]],
    [[1, 'Анна', 1, 3200], [2, 'Борис', 1, 1600], [3, 'Света', 2, 6000],
      [4, 'Илья', 1, 2100], [5, 'Олег', 1, 800], [6, 'Нина', 0, 0]]
  ],
  10: [[[5, 19400, 3880]], [[1, 'Анна', 7700], [3, 'Света', 6000]]],
  11: [
    [[1, 103, 4500], [2, 102, 1600], [3, 107, 3600], [4, 105, 2100], [5, 108, 800]],
    [['Электроника', 9800, 1], ['Дом', 3600, 2], ['Книги', 3600, 2], ['Аксессуары', 2400, 4]],
    [['2026-09-01', 4800, null, 4800], ['2026-09-02', 4500, -300, 9300],
      ['2026-09-03', 4500, 0, 13800], ['2026-09-04', 1200, -3300, 15000], ['2026-09-05', 4400, 3200, 19400]]
  ],
  12: [[[101, 2]], [[8, 8, 0, 19400, 13700]], []]
};

export function validateSqlCourse(topics) {
  const db = new DatabaseSync(':memory:');
  // Course snippets contain no semicolons within strings or comments.
  const statements = sql => sql.split(';').map(part => part.trim()).filter(Boolean);
  const rows = sql => db.prepare(sql).all().map(row => Object.values(row));
  const run = sql => statements(sql).map(statement => rows(statement));
  const course = day => topics.find(topic => topic.course.day === day).course;
  const solution = (day, index) => statements(course(day).exercise.solution)[index];
  const setup = course(2).sections.find(section => section.codeLabel === 'Вставь и выполни один раз').code;
  const relationSetup = course(8).sections.find(section => section.codeLabel === 'Подготовка для дней 8–12').code;
  let executed = 0;

  try {
    for (const topic of topics) {
      for (const section of topic.course.sections) {
        if (!section.code) continue;
        const results = run(section.code);
        executed += results.length;
        // Displayed tables may be excerpts; every displayed row must occur in
        // one of that section's actual query results with the stated columns.
        if (section.table) {
          const candidates = statements(section.code).map(statement => {
            const query = db.prepare(statement);
            return { columns: query.columns().map(column => column.name), rows: rows(statement) };
          }).filter(result => result.columns.join('|') === section.table.headers.join('|'));
          assert.ok(candidates.length, `Day ${topic.course.day}: displayed table columns mismatch`);
          for (const expected of section.table.rows) {
            if (expected.includes('…')) continue;
            assert.ok(candidates.some(result => result.rows.some(row =>
              row.map(value => value === null ? 'NULL' : String(value)).join('|') === expected.join('|')
            )), `Day ${topic.course.day}: displayed row is not a query result: ${expected}`);
          }
        }
      }
      if (topic.course.exercise.solution) {
        const results = run(topic.course.exercise.solution);
        executed += results.length;
        if (expectedExercises[topic.course.day]) {
          assert.deepEqual(results, expectedExercises[topic.course.day], `Day ${topic.course.day}: exercise answers`);
        }
        if (topic.course.day === 2) {
          assert.deepEqual(results[0].map(row => row.join('|')).sort(), [
            'Анна|Москва|Наушники', 'Борис|Казань|Чехол', 'Анна|Москва|Клавиатура',
            'Света|Тбилиси|Книга', 'Илья|Москва|Мышь', 'Борис|Казань|Книга',
            'Света|Тбилиси|Лампа', 'Олег|Москва|Чехол'
          ].sort());
          assert.deepEqual(results[1].sort((a, b) => a[0] - b[0]), [
            [101, 3200, 1, 3200], [102, 800, 2, 1600], [103, 4500, 1, 4500], [104, 1200, 2, 2400],
            [105, 2100, 1, 2100], [106, 1200, 1, 1200], [107, 1800, 2, 3600], [108, 800, 1, 800]
          ]);
        }
        if (topic.course.day === 3) {
          assert.deepEqual(results.map(result => result.map(row => row[0]).sort((a, b) => a - b)),
            [[104, 105, 106], [103, 106], [104, 107], [104, 106, 107], [104, 106]],
            'Day 3: compare membership without assuming order before ORDER BY is taught');
        }
      }
    }

    assert.deepEqual(rows(`SELECT COUNT(*), SUM(price * quantity),
      SUM(CASE WHEN paid = 1 THEN price * quantity ELSE 0 END), COUNT(delivery_date)
      FROM orders`), [[8, 19400, 13700, 5]]);
    assert.deepEqual(rows('PRAGMA foreign_key_check'), []);
    assert.throws(() => db.exec('INSERT INTO order_customers VALUES (999, 1)'), /FOREIGN KEY/);
    assert.throws(() => db.exec('INSERT INTO order_customers VALUES (101, 2)'), /UNIQUE/);

    const isolated = check => {
      db.exec('SAVEPOINT edge_case');
      try { check(); } finally { db.exec('ROLLBACK TO edge_case; RELEASE edge_case'); }
    };

    isolated(() => {
      db.exec(`UPDATE orders SET price = 1999, quantity = 1 WHERE order_id = 101;
        UPDATE orders SET price = 2000, quantity = 1 WHERE order_id = 102;
        UPDATE orders SET price = 2999, quantity = 1 WHERE order_id = 103;
        UPDATE orders SET price = 3000, quantity = 1 WHERE order_id = 104;`);
      assert.deepEqual(rows(solution(6, 0)).slice(0, 4),
        [[101, 'маленький'], [102, 'средний'], [103, 'средний'], [104, 'крупный']]);
      db.exec('UPDATE orders SET paid = 0');
      assert.deepEqual(rows(solution(6, 1)), [[0, 0]], 'Existing unpaid orders have zero share, not NULL');
    });

    isolated(() => {
      db.exec(`UPDATE orders SET order_date = '2026-08-31' WHERE order_id = 101;
        UPDATE orders SET order_date = '2026-09-01' WHERE order_id = 102;
        UPDATE orders SET order_date = '2026-09-30' WHERE order_id = 104;
        UPDATE orders SET order_date = '2026-10-01' WHERE order_id = 105;`);
      assert.deepEqual(rows(solution(7, 0)), [[8400]], 'Month start included, next month excluded');
    });

    isolated(() => {
      // Same name, distinct customer: grouping by name alone must not merge them.
      db.exec(`INSERT INTO customers VALUES (7, 'Анна');
        INSERT INTO orders VALUES (109, 'Анна', 'Сочи', 'Книга', 'Книги', 1200, 1, '2026-09-06', 0, NULL);
        INSERT INTO order_customers VALUES (109, 7);`);
      assert.deepEqual(rows(solution(9, 1)).at(-1), [7, 'Анна', 1]);
      assert.deepEqual(rows(solution(9, 2)).slice(-2), [[6, 'Нина', 0, 0], [7, 'Анна', 0, 0]],
        'LEFT JOIN must retain both no-orders and unpaid-only customers');
      assert.deepEqual(rows(solution(10, 0)), [[6, 20600, 20600 / 6]]);
    });

    isolated(() => {
      db.exec('UPDATE orders SET price = 4500 WHERE order_id = 101');
      assert.deepEqual(rows(solution(11, 0))[0], [1, 101, 4500], 'ROW_NUMBER tie uses lowest order_id');
    });

    isolated(() => {
      db.exec(`UPDATE orders SET order_date = '2026-09-07' WHERE order_date = '2026-09-05'`);
      assert.deepEqual(rows(solution(11, 2)).at(-1), ['2026-09-07', 4400, 3200, 19400],
        'LAG uses previous available row when dates have a gap');
    });

    isolated(() => {
      db.exec('INSERT INTO payments VALUES (8, 101, 100)');
      assert.deepEqual(rows(solution(12, 1)), [[8, 8, 0, 19400, 13800]], 'Extra payment must not duplicate order amount');
      assert.deepEqual(rows(solution(12, 2)), [[101]], 'Payment reconciliation must detect overpayment');
    });

    const qualitySql = course(12).sections.at(-1).code;
    assert.deepEqual(run(qualitySql), [[], []]);
    isolated(() => {
      db.exec(`UPDATE orders SET quantity = -1 WHERE order_id = 101;
        UPDATE orders SET delivery_date = '2026-08-31' WHERE order_id = 102;
        UPDATE orders SET paid = 2 WHERE order_id = 103;
        UPDATE orders SET order_date = 'unknown' WHERE order_id = 104;
        UPDATE orders SET customer = '  ' WHERE order_id = 105;
        DELETE FROM order_customers WHERE order_id = 108;`);
      assert.deepEqual(run(qualitySql), [[[101], [102], [103], [104], [105]], [[108]]]);
    });

    // Reopening a later lesson and resetting an existing database must both work.
    db.exec(relationSetup);
    db.exec(setup);
    db.exec(relationSetup);
    assert.deepEqual(rows(solution(12, 1)), [[8, 8, 0, 19400, 13700]]);
    assert.deepEqual(rows('PRAGMA foreign_key_check'), []);

    isolated(() => {
      db.exec('DELETE FROM payments; DELETE FROM order_customers; DELETE FROM orders;');
      assert.deepEqual(rows(solution(6, 1)), [[0, null]], 'Empty population has undefined share');
      assert.deepEqual(rows(solution(10, 0)), [[0, null, null]]);
      assert.deepEqual(rows(solution(10, 1)), []);
      assert.deepEqual(rows(solution(11, 2)), []);
    });

    console.log(`Validated ${topics.length} SQL lessons: ${executed} statements, answer tables and edge cases.`);
  } finally {
    db.close();
  }
}
