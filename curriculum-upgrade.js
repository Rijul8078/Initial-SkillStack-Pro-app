(function () {
  const modulesRef = (typeof MODULES !== 'undefined' && Array.isArray(MODULES)) ? MODULES : null;
  if (!modulesRef || window.__curriculumUpgraded) return;

  function ch(label, title, desc, hint, solution, validate, xp) {
    return { label, title, desc, hint, solution, validate, xp };
  }

  const fundamentalsModule = {
    name: 'Foundation Track: SQL Deep Fundamentals',
    icon: 'F',
    lessons: [
      {
        title: 'Data Types and Type Affinity in Depth',
        sub: 'NULL, INTEGER, REAL, TEXT, BLOB, NUMERIC affinity',
        diff: 'easy',
        tags: ['concept'],
        schema: ['customers', 'products', 'orders'],
        theory: `
<p><strong>Why data types matter:</strong> they affect filtering, joins, sorting, aggregations, and storage quality.</p>
<p><strong>SQLite storage classes:</strong> NULL, INTEGER, REAL, TEXT, BLOB.</p>
<p><strong>Type affinity:</strong> SQLite columns may accept flexible values, but your schema intent still matters for analytics and reliability.</p>
<p><strong>Common mistakes:</strong> numbers stored as text, text dates in mixed formats, comparing strings to numeric values without casting.</p>
<p><strong>Best practices:</strong> ISO date format (<code>YYYY-MM-DD</code>), explicit casts when needed, stable column naming and units.</p>
<div class="syntax-box">SELECT id, price, TYPEOF(price) AS t FROM products;
SELECT CAST('120' AS INTEGER) AS qty;
SELECT date('2026-01-05') AS order_dt;</div>
        `,
        challenges: [
          ch('Type Drill', 'Inspect type of columns', 'Return id, name, TYPEOF(age) from customers.', 'Use TYPEOF(age).', 'SELECT id, name, TYPEOF(age) AS age_type FROM customers;', (r) => r && r.length > 0 && r[0].age_type, 40),
          ch('Type Drill', 'Find numeric prices', 'Return products where TYPEOF(price) is real or integer.', 'Filter TYPEOF(price).', "SELECT id, name, price, TYPEOF(price) AS t FROM products WHERE TYPEOF(price) IN ('real','integer');", (r) => r && r.length >= 5, 45),
          ch('Type Drill', 'Validate date text format', 'Return orders where order_date looks like YYYY-MM-DD.', "Use LIKE '____-__-__'", "SELECT id, order_date FROM orders WHERE order_date LIKE '____-__-__';", (r) => Array.isArray(r), 35),
        ],
      },
      {
        title: 'NULL Semantics, Defaults, and Constraints',
        sub: 'IS NULL, COALESCE, NOT NULL, UNIQUE, CHECK, DEFAULT',
        diff: 'easy',
        tags: ['concept', 'interview'],
        schema: ['customers', 'products', 'employees'],
        theory: `
<p><strong>NULL</strong> means unknown, not zero and not empty string.</p>
<p>Use <code>IS NULL</code> / <code>IS NOT NULL</code> only. Avoid <code>= NULL</code>.</p>
<p><strong>Constraints:</strong> NOT NULL (required), UNIQUE (no duplicates), CHECK (rules), DEFAULT (fallback values).</p>
<p><strong>COALESCE</strong> helps with reporting output and safe calculations.</p>
<div class="syntax-box">SELECT name, COALESCE(city, 'Unknown') FROM customers;
SELECT * FROM products WHERE stock >= 0;
SELECT COUNT(email), COUNT(*) FROM customers;</div>
        `,
        challenges: [
          ch('NULL Drill', 'Detect missing values', 'Return customers with missing city or email.', 'Use OR + IS NULL.', 'SELECT id, name, city, email FROM customers WHERE city IS NULL OR email IS NULL;', (r) => Array.isArray(r), 45),
          ch('NULL Drill', 'Safe output with COALESCE', "Return employee name and city fallback 'Unknown'.", "COALESCE(city,'Unknown')", "SELECT name, COALESCE(city, 'Unknown') AS city_label FROM employees;", (r) => r && r.length > 0, 35),
          ch('Constraint Drill', 'Quick quality check', 'Return products with negative stock.', 'Use stock < 0.', 'SELECT id, name, stock FROM products WHERE stock < 0;', (r) => Array.isArray(r), 30),
        ],
      },
      {
        title: 'Keys, Relationships, and Join Integrity',
        sub: 'PK/FK design, referential integrity, join correctness',
        diff: 'medium',
        tags: ['concept', 'project'],
        schema: ['orders', 'order_items', 'customers', 'products'],
        theory: `
<p><strong>Primary key</strong> uniquely identifies a row. <strong>Foreign key</strong> links rows across tables.</p>
<p>Incorrect keys create duplicates, orphan rows, and wrong KPIs.</p>
<p>Always validate cardinality assumptions when joining (1:1, 1:N, N:N).</p>
<p>Use LEFT JOIN audits to find orphan references.</p>
<div class="syntax-box">SELECT o.id, c.name
FROM orders o JOIN customers c ON o.customer_id = c.id;

SELECT oi.id
FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.id IS NULL;</div>
        `,
        challenges: [
          ch('Join Drill', 'Orders with customer names', 'Return order id, customer name, status.', 'Join orders to customers.', 'SELECT o.id, c.name AS customer_name, o.status FROM orders o JOIN customers c ON o.customer_id = c.id;', (r) => r && r.length >= 5 && Object.prototype.hasOwnProperty.call(r[0], 'customer_name'), 50),
          ch('Join Drill', 'Order line view', 'Return order id, product name, quantity, unit_price.', 'Join order_items to products.', 'SELECT oi.order_id, p.name AS product_name, oi.quantity, oi.unit_price FROM order_items oi JOIN products p ON oi.product_id = p.id;', (r) => r && r.length >= 5, 55),
          ch('Integrity Drill', 'Find orphan line items', 'Return line items with no matching order.', 'LEFT JOIN + parent IS NULL.', 'SELECT oi.id, oi.order_id FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL;', (r) => Array.isArray(r), 45),
        ],
      },
      {
        title: 'Date, Time, Text, Numeric Functions',
        sub: 'strftime, date math, substr, trim, round, cast',
        diff: 'medium',
        tags: ['concept', 'project'],
        schema: ['orders', 'products', 'customers'],
        theory: `
<p>Most analytics work is transformation before aggregation.</p>
<p><strong>Date:</strong> date(), datetime(), strftime().</p>
<p><strong>Text:</strong> lower(), upper(), trim(), substr(), replace().</p>
<p><strong>Numeric:</strong> round(), abs(), cast().</p>
<p>Always make transformed columns explicit with aliases.</p>
<div class="syntax-box">SELECT strftime('%Y-%m', order_date) AS month_key, COUNT(*)
FROM orders GROUP BY month_key;

SELECT name, ROUND(((price-cost)*100.0)/price, 2) AS margin_pct
FROM products WHERE price > 0;</div>
        `,
        challenges: [
          ch('Function Drill', 'Monthly order count', 'Return month and total orders.', "strftime('%Y-%m', order_date)", "SELECT strftime('%Y-%m', order_date) AS month_key, COUNT(*) AS total_orders FROM orders GROUP BY month_key ORDER BY month_key;", (r) => r && r.length > 0, 55),
          ch('Function Drill', 'Uppercase city labels', 'Return customer name and UPPER(city).', 'UPPER(city)', 'SELECT name, UPPER(city) AS city_upper FROM customers;', (r) => r && r.length > 0, 30),
          ch('Function Drill', 'Gross margin percent', 'Return product and margin percent rounded 2 decimals.', 'ROUND + arithmetic expression', 'SELECT name, ROUND(((price - cost) * 100.0) / price, 2) AS margin_percent FROM products WHERE price > 0;', (r) => r && r.length > 0 && Object.prototype.hasOwnProperty.call(r[0], 'margin_percent'), 60),
        ],
      },
      {
        title: 'Normalization and Schema Design Checklist',
        sub: '1NF/2NF/3NF, denormalization tradeoffs, star schema basics',
        diff: 'medium',
        tags: ['concept', 'interview'],
        schema: ['customers', 'orders', 'order_items', 'products', 'categories'],
        theory: `
<p><strong>1NF:</strong> atomic columns, no repeating groups.</p>
<p><strong>2NF:</strong> every non-key attribute depends on full key.</p>
<p><strong>3NF:</strong> remove transitive dependencies among non-key attributes.</p>
<p><strong>Denormalization</strong> can improve reporting speed but increases update complexity.</p>
<p><strong>Analytics design:</strong> consider fact/dimension patterns for BI reporting.</p>
        `,
        challenges: [
          ch('Design Drill', 'Count rows by table', 'Return row count for customers/products/orders.', 'Use UNION ALL with COUNT(*)', "SELECT 'customers' AS table_name, COUNT(*) AS cnt FROM customers UNION ALL SELECT 'products', COUNT(*) FROM products UNION ALL SELECT 'orders', COUNT(*) FROM orders;", (r) => r && r.length === 3, 50),
          ch('Design Drill', 'Top categories by sold quantity', 'Return category and total quantity sold.', 'Join order_items -> products -> categories', 'SELECT c.name AS category_name, SUM(oi.quantity) AS qty_sold FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN categories c ON p.category_id=c.id GROUP BY c.name ORDER BY qty_sold DESC;', (r) => r && r.length > 0, 60),
          ch('Design Drill', 'Customer order frequency', 'Return customer name and number of orders.', 'COUNT orders grouped by customer', 'SELECT c.name, COUNT(o.id) AS order_count FROM customers c LEFT JOIN orders o ON c.id=o.customer_id GROUP BY c.name ORDER BY order_count DESC;', (r) => r && r.length > 0 && Object.prototype.hasOwnProperty.call(r[0], 'order_count'), 45),
        ],
      },
      {
        title: 'Query Debugging and Error Patterns',
        sub: 'syntax, aliasing, ambiguous columns, grouping mistakes',
        diff: 'medium',
        tags: ['concept', 'interview'],
        schema: ['orders', 'order_items', 'products'],
        theory: `
<p>SQL errors are normal. Debug with a repeatable flow:</p>
<p>1) run small SELECT first, 2) validate joins, 3) validate grouping grain, 4) add ordering/limit for inspection.</p>
<p>Common issues: ambiguous column names, wrong GROUP BY columns, missing join conditions, null arithmetic surprises.</p>
        `,
        challenges: [
          ch('Debug Drill', 'Ambiguous fix pattern', 'Return order_id and product_name for first 10 line items.', 'Always prefix columns with aliases.', 'SELECT oi.order_id, p.name AS product_name FROM order_items oi JOIN products p ON oi.product_id = p.id LIMIT 10;', (r) => r && r.length > 0, 40),
          ch('Debug Drill', 'Aggregation grain check', 'Return each order_id with total line quantity.', 'GROUP BY order_id', 'SELECT order_id, SUM(quantity) AS total_qty FROM order_items GROUP BY order_id ORDER BY total_qty DESC;', (r) => r && r.length > 0, 45),
          ch('Debug Drill', 'Controlled inspection output', 'Return top 5 products by rating.', 'ORDER BY rating DESC LIMIT 5', 'SELECT id, name, rating FROM products ORDER BY rating DESC LIMIT 5;', (r) => r && r.length <= 5, 30),
        ],
      },
    ],
  };

  const supplementalTheory = `
<p><strong>Deep-dive checklist (use every lesson):</strong></p>
<p>1) Data type correctness (text vs numeric vs date)</p>
<p>2) Null handling (COALESCE / IS NULL)</p>
<p>3) Join integrity and cardinality</p>
<p>4) Aggregation grain correctness</p>
<p>5) Deterministic output (ORDER BY in reports)</p>
<p>6) Performance intent (filter early, avoid unnecessary columns)</p>
`;

  const deepTheoryAddon = `
<div class="analogy-box">Interview tip: explain both <strong>what your query returns</strong> and <strong>why the logic is safe on edge cases</strong> (NULLs, duplicates, missing joins).</div>
`;

  const longTheorySections = {
    datatypes: `
<h4>Data Types and Storage Notes</h4>
<p>Pick column types intentionally. Keep IDs as integers, money as numeric/real, and dates in stable ISO format. Mixing number-like text with numeric columns causes wrong sorting and broken comparisons.</p>
<p>Checklist: verify column type assumptions, convert with CAST only when needed, and avoid implicit conversions in joins and filters.</p>`,
    nulls: `
<h4>NULL Behavior Notes</h4>
<p>NULL means unknown value, not empty string and not zero. Arithmetic with NULL gives NULL, so use COALESCE in reporting metrics. Use IS NULL / IS NOT NULL and never use <code>= NULL</code>.</p>`,
    joins: `
<h4>Join Strategy Notes</h4>
<p>Before writing joins, define expected relationship: 1:1, 1:N, or N:N. Validate row counts before and after join to catch duplication bugs early. Prefer explicit aliases and keep join conditions readable.</p>`,
    agg: `
<h4>Aggregation and Grain Notes</h4>
<p>Decide report grain first (per customer, per order, per month). Then aggregate exactly to that grain. If you aggregate too early or too late, totals become incorrect.</p>`,
    window: `
<h4>Window Function Notes</h4>
<p>Use window functions when you need row-level detail plus group-level calculations at the same time. Add <code>PARTITION BY</code> for grouping and <code>ORDER BY</code> for sequence-based logic.</p>`,
    cte: `
<h4>CTE and Query Design Notes</h4>
<p>Break long SQL into named blocks with WITH clauses. Each CTE should solve one clear sub-problem. This improves debugging and interview explanation quality.</p>`,
    perf: `
<h4>Performance Notes</h4>
<p>Filter early, project only required columns, and avoid unnecessary DISTINCT. Validate with explain-plan thinking: index usage, scan size, and join order.</p>`,
    interview: `
<h4>Interview Framing Notes</h4>
<p>In interviews, explain assumptions, expected output grain, and edge-case handling before final SQL. Mention one optimization tradeoff and one data-quality check.</p>`
  };

  function buildLongTheory(lesson) {
    const text = `${lesson.title || ''} ${lesson.sub || ''} ${(lesson.tags || []).join(' ')}`.toLowerCase();
    const picks = [];

    picks.push(longTheorySections.datatypes);
    picks.push(longTheorySections.nulls);

    if (/\bjoin|relationship|key|foreign|pk|fk\b/.test(text)) picks.push(longTheorySections.joins);
    if (/\bgroup|aggregate|count|sum|avg|having\b/.test(text)) picks.push(longTheorySections.agg);
    if (/\bwindow|rank|dense_rank|row_number|lag|lead|running\b/.test(text)) picks.push(longTheorySections.window);
    if (/\bcte|subquery|with\b/.test(text)) picks.push(longTheorySections.cte);
    if (/\binterview|project|optimization|index|performance|debug\b/.test(text)) picks.push(longTheorySections.perf);
    if ((lesson.tags || []).includes('interview')) picks.push(longTheorySections.interview);

    return `
<div class="theory-block">
  <div class="block-title blue">Long Notes</div>
  <p><strong>Learning Objective:</strong> master this lesson deeply enough to explain it, implement it, debug it, and optimize it.</p>
  ${picks.join('\n')}
  <h4>Common Mistakes and Fixes</h4>
  <p>1) Wrong grouping grain -> define the output grain before writing SQL. 2) Null bugs -> wrap metrics in COALESCE where needed. 3) Duplicate rows after joins -> validate keys and counts at each step.</p>
  <h4>Revision Questions</h4>
  <p>What problem does this SQL pattern solve? When should you avoid it? What is the performance tradeoff? How would you explain this to a non-technical stakeholder?</p>
  <h4>Implementation Checklist</h4>
  <p>Confirm schema assumptions, write minimal correct query, validate with sample rows, add edge-case handling, then optimize for readability and speed.</p>
</div>
`;
  }

  const extraChallengeTemplates = [
    () => ch('Extra Drill', 'Top 5 highest priced active products', 'Return product name and price ordered desc.', 'ORDER BY price DESC LIMIT 5', 'SELECT name, price FROM products WHERE is_active=1 ORDER BY price DESC LIMIT 5;', (r) => r && r.length > 0 && r.length <= 5, 35),
    () => ch('Extra Drill', 'City-wise customer count', 'Return city and customer count.', 'GROUP BY city', 'SELECT city, COUNT(*) AS total_customers FROM customers GROUP BY city ORDER BY total_customers DESC;', (r) => r && r.length > 0 && Object.prototype.hasOwnProperty.call(r[0], 'total_customers'), 40),
    () => ch('Extra Drill', 'Average rating by brand', 'Return brand and avg rating.', 'AVG + GROUP BY brand', 'SELECT brand, ROUND(AVG(rating),2) AS avg_rating FROM products GROUP BY brand ORDER BY avg_rating DESC;', (r) => r && r.length > 0, 35),
    () => ch('Extra Drill', 'Delivered order payment methods', 'Return delivered order ids and payment method.', "WHERE status='Delivered'", "SELECT id, payment_method FROM orders WHERE status='Delivered';", (r) => Array.isArray(r), 30),
    () => ch('Extra Drill', 'Revenue per order', 'Return order_id and gross_amount (quantity*unit_price).', 'SUM(quantity*unit_price)', 'SELECT order_id, ROUND(SUM(quantity*unit_price),2) AS gross_amount FROM order_items GROUP BY order_id ORDER BY gross_amount DESC;', (r) => r && r.length > 0 && Object.prototype.hasOwnProperty.call(r[0], 'gross_amount'), 45),
    () => ch('Extra Drill', 'Premium customer list', 'Return customer names where is_premium = 1.', 'Filter is_premium', 'SELECT name, city FROM customers WHERE is_premium = 1;', (r) => Array.isArray(r), 25),
    () => ch('Extra Drill', 'Low stock alert', 'Return products with stock <= 20.', 'Use <= filter', 'SELECT id, name, stock FROM products WHERE stock <= 20 ORDER BY stock ASC;', (r) => Array.isArray(r), 30),
    () => ch('Extra Drill', 'Order status distribution', 'Return status and count of orders.', 'GROUP BY status', 'SELECT status, COUNT(*) AS total_orders FROM orders GROUP BY status ORDER BY total_orders DESC;', (r) => r && r.length > 0, 35),
  ];

  function longTaskTemplates(mi, li) {
    return [
      ch(
        'Long Task',
        'Business KPI Pack',
        'Create a single result set (using CTEs) that includes monthly revenue, monthly order count, average order value, and active customer count for each month. Return results ordered by month and include clear aliases.',
        "Use WITH monthly_orders AS (...) and compute each KPI in separate CTE blocks before final SELECT.",
        "WITH monthly_orders AS (SELECT strftime('%Y-%m', o.order_date) AS month_key, o.id AS order_id, o.customer_id, SUM(oi.quantity*oi.unit_price) AS order_revenue FROM orders o JOIN order_items oi ON oi.order_id=o.id GROUP BY month_key, o.id, o.customer_id), month_kpis AS (SELECT month_key, ROUND(SUM(order_revenue),2) AS monthly_revenue, COUNT(order_id) AS monthly_orders, ROUND(AVG(order_revenue),2) AS avg_order_value, COUNT(DISTINCT customer_id) AS active_customers FROM monthly_orders GROUP BY month_key) SELECT month_key, monthly_revenue, monthly_orders, avg_order_value, active_customers FROM month_kpis ORDER BY month_key;",
        (r) => Array.isArray(r) && r.length > 0,
        120 + (mi % 3) * 10
      ),
      ch(
        'Long Task',
        'Data Quality + Root Cause',
        'Build a data quality query that flags suspicious records: null critical fields, negative quantity/price, impossible dates, and duplicate business keys. Return issue_type, record_id, and details.',
        "Use UNION ALL across multiple checks and assign an issue_type label in each SELECT.",
        "SELECT 'NULL_FIELD' AS issue_type, CAST(id AS TEXT) AS record_id, 'orders.customer_id is null' AS details FROM orders WHERE customer_id IS NULL UNION ALL SELECT 'NEGATIVE_VALUE', CAST(id AS TEXT), 'order_items has negative quantity or price' FROM order_items WHERE quantity < 0 OR unit_price < 0 UNION ALL SELECT 'INVALID_DATE', CAST(id AS TEXT), 'order_date malformed' FROM orders WHERE order_date NOT LIKE '____-__-__' UNION ALL SELECT 'DUPLICATE_EMAIL', CAST(MIN(id) AS TEXT), 'duplicate customer email' FROM customers GROUP BY email HAVING COUNT(*) > 1;",
        (r) => Array.isArray(r),
        130 + (li % 4) * 10
      )
    ];
  }

  function projectTaskTemplates() {
    return [
      ch(
        'Project',
        'Executive Dashboard Project',
        'Design an executive SQL dashboard pack with at least 6 widgets: revenue trend, top categories, returning customer %, city performance, discount impact, and top products. Submit as one multi-CTE query bundle with documented assumptions.',
        'Start with base CTEs: order_fact, customer_fact, product_fact. Then derive widget-specific CTEs and union/return outputs.',
        "WITH order_fact AS (SELECT o.id, o.customer_id, strftime('%Y-%m', o.order_date) AS month_key, SUM(oi.quantity*oi.unit_price) AS revenue FROM orders o JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id, o.customer_id, month_key), customer_orders AS (SELECT customer_id, COUNT(*) AS orders_count, SUM(revenue) AS lifetime_revenue FROM order_fact GROUP BY customer_id), month_rev AS (SELECT month_key, ROUND(SUM(revenue),2) AS revenue FROM order_fact GROUP BY month_key), top_products AS (SELECT p.name, ROUND(SUM(oi.quantity*oi.unit_price),2) AS rev FROM order_items oi JOIN products p ON p.id=oi.product_id GROUP BY p.id, p.name ORDER BY rev DESC LIMIT 10) SELECT * FROM month_rev;",
        (r) => Array.isArray(r) && r.length > 0,
        220
      ),
      ch(
        'Project',
        'Optimization and Explain Plan Task',
        'Take one heavy analytical query and optimize it. Provide baseline logic, optimized logic, and reasoning for index strategy and expected performance impact.',
        'Reduce repeated scans with CTE reuse, avoid SELECT *, and add useful filter predicates.',
        "WITH spend AS (SELECT o.customer_id, SUM(oi.quantity*oi.unit_price) AS total_spend FROM orders o JOIN order_items oi ON oi.order_id=o.id GROUP BY o.customer_id), ranked AS (SELECT c.name, c.city, s.total_spend, DENSE_RANK() OVER (PARTITION BY c.city ORDER BY s.total_spend DESC) AS city_rank FROM spend s JOIN customers c ON c.id=s.customer_id) SELECT name, city, total_spend FROM ranked WHERE city_rank <= 3 ORDER BY city, total_spend DESC;",
        (r) => Array.isArray(r),
        240
      )
    ];
  }

  function cloneChallenge(c) {
    return {
      label: c.label,
      title: c.title,
      desc: c.desc,
      hint: c.hint,
      solution: c.solution,
      validate: c.validate,
      xp: c.xp,
    };
  }

  function enrichLesson(lesson, mi, li) {
    if (!lesson.__longTheoryInjected) {
      lesson.theory = (lesson.theory || '') + supplementalTheory + deepTheoryAddon + buildLongTheory(lesson);
      lesson.__longTheoryInjected = true;
    }
    if (!Array.isArray(lesson.challenges)) lesson.challenges = [];

    const minChallengesPerLesson = 8;
    const needed = Math.max(0, minChallengesPerLesson - lesson.challenges.length);
    for (let i = 0; i < needed; i++) {
      const idx = (mi * 7 + li + i) % extraChallengeTemplates.length;
      lesson.challenges.push(cloneChallenge(extraChallengeTemplates[idx]()));
    }

    if (!lesson.__longTasksInjected) {
      longTaskTemplates(mi, li).forEach((task) => lesson.challenges.push(cloneChallenge(task)));
      if ((lesson.tags || []).includes('project') || (lesson.tags || []).includes('interview')) {
        projectTaskTemplates().forEach((task) => lesson.challenges.push(cloneChallenge(task)));
      }
      lesson.__longTasksInjected = true;
    }
  }

  // Merge mode: preserve original module order and append new deep module at the end.
  modulesRef.push(fundamentalsModule);
  modulesRef.forEach((m, mi) => {
    (m.lessons || []).forEach((l, li) => enrichLesson(l, mi, li));
  });

  if (typeof totalLessons !== 'undefined') {
    totalLessons = modulesRef.reduce((s, m) => s + ((m.lessons || []).length), 0);
  }

  function refreshCounts() {
    const cards = document.querySelectorAll('.welcome .stat-num');
    const totalChallenges = modulesRef.reduce((s, m) => s + (m.lessons || []).reduce((a, l) => a + ((l.challenges || []).length), 0), 0);
    if (cards && cards.length >= 3) {
      cards[0].textContent = String(typeof totalLessons !== 'undefined' ? totalLessons : 0);
      cards[1].textContent = String(totalChallenges);
      cards[2].textContent = String(modulesRef.length);
    }
  }

  function refreshUi() {
    try { if (typeof renderSidebar === 'function') renderSidebar(''); } catch (_) {}
    try { refreshCounts(); } catch (_) {}
  }

  window.__curriculumUpgraded = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshUi);
  } else {
    refreshUi();
  }
})();
