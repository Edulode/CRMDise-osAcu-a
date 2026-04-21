const express = require('express');
const PDFDocument = require('pdfkit');
const { stringify } = require('csv-stringify/sync');
const { pool } = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { USER_ROLES } = require('../config/constants');
const { validate } = require('../middleware/validate');
const { reportQuerySchema } = require('../validators/report.validators');

const router = express.Router();

function buildDateFilter(from, to, values, conditions, column = 'created_at') {
  if (from) {
    values.push(from);
    conditions.push(`${column} >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    conditions.push(`${column} <= $${values.length}`);
  }
}

router.get('/sales', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), validate(reportQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const values = [];
    const conditions = ['o.status <> $1'];
    values.push('canceled');
    buildDateFilter(from, to, values, conditions, 'o.created_at');

    const result = await pool.query(
      `SELECT COUNT(*)::int AS orders_count,
              COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS total_sales,
              COALESCE(AVG(o.total_amount), 0)::numeric(12,2) AS average_ticket
       FROM orders o
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/inventory', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, c.name AS category, COALESCE(i.stock, 0) AS stock, COALESCE(i.reserved, 0) AS reserved
       FROM designs d
       INNER JOIN categories c ON c.id = d.category_id
       LEFT JOIN inventory i ON i.design_id = d.id
       ORDER BY c.name ASC, d.name ASC`
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/customers', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.full_name, c.email, COUNT(o.id)::int AS orders_count,
              COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS lifetime_value,
              MAX(o.created_at) AS last_purchase_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id
       ORDER BY lifetime_value DESC, c.full_name ASC`
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/export', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), validate(reportQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { format } = req.query;
    const inventoryResult = await pool.query(
      `SELECT d.name, c.name AS category, COALESCE(i.stock, 0) AS stock, COALESCE(i.reserved, 0) AS reserved
       FROM designs d
       INNER JOIN categories c ON c.id = d.category_id
       LEFT JOIN inventory i ON i.design_id = d.id
       ORDER BY c.name ASC, d.name ASC`
    );

    if (format === 'csv') {
      const csv = stringify(inventoryResult.rows, { header: true });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.csv');
      return res.status(200).send(csv);
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.pdf');
      doc.pipe(res);
      doc.fontSize(18).text('Reporte de inventario', { align: 'center' });
      doc.moveDown();
      inventoryResult.rows.forEach((row) => {
        doc.fontSize(11).text(`${row.name} | ${row.category} | stock: ${row.stock} | reservado: ${row.reserved}`);
      });
      doc.end();
      return undefined;
    }

    return res.status(200).json({ data: inventoryResult.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
