// Условия и ручные эталоны ответов. Каждый solution запускается отдельно.
const sqlQuestion = (title, prompt, solution, headers, rows, explanation = '') => ({
  title, prompt, solution, table: { headers, rows }, explanation
});

function sqlAssessmentSetup(task, topics) {
  if (task.dataset === 'listings') return task.setup;
  return [2, 8].map(day => topics.find(topic => topic.course?.day === day)
    .course.sections.find(section => section.codeLabel?.startsWith(day === 2 ? 'Вставь' : 'Подготовка'))
    .code).join('\n\n');
}

const SQL_CUSTOMER_TOTALS = `WITH customer_totals AS (
  SELECT c.customer_id, c.customer_name,
    COUNT(o.order_id) AS order_count,
    COALESCE(SUM(o.price * o.quantity), 0) AS order_amount
  FROM customers AS c
  LEFT JOIN order_customers AS oc ON oc.customer_id = c.customer_id
  LEFT JOIN orders AS o ON o.order_id = oc.order_id
  GROUP BY c.customer_id, c.customer_name
)`;

const SQL_ORDER_REPORT = `WITH payment_totals AS (
  SELECT order_id, SUM(amount) AS paid_amount
  FROM payments
  GROUP BY order_id
), report AS (
  SELECT o.order_id, o.price * o.quantity AS order_amount,
    COALESCE(p.paid_amount, 0) AS paid_amount
  FROM orders AS o
  LEFT JOIN payment_totals AS p ON p.order_id = o.order_id
)`;

const SQL_DAILY_TOTALS = `WITH daily AS (
  SELECT order_date, SUM(price * quantity) AS order_amount
  FROM orders
  GROUP BY order_date
)`;

const SQL_ASSESSMENTS = [
  {
    type: 'Контрольная', status: 'ready', dataset: 'orders',
    text: '15 бизнес-вопросов: от выборки заказов до отчёта с платежами и проверки его качества.',
    deliverable: 'SQL-файл с 15 пронумерованными запросами; результаты в тексте или таблицах; схема связей и три вывода.',
    criteria: 'Все 15 запросов дают ожидаемые результаты. Объяснены связи, отличие заказов от оплат и защита от размножения строк. После исправлений ошибочные задачи решены заново без готового SQL.',
    sections: [{
      title: 'Как выполнить',
      paragraphs: [
        'Начинай после дня 12. Выдели 2–3 занятия по 60–90 минут. В SQLiteOnline выбери SQLite и выполни подготовку ниже один раз. Затем замени её в редакторе своим запросом и нажимай Run. Каждый вопрос независим: результаты предыдущего запроса не сохраняются как таблица.',
        'Синтаксис разрешено смотреть в уроках. Сначала сохрани свою попытку, затем раскрывай ответ и решение конкретного вопроса. Запиши запросы в обычный текстовый файл с расширением .sql (например, control.sql), а результаты и выводы — в заметку к заданию или отдельный текстовый файл. Excel и Python не нужны.',
        'Сумма заказа — price * quantity. Сумма оплат — сумма amount из payments. paid = 1 означает полностью оплаченный заказ. Возвратов и частичных оплат неоплаченных заказов в исходнике нет. Данные охватывают только 1–5 сентября 2026 года, поэтому итоги нельзя называть продажами за полный месяц. Суммы — в рублях. Если вопрос не задаёт фильтр, используй все заказы.'
      ]
    }, {
      title: 'Письменная часть после запросов',
      bullets: [
        'Для каждой из четырёх таблиц укажи смысл строки и первичный ключ. Нарисуй связи стрелками в тексте и подпиши один-к-одному или один-ко-многим. Отдельно укажи, гарантирует ли ключ наличие связи для каждого заказа.',
        'Напиши три коротких вывода: какая категория лидирует по сумме заказов; чем сумма заказов отличается от суммы оплат; почему отчёт нельзя переносить на весь сентябрь. Подкрепи первые два вывода числами.',
        'Объясни, почему SUM(DISTINCT price * quantity) не является общим исправлением дублей после JOIN: разные заказы могут иметь одинаковую сумму.'
      ]
    }],
    review: [
      'orders: один заказ, ключ order_id. customers: один покупатель, ключ customer_id. order_customers: соответствие заказа покупателю, ключ order_id. payments: один платёж, ключ payment_id.',
      'customers → order_customers: один-ко-многим; orders → order_customers: не более одного соответствия на заказ; orders → payments: один-ко-многим. В исходнике связь с покупателем есть у каждого заказа, но первичный ключ order_customers сам по себе этого не гарантирует.',
      'Электроника лидирует с 9800. Сумма заказов 19400, оплат 13700, разница 5700 приходится на неоплаченные 103 и 106. Это небольшой учебный фрагмент за 1–5 сентября, без основания для вывода за полный месяц.',
      'После прямого LEFT JOIN payments заказ 101 повторяется дважды: сумма заказов становится 22600. Сначала агрегируй платежи до одной строки на заказ. DISTINCT по сумме может удалить сумму другого заказа и занизить итог.'
    ],
    groups: [{ title: '15 бизнес-вопросов', questions: [
      sqlQuestion('Крупные оплаченные заказы', 'Покажи order_id и order_amount оплаченных заказов Москвы с суммой не меньше 2000. Сортировка: сумма по убыванию, затем номер по возрастанию.',
        `SELECT order_id, price * quantity AS order_amount
FROM orders
WHERE city = 'Москва' AND paid = 1 AND price * quantity >= 2000
ORDER BY order_amount DESC, order_id;`, ['order_id', 'order_amount'], [[101,3200],[105,2100]]),
      sqlQuestion('Объём заказов', 'Посчитай количество заказов, сумму и среднюю сумму заказа за весь фрагмент. Назови столбцы order_count, order_amount, avg_order_amount.',
        `SELECT COUNT(*) AS order_count, SUM(price * quantity) AS order_amount,
  AVG(price * quantity) AS avg_order_amount
FROM orders;`, ['order_count','order_amount','avg_order_amount'], [[8,19400,2425]]),
      sqlQuestion('Категории', 'Для каждой категории посчитай число и сумму всех заказов. Сортируй по сумме по убыванию, при равенстве — по category по возрастанию.',
        `SELECT category, COUNT(*) AS order_count, SUM(price * quantity) AS order_amount
FROM orders GROUP BY category
ORDER BY order_amount DESC, category;`, ['category','order_count','order_amount'], [['Электроника',3,9800],['Дом',1,3600],['Книги',2,3600],['Аксессуары',2,2400]]),
      sqlQuestion('Крупные категории', 'Выведи категории с суммой всех заказов не меньше 3500 и эту сумму. Используй HAVING; сортировка как в вопросе 3.',
        `SELECT category, SUM(price * quantity) AS order_amount
FROM orders GROUP BY category
HAVING SUM(price * quantity) >= 3500
ORDER BY order_amount DESC, category;`, ['category','order_amount'], [['Электроника',9800],['Дом',3600],['Книги',3600]]),
      sqlQuestion('Доля оплаченных', 'Одной строкой выведи число полностью оплаченных заказов и их долю среди всех заказов, от 0 до 1. При пустой orders число должно быть 0, доля — NULL.',
        `SELECT COUNT(CASE WHEN paid = 1 THEN 1 END) AS paid_count,
  COUNT(CASE WHEN paid = 1 THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) AS paid_share
FROM orders;`, ['paid_count','paid_share'], [[6,0.75]], 'Доля считается по числу заказов, а не по деньгам.'),
      sqlQuestion('Оплаченные заказы сентября', 'Посчитай сумму полностью оплаченных заказов с датой оформления в сентябре 2026. Используй полуоткрытый интервал. При отсутствии таких заказов оставь NULL.',
        `SELECT SUM(price * quantity) AS paid_order_amount
FROM orders
WHERE paid = 1 AND order_date >= '2026-09-01' AND order_date < '2026-10-01';`, ['paid_order_amount'], [[13700]], 'Это отбор по дате заказа. Даты платежей в схеме нет.'),
      sqlQuestion('Длительная доставка', 'Покажи номера и срок доставки для заказов с известной доставкой дольше 3 дней. Срок — целое число дней, сортировка по номеру.',
        `SELECT order_id,
  CAST(julianday(delivery_date) - julianday(order_date) AS INTEGER) AS delivery_days
FROM orders
WHERE julianday(delivery_date) - julianday(order_date) > 3
ORDER BY order_id;`, ['order_id','delivery_days'], [[104,4],[108,4]], 'Неизвестные даты не означают нулевой срок доставки.'),
      sqlQuestion('Покупатели без заказов', 'Через LEFT JOIN найди покупателей без заказов: customer_id и customer_name, по идентификатору.',
        `SELECT c.customer_id, c.customer_name
FROM customers AS c
LEFT JOIN order_customers AS oc ON oc.customer_id = c.customer_id
WHERE oc.order_id IS NULL
ORDER BY c.customer_id;`, ['customer_id','customer_name'], [[6,'Нина']]),
      sqlQuestion('Все покупатели в отчёте', 'Для каждого покупателя выведи идентификатор, имя, число и сумму заказов. Сохрани покупателей без заказов с нулями. Группируй по идентификатору и имени; сортировка по идентификатору.',
        `${SQL_CUSTOMER_TOTALS}
SELECT customer_id, customer_name, order_count, order_amount
FROM customer_totals ORDER BY customer_id;`, ['customer_id','customer_name','order_count','order_amount'], [[1,'Анна',2,7700],[2,'Борис',2,2800],[3,'Света',2,6000],[4,'Илья',1,2100],[5,'Олег',1,800],[6,'Нина',0,0]]),
      sqlQuestion('Выше среднего по покупателям', 'Через CTE найди покупателей, у которых сумма всех заказов выше средней суммы на покупателя с хотя бы одним заказом. Нину исключи из знаменателя. Выведи идентификатор, имя и сумму, по идентификатору.',
        `${SQL_CUSTOMER_TOTALS}
SELECT customer_id, customer_name, order_amount
FROM customer_totals
WHERE order_amount > (SELECT AVG(order_amount) FROM customer_totals WHERE order_count > 0)
ORDER BY customer_id;`, ['customer_id','customer_name','order_amount'], [[1,'Анна',7700],[3,'Света',6000]], 'Средняя по пяти покупателям с заказами: 19400 / 5 = 3880. Это не средний чек 2425.'),
      sqlQuestion('Самый дорогой заказ покупателя', 'Через ROW_NUMBER выбери один самый дорогой заказ каждого покупателя с заказами. При равной сумме выбери меньший order_id. Выведи customer_id, order_id, order_amount, по customer_id.',
        `WITH ranked AS (
  SELECT oc.customer_id, o.order_id, o.price * o.quantity AS order_amount,
    ROW_NUMBER() OVER (PARTITION BY oc.customer_id
      ORDER BY o.price * o.quantity DESC, o.order_id) AS rn
  FROM orders AS o JOIN order_customers AS oc ON oc.order_id = o.order_id
)
SELECT customer_id, order_id, order_amount FROM ranked
WHERE rn = 1 ORDER BY customer_id;`, ['customer_id','order_id','order_amount'], [[1,103,4500],[2,102,1600],[3,107,3600],[4,105,2100],[5,108,800]]),
      sqlQuestion('Рейтинг категорий', 'Ранжируй категории по сумме всех заказов через RANK. Одинаковая сумма должна давать одинаковый ранг. Выведи category, order_amount, amount_rank; сортируй по рангу и категории.',
        `WITH totals AS (
  SELECT category, SUM(price * quantity) AS order_amount FROM orders GROUP BY category
)
SELECT category, order_amount, RANK() OVER (ORDER BY order_amount DESC) AS amount_rank
FROM totals ORDER BY amount_rank, category;`, ['category','order_amount','amount_rank'], [['Электроника',9800,1],['Дом',3600,2],['Книги',3600,2],['Аксессуары',2400,4]], 'Категорию добавляем только в итоговую сортировку, иначе одинаковые суммы получат разные ранги.'),
      sqlQuestion('Динамика и накопление', 'Сначала агрегируй все заказы по дате. Выведи дату, сумму, разность с предыдущей имеющейся датой через LAG и накопленную сумму через SUM OVER. В первой строке разность NULL. Сортировка по дате.',
        `${SQL_DAILY_TOTALS}
SELECT order_date, order_amount,
  order_amount - LAG(order_amount) OVER (ORDER BY order_date) AS change_amount,
  SUM(order_amount) OVER (ORDER BY order_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_amount
FROM daily ORDER BY order_date;`, ['order_date','order_amount','change_amount','running_amount'], [['2026-09-01',4800,null,4800],['2026-09-02',4500,-300,9300],['2026-09-03',4500,0,13800],['2026-09-04',1200,-3300,15000],['2026-09-05',4400,3200,19400]], 'Если дата пропущена, LAG берёт предыдущую имеющуюся строку, а не обязательно вчерашний день.'),
      sqlQuestion('Заказы и реальные платежи', 'Через CTE предварительно сложи платежи каждого заказа, затем собери одну строку на заказ, сохранив заказы без платежей. Выведи order_id, order_amount, paid_amount и unpaid_amount = сумма заказа минус платежи. Сортировка по номеру.',
        `${SQL_ORDER_REPORT}
SELECT order_id, order_amount, paid_amount, order_amount - paid_amount AS unpaid_amount
FROM report ORDER BY order_id;`, ['order_id','order_amount','paid_amount','unpaid_amount'], [[101,3200,3200,0],[102,1600,1600,0],[103,4500,0,4500],[104,2400,2400,0],[105,2100,2100,0],[106,1200,0,1200],[107,3600,3600,0],[108,800,800,0]], 'payments содержит 7 платежей для 6 заказов. У 101 два платежа, но в отчёте он должен остаться одной строкой.'),
      sqlQuestion('Контроль отчёта', 'Для отчёта вопроса 14 одним запросом выведи число строк, уникальных order_id, число пустых ключей, сумму заказов и сумму оплат. CTE нужно снова включить в запрос. Сверь суммы отдельно с orders и payments и запиши вывод.',
        `${SQL_ORDER_REPORT}
SELECT COUNT(*) AS row_count, COUNT(DISTINCT order_id) AS unique_orders,
  COUNT(*) - COUNT(order_id) AS missing_ids,
  SUM(order_amount) AS order_amount, SUM(paid_amount) AS paid_amount
FROM report;`, ['row_count','unique_orders','missing_ids','order_amount','paid_amount'], [[8,8,0,19400,13700]], 'Независимая сверка: SELECT SUM(price * quantity) FROM orders; и SELECT SUM(amount) FROM payments;. Совпадение сумм не доказывает отсутствие всех ошибок: отдельно проверь ключи и контрольный заказ 101.')
    ]}]
  },
  {
    type: 'Самопроверка', status: 'ready', dataset: 'orders',
    text: '30 задач для закрепления: 10 базовых, 10 на JOIN/CTE и 10 на окна/даты.',
    deliverable: '30 пронумерованных запросов и журнал: номер задачи, первая ошибка, исправление, дата и результат повторной попытки.',
    criteria: 'Через 2–4 дня заново решены хотя бы 24 из 30 задач без открытия ответов, в том числе минимум 8 из 10 в каждой группе. Остальные разобраны и исправлены; обе попытки записаны в журнал.',
    sections: [{ title: 'Два прохода', paragraphs: [
      'Проходи после дня 12 и основной контрольной. Начни с исходных данных через подготовку ниже. Можно разделить первый проход на три занятия по группам. Каждый запрос самостоятельный, все условия относятся к исходной базе, а не к результатам других задач.',
      'Сначала реши задачи, затем сравни результаты и открой SQL только там, где требуется разбор. Через 2–4 дня повтори все 30 задач, не открывая ответы и прежние решения. Уроки как справочник синтаксиса разрешены. Ответ считается верным, если совпали состав строк, вычисления и заданный порядок, и ты можешь объяснить запрос. Имена столбцов даны в таблицах ответов; свои понятные алиасы допустимы.',
      'В журнале достаточно строк вида «Б3 | забыл paid = 1 | добавил фильтр | 15.09 | верно». Подсчитай верные повторные попытки отдельно в каждой группе. Отметка задания — ручная самопроверка, сайт не запускает введённый SQL. Сохраняй решения в текстовый .sql-файл и журнал в заметку к заданию. Все суммы — price * quantity, если явно не сказано о платежах.'
    ]}],
    groups: [
      { title: 'Б · 10 базовых задач', questions: [
        sqlQuestion('Б1. Сумма строки', 'Выведи order_id, product и сумму заказа 102.', `SELECT order_id, product, price * quantity AS order_amount FROM orders WHERE order_id = 102;`, ['order_id','product','order_amount'], [[102,'Чехол',1600]]),
        sqlQuestion('Б2. Несколько городов', 'Выведи номера заказов из Москвы или Казани с количеством больше 1. Сортировка по номеру.', `SELECT order_id FROM orders WHERE city IN ('Москва', 'Казань') AND quantity > 1 ORDER BY order_id;`, ['order_id'], [[102]]),
        sqlQuestion('Б3. Неизвестная доставка', 'Найди оплаченные заказы с неизвестной датой доставки. Выведи только номера по возрастанию.', `SELECT order_id FROM orders WHERE paid = 1 AND delivery_date IS NULL ORDER BY order_id;`, ['order_id'], [[105]]),
        sqlQuestion('Б4. Поиск текста', 'Выведи номера и товары, чьё название начинается с «К». Используй LIKE, сортируй по номеру.', `SELECT order_id, product FROM orders WHERE product LIKE 'К%' ORDER BY order_id;`, ['order_id','product'], [[103,'Клавиатура'],[104,'Книга'],[106,'Книга']]),
        sqlQuestion('Б5. Два дорогих заказа', 'Выведи номера и суммы двух самых дорогих заказов. При равенстве суммы меньший номер первый.', `SELECT order_id, price * quantity AS order_amount FROM orders ORDER BY order_amount DESC, order_id LIMIT 2;`, ['order_id','order_amount'], [[103,4500],[107,3600]]),
        sqlQuestion('Б6. Уникальные города', 'Выведи уникальные города по алфавиту через DISTINCT.', `SELECT DISTINCT city FROM orders ORDER BY city;`, ['city'], [['Казань'],['Москва'],['Тбилиси']]),
        sqlQuestion('Б7. Статистика доставки', 'Посчитай все заказы и заказы с известной датой доставки в одной строке.', `SELECT COUNT(*) AS order_count, COUNT(delivery_date) AS delivered_count FROM orders;`, ['order_count','delivered_count'], [[8,5]]),
        sqlQuestion('Б8. Города с несколькими заказами', 'Выведи города с хотя бы 3 заказами, их число и сумму. Сортируй по городу.', `SELECT city, COUNT(*) AS order_count, SUM(price * quantity) AS order_amount FROM orders GROUP BY city HAVING COUNT(*) >= 3 ORDER BY city;`, ['city','order_count','order_amount'], [['Москва',4,10600]]),
        sqlQuestion('Б9. Сегменты', 'CASE: суммы меньше 2000 назови «маленький», от 2000 включительно до 3000 — «средний», от 3000 — «крупный». Выведи сегмент и число заказов, сортируй по названию сегмента.', `SELECT CASE WHEN price * quantity < 2000 THEN 'маленький'
  WHEN price * quantity < 3000 THEN 'средний' ELSE 'крупный' END AS segment,
  COUNT(*) AS order_count
FROM orders GROUP BY segment ORDER BY segment;`, ['segment','order_count'], [['крупный',3],['маленький',3],['средний',2]]),
        sqlQuestion('Б10. Пустая выборка', 'Посчитай количество, сумму и среднюю сумму заказов из города «Омск». Не заменяй NULL нулём.', `SELECT COUNT(*) AS order_count, SUM(price * quantity) AS order_amount, AVG(price * quantity) AS avg_order_amount FROM orders WHERE city = 'Омск';`, ['order_count','order_amount','avg_order_amount'], [[0,null,null]], 'Ноль строк — известное количество. SUM и AVG пустой выборки возвращают NULL.')
      ]},
      { title: 'С · 10 задач на JOIN и CTE', questions: [
        sqlQuestion('С1. Имя по ключу', 'Соедини orders, order_customers и customers. Для заказов 103 и 106 выведи номер, идентификатор и имя покупателя. Сортируй по номеру заказа.', `SELECT o.order_id, c.customer_id, c.customer_name
FROM orders AS o JOIN order_customers AS oc ON oc.order_id = o.order_id
JOIN customers AS c ON c.customer_id = oc.customer_id
WHERE o.order_id IN (103,106) ORDER BY o.order_id;`, ['order_id','customer_id','customer_name'], [[103,1,'Анна'],[106,2,'Борис']]),
        sqlQuestion('С2. Заказы без платежей', 'Через LEFT JOIN найди заказы без единого платежа. Выведи номера по возрастанию.', `SELECT o.order_id FROM orders AS o LEFT JOIN payments AS p ON p.order_id = o.order_id WHERE p.payment_id IS NULL ORDER BY o.order_id;`, ['order_id'], [[103],[106]]),
        sqlQuestion('С3. Несколько платежей', 'Выведи номера заказов с более чем одним платежом, число платежей и их сумму. Сортируй по номеру.', `SELECT order_id, COUNT(*) AS payment_count, SUM(amount) AS paid_amount FROM payments GROUP BY order_id HAVING COUNT(*) > 1 ORDER BY order_id;`, ['order_id','payment_count','paid_amount'], [[101,2,3200]]),
        sqlQuestion('С4. Число оплаченных заказов', 'Для всех покупателей выведи идентификатор и число оплаченных заказов. Сохрани нули. Сортируй по идентификатору.', `SELECT c.customer_id, COUNT(o.order_id) AS paid_count
FROM customers AS c LEFT JOIN order_customers AS oc ON oc.customer_id = c.customer_id
LEFT JOIN orders AS o ON o.order_id = oc.order_id AND o.paid = 1
GROUP BY c.customer_id ORDER BY c.customer_id;`, ['customer_id','paid_count'], [[1,1],[2,1],[3,2],[4,1],[5,1],[6,0]], 'Фильтр paid находится в ON, чтобы не удалить покупателей без оплаченных заказов.'),
        sqlQuestion('С5. Ошибочное соединение', 'Намеренно соедини orders с payments через LEFT JOIN без предварительной агрегации. Посчитай строки и сумму повторённых заказов; объясни ошибку.', `SELECT COUNT(*) AS row_count, SUM(o.price * o.quantity) AS wrong_amount FROM orders AS o LEFT JOIN payments AS p ON p.order_id = o.order_id;`, ['row_count','wrong_amount'], [[9,22600]], '101 повторился дважды; лишние 3200. Этот запрос нужен для диагностики, использовать итог как сумму заказов нельзя.'),
        sqlQuestion('С6. Проверка исправления', 'Агрегируй payments в CTE до заказа и присоедини к orders через LEFT JOIN. Посчитай строки, сумму заказов и сумму платежей; отсутствующие платежи замени нулём.', `${SQL_ORDER_REPORT}
SELECT COUNT(*) AS row_count, SUM(order_amount) AS order_amount, SUM(paid_amount) AS paid_amount FROM report;`, ['row_count','order_amount','paid_amount'], [[8,19400,13700]]),
        sqlQuestion('С7. Среднее с Ниной', 'Через CTE посчитай среднюю сумму заказов по всем шести покупателям, включая ноль Нины. Выведи число покупателей и среднее.', `${SQL_CUSTOMER_TOTALS}
SELECT COUNT(*) AS customer_count, AVG(order_amount) AS avg_customer_amount FROM customer_totals;`, ['customer_count','avg_customer_amount'], [[6,19400/6]], '3233.333…; последние знаки зависят от отображения. Это другой знаменатель, чем пять покупателей с заказами.'),
        sqlQuestion('С8. Заказы выше среднего чека', 'Через скалярный подзапрос найди заказы с суммой строго выше среднего чека всех заказов. Выведи номер и сумму, сортируй по номеру.', `SELECT order_id, price * quantity AS order_amount FROM orders WHERE price * quantity > (SELECT AVG(price * quantity) FROM orders) ORDER BY order_id;`, ['order_id','order_amount'], [[101,3200],[103,4500],[107,3600]]),
        sqlQuestion('С9. Потерянная связь', 'Проверь через LEFT JOIN, есть ли orders без соответствия в order_customers. Выведи номера по возрастанию. Не меняй исходник.', `SELECT o.order_id FROM orders AS o LEFT JOIN order_customers AS oc ON oc.order_id = o.order_id WHERE oc.order_id IS NULL ORDER BY o.order_id;`, ['order_id'], [], 'Пустой результат означает, что эта проверка не нашла потерянных связей.'),
        sqlQuestion('С10. Сверка paid с платежами', 'Сложи payments по заказу в CTE. Найди номера, где сумма платежей не равна price * quantity для paid = 1 или не равна 0 для paid = 0. Сортировка по номеру.', `WITH payment_totals AS (
  SELECT order_id, SUM(amount) AS paid_amount FROM payments GROUP BY order_id
)
SELECT o.order_id FROM orders AS o
LEFT JOIN payment_totals AS p ON p.order_id = o.order_id
WHERE COALESCE(p.paid_amount, 0) <> CASE WHEN o.paid = 1 THEN o.price * o.quantity ELSE 0 END
ORDER BY o.order_id;`, ['order_id'], [], 'Правило относится к этому учебному набору. В реальном источнике сначала нужно уточнить частичные оплаты и возвраты.')
      ]},
      { title: 'О · 10 задач на окна и даты', questions: [
        sqlQuestion('О1. Интервал дат', 'Выведи номера заказов с 2 сентября включительно до 5 сентября 2026 не включительно, по номеру.', `SELECT order_id FROM orders WHERE order_date >= '2026-09-02' AND order_date < '2026-09-05' ORDER BY order_id;`, ['order_id'], [[103],[104],[105],[106]]),
        sqlQuestion('О2. Месяц', 'Сгруппируй все заказы по месяцу через strftime. Выведи месяц YYYY-MM, число и сумму, сортируй по месяцу.', `SELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS order_count, SUM(price * quantity) AS order_amount FROM orders GROUP BY month ORDER BY month;`, ['month','order_count','order_amount'], [['2026-09',8,19400]], 'В сентябре загружены только первые пять дней.'),
        sqlQuestion('О3. Средний срок доставки', 'Посчитай число известных дат доставки и среднее число дней между заказом и доставкой. Неизвестные даты в среднее не входят.', `SELECT COUNT(delivery_date) AS delivered_count, AVG(julianday(delivery_date) - julianday(order_date)) AS avg_days FROM orders;`, ['delivered_count','avg_days'], [[5,3.2]]),
        sqlQuestion('О4. Нумерация заказов', 'Для каждого покупателя с заказами пронумеруй их по дате, при равенстве — по номеру. Выведи customer_id, order_id, order_number. Сортировка по покупателю и порядковому номеру.', `SELECT oc.customer_id, o.order_id,
  ROW_NUMBER() OVER (PARTITION BY oc.customer_id ORDER BY o.order_date, o.order_id) AS order_number
FROM orders AS o JOIN order_customers AS oc ON oc.order_id = o.order_id
ORDER BY oc.customer_id, order_number;`, ['customer_id','order_id','order_number'], [[1,101,1],[1,103,2],[2,102,1],[2,106,2],[3,104,1],[3,107,2],[4,105,1],[5,108,1]]),
        sqlQuestion('О5. Первый заказ', 'Через CTE с ROW_NUMBER выбери первый заказ каждого покупателя с заказами: по дате, при равенстве меньший номер. Выведи customer_id и order_id, по покупателю.', `WITH numbered AS (
  SELECT oc.customer_id, o.order_id,
    ROW_NUMBER() OVER (PARTITION BY oc.customer_id ORDER BY o.order_date, o.order_id) AS rn
  FROM orders AS o JOIN order_customers AS oc ON oc.order_id = o.order_id
)
SELECT customer_id, order_id FROM numbered WHERE rn = 1 ORDER BY customer_id;`, ['customer_id','order_id'], [[1,101],[2,102],[3,104],[4,105],[5,108]]),
        sqlQuestion('О6. Ранг в категории', 'Для каждого заказа выведи категорию, номер, сумму и RANK по убыванию суммы внутри категории. Сортируй по категории, рангу, номеру.', `SELECT category, order_id, price * quantity AS order_amount,
  RANK() OVER (PARTITION BY category ORDER BY price * quantity DESC) AS amount_rank
FROM orders ORDER BY category, amount_rank, order_id;`, ['category','order_id','order_amount','amount_rank'], [['Аксессуары',102,1600,1],['Аксессуары',108,800,2],['Дом',107,3600,1],['Книги',104,2400,1],['Книги',106,1200,2],['Электроника',103,4500,1],['Электроника',101,3200,2],['Электроника',105,2100,3]]),
        sqlQuestion('О7. Предыдущая дата покупателя', 'Выведи customer_id, order_id и предыдущую дату заказа этого покупателя через LAG. Порядок окна — дата и номер; итог — покупатель, дата и номер. Для первого заказа оставь NULL.', `SELECT oc.customer_id, o.order_id,
  LAG(o.order_date) OVER (PARTITION BY oc.customer_id ORDER BY o.order_date, o.order_id) AS previous_date
FROM orders AS o JOIN order_customers AS oc ON oc.order_id = o.order_id
ORDER BY oc.customer_id, o.order_date, o.order_id;`, ['customer_id','order_id','previous_date'], [[1,101,null],[1,103,'2026-09-01'],[2,102,null],[2,106,'2026-09-01'],[3,104,null],[3,107,'2026-09-03'],[4,105,null],[5,108,null]]),
        sqlQuestion('О8. Разница дневных сумм', 'Через CTE агрегируй все заказы по дате и выведи дату и разность суммы с предыдущей имеющейся датой. Используй LAG; первая разность NULL. Сортировка по дате.', `${SQL_DAILY_TOTALS}
SELECT order_date, order_amount - LAG(order_amount) OVER (ORDER BY order_date) AS change_amount FROM daily ORDER BY order_date;`, ['order_date','change_amount'], [['2026-09-01',null],['2026-09-02',-300],['2026-09-03',0],['2026-09-04',-3300],['2026-09-05',3200]]),
        sqlQuestion('О9. Накопленная сумма', 'Через CTE агрегируй суммы по дате. Выведи дату и накопленную сумму от первой даты до текущей включительно. Укажи рамку ROWS, сортируй по дате.', `${SQL_DAILY_TOTALS}
SELECT order_date,
  SUM(order_amount) OVER (ORDER BY order_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_amount
FROM daily ORDER BY order_date;`, ['order_date','running_amount'], [['2026-09-01',4800],['2026-09-02',9300],['2026-09-03',13800],['2026-09-04',15000],['2026-09-05',19400]]),
        sqlQuestion('О10. Пауза между заказами', 'В CTE получи предыдущую дату каждого покупателя через LAG, по дате и номеру. Выведи только повторные заказы: customer_id, order_id и целое число дней с предыдущего заказа. Сортируй по покупателю, дате и номеру.', `WITH previous_orders AS (
  SELECT oc.customer_id, o.order_id, o.order_date,
    LAG(o.order_date) OVER (PARTITION BY oc.customer_id ORDER BY o.order_date, o.order_id) AS previous_date
  FROM orders AS o JOIN order_customers AS oc ON oc.order_id = o.order_id
)
SELECT customer_id, order_id,
  CAST(julianday(order_date) - julianday(previous_date) AS INTEGER) AS gap_days
FROM previous_orders WHERE previous_date IS NOT NULL
ORDER BY customer_id, order_date, order_id;`, ['customer_id','order_id','gap_days'], [[1,103,1],[2,106,3],[3,107,2]])
      ]}
    ]
  },
  {
    type: 'Знакомые данные', status: 'ready', optional: true, dataset: 'listings',
    text: 'Необязательно: 6 запросов на синтетических объявлениях — просмотры, контакты, их отношение и сравнение цен.',
    deliverable: '6 запросов, результаты и вывод из 3–4 предложений с числами и ограничениями.',
    criteria: 'Все ответы сверены. Общая доля считается отношением сумм; нулевые просмотры дают NULL. Цены сравниваются внутри категории. По этим данным не заявлена причинная связь цены и контактов.',
    sections: [{ title: 'Данные и смысл показателей', paragraphs: [
      'Выполни после дня 12. Достаточно 45–60 минут. Собственная выгрузка и знание Avito не нужны: данные вымышленные, одинаковый период наблюдения — 1–5 сентября 2026 года. В SQLiteOnline выбери SQLite, запусти подготовку ниже и затем выполняй свои запросы по одному. Сохрани их в текстовый .sql-файл, результаты и вывод — в заметку к заданию.',
      'Одна строка listings — одно объявление за весь период. listing_id — уникальный номер; category — категория; price — цена предложения в рублях; views — число просмотров; contacts — число контактов. Это счётчики действий, а не уникальных людей и не продаж. Здесь price — цена объявления: умножать её на views или contacts для получения выручки нельзя.',
      'Отношение контактов к просмотрам = contacts * 1.0 / NULLIF(views, 0). По группе сначала складывай контакты и просмотры, затем дели суммы. Среднее отношений отдельных строк отвечает на другой вопрос. Для объявления без просмотров отношение неизвестно (NULL), а не равно нулю. Средняя цена ниже — простое среднее объявлений в той же категории, включая само объявление.'
    ]}],
    setup: `DROP TABLE IF EXISTS listings;
CREATE TABLE listings (
  listing_id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  views INTEGER NOT NULL,
  contacts INTEGER NOT NULL
);
INSERT INTO listings VALUES
  (1, 'Книги', 1000, 100, 10),
  (2, 'Книги', 1500, 50, 0),
  (3, 'Книги', 2000, 0, 0),
  (4, 'Лампы', 2000, 200, 20),
  (5, 'Лампы', 3000, 50, 10),
  (6, 'Лампы', 4000, 0, 0);`,
    review: [
      'Всего 400 просмотров и 40 контактов: отношение 0.1 (10%). У ламп 30 / 250 = 0.12 (12%), у книг 10 / 150 ≈ 0.0667 (6.67%). Это описывает действия на небольшом вымышленном наборе, а не вероятность покупки.',
      'Объявления 1 и 4 дешевле средней цены своей категории. По шести строкам нельзя заключить, что снижение цены вызовет рост контактов: отличаются категории и сами предложения, эксперимента нет. У 3 и 6 нет просмотров, их отношение не определено.'
    ],
    groups: [{ title: 'Практика на объявлениях', questions: [
      sqlQuestion('Размер и итоги', 'Посчитай число строк, уникальных номеров, сумму просмотров и сумму контактов.', `SELECT COUNT(*) AS row_count, COUNT(DISTINCT listing_id) AS unique_listings, SUM(views) AS views, SUM(contacts) AS contacts FROM listings;`, ['row_count','unique_listings','views','contacts'], [[6,6,400,40]]),
      sqlQuestion('Отношение по объявлению', 'Выведи номер, просмотры, контакты и их отношение от 0 до 1. При нуле просмотров результат NULL. Сортируй по номеру.', `SELECT listing_id, views, contacts, contacts * 1.0 / NULLIF(views, 0) AS contact_ratio FROM listings ORDER BY listing_id;`, ['listing_id','views','contacts','contact_ratio'], [[1,100,10,0.1],[2,50,0,0],[3,0,0,null],[4,200,20,0.1],[5,50,10,0.2],[6,0,0,null]]),
      sqlQuestion('Категории', 'Для каждой категории посчитай просмотры, контакты и отношение сумм от 0 до 1. Сортируй по категории.', `SELECT category, SUM(views) AS views, SUM(contacts) AS contacts, SUM(contacts) * 1.0 / NULLIF(SUM(views), 0) AS contact_ratio FROM listings GROUP BY category ORDER BY category;`, ['category','views','contacts','contact_ratio'], [['Книги',150,10,10/150],['Лампы',250,30,0.12]], 'Повторяющуюся дробь можно сравнивать с округлением при отображении.'),
      sqlQuestion('Общее отношение', 'Посчитай отношение суммы контактов к сумме просмотров по всему набору от 0 до 1.', `SELECT SUM(contacts) * 1.0 / NULLIF(SUM(views), 0) AS contact_ratio FROM listings;`, ['contact_ratio'], [[0.1]], 'Не усредняй отношения из предыдущих вопросов: у объявлений и категорий разное число просмотров.'),
      sqlQuestion('Дешевле среднего в категории', 'В CTE посчитай среднюю цену по каждой категории, затем соедини с объявлениями. Выведи номера, категорию, цену и среднюю цену только для объявлений строго дешевле среднего в своей категории. Сортируй по номеру.', `WITH category_prices AS (
  SELECT category, AVG(price) AS avg_price FROM listings GROUP BY category
)
SELECT l.listing_id, l.category, l.price, cp.avg_price
FROM listings AS l JOIN category_prices AS cp ON cp.category = l.category
WHERE l.price < cp.avg_price ORDER BY l.listing_id;`, ['listing_id','category','price','avg_price'], [[1,'Книги',1000,1500],[4,'Лампы',2000,3000]]),
      sqlQuestion('Нет просмотров', 'Найди объявления с нулём просмотров. Выведи номер, категорию и цену, по номеру. Объясни, почему сравнить их отношение контактов к просмотрам с другими нельзя.', `SELECT listing_id, category, price FROM listings WHERE views = 0 ORDER BY listing_id;`, ['listing_id','category','price'], [[3,'Книги',2000],[6,'Лампы',4000]], 'Знаменатель нулевой. Отсутствие просмотров само по себе не доказывает, что цена завышена.')
    ]}]
  }
];
